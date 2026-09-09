"""Crawl4AI implementation of the KickScholar `Crawler` contract.

TypeScript side (lib/crawler/types.ts) documents the same conceptual
interface — crawlPage / crawlSite / extractLinks — so a future crawler
implementation could stand in without changing anything downstream
(extraction, normalization, dedup, verification all consume the artifacts
this writes to disk, not this module directly).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib import robotparser

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig


@dataclass
class CrawlResult:
    url: str
    http_status: int | None
    html: str | None
    markdown: str | None
    metadata: dict
    fetched_at: str
    checksum: str | None
    success: bool
    error: str | None = None


@dataclass
class SiteCrawlConfig:
    seed_urls: list[str]
    include_patterns: list[str] = field(default_factory=list)
    exclude_patterns: list[str] = field(default_factory=list)
    max_depth: int = 2
    max_pages: int = 25
    rate_limit_ms: int = 3000
    respect_robots_txt: bool = True
    # Sitemap-driven discovery. This is how a *complete* corpus is enumerated:
    # link-following BFS can only reach what happens to be hyperlinked from a
    # seed, whereas a sitemap is the site's own declaration of everything it
    # publishes. DAAD's scholarship database, for instance, is a faceted
    # search app with no crawlable listing — but every one of its detail pages
    # is in https://www2.daad.de/sitemap.xml.
    sitemap_urls: list[str] = field(default_factory=list)
    # Regex applied to each <loc> found in a sitemap. A single sitemap often
    # mixes several content types (DAAD's carries both scholarship and
    # programme detail pages), so this selects the subset one source wants.
    sitemap_url_pattern: str | None = None
    sitemap_max_urls: int = 2000
    # "substring" (default, back-compatible) or "regex" for include/exclude.
    pattern_syntax: str = "substring"
    # Fixed post-load delay before scraping, in seconds. Several source sites
    # (e.g. Studyinfo.fi's konfo app) are client-rendered SPAs that need a
    # beat after navigation before the real content is in the DOM — without
    # this, Crawl4AI's own anti-bot heuristic flags the page as a
    # "script_heavy_shell" and discards it.
    delay_before_return_html: float = 2.0
    user_agent: str = (
        "KickScholarBot/0.1 (+https://kickscholar.example; "
        "educational-data-research; contact: admin@kickscholar.example)"
    )


def _now_iso() -> str:
    import datetime

    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _checksum(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _matches_patterns(
    url: str,
    include: list[str],
    exclude: list[str],
    syntax: str = "substring",
) -> bool:
    if syntax == "regex":
        def hit(pat: str) -> bool:
            return re.search(pat, url) is not None
    else:
        def hit(pat: str) -> bool:
            return pat in url

    if exclude and any(hit(pat) for pat in exclude):
        return False
    if include and not any(hit(pat) for pat in include):
        return False
    return True


def _fetch_text(url: str, user_agent: str, timeout: int = 30) -> str:
    """Plain HTTP GET returning decoded text, transparently gunzipping.

    Deliberately not Playwright: sitemaps are static XML, so spinning up a
    browser per sitemap would be pure overhead.
    """
    import gzip
    import urllib.request

    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    if url.endswith(".gz") or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw.decode("utf-8", errors="ignore")


def _local(tag: str) -> str:
    """Strip the XML namespace, so `{...sitemap/0.9}loc` -> `loc`."""
    return tag.rsplit("}", 1)[-1]


def expand_sitemaps(
    sitemap_urls: list[str],
    user_agent: str,
    url_pattern: str | None = None,
    max_urls: int = 2000,
    max_index_depth: int = 2,
) -> list[str]:
    """Resolve sitemap URLs (including <sitemapindex> files) into page URLs.

    Parsed with defusedxml because these are untrusted third-party documents
    and stdlib ElementTree is vulnerable to entity-expansion attacks.
    """
    from defusedxml import ElementTree as DefusedET

    pattern = re.compile(url_pattern) if url_pattern else None
    found: list[str] = []
    seen: set[str] = set()
    queue: list[tuple[str, int]] = [(u, 0) for u in sitemap_urls]

    while queue and len(found) < max_urls:
        sitemap_url, depth = queue.pop(0)
        if sitemap_url in seen:
            continue
        seen.add(sitemap_url)

        try:
            root = DefusedET.fromstring(_fetch_text(sitemap_url, user_agent))
        except Exception as exc:  # noqa: BLE001 - reported, never fatal
            print(
                json.dumps(
                    {"type": "error", "message": f"sitemap {sitemap_url}: {exc}"}
                ),
                flush=True,
            )
            continue

        is_index = _local(root.tag) == "sitemapindex"
        for child in root:
            if _local(child.tag) not in ("url", "sitemap"):
                continue
            loc = next((c.text for c in child if _local(c.tag) == "loc"), None)
            if not loc:
                continue
            loc = loc.strip()

            if is_index:
                # A sitemap index points at further sitemaps, not pages.
                if depth < max_index_depth:
                    queue.append((loc, depth + 1))
                continue

            # A <url> may carry hreflang alternates, and the canonical <loc>
            # is not necessarily the language we want. DAAD is exactly this
            # case: <loc> is the German page
            # (/de/21148-stipendiendatenbank/?detail=N) while the English one
            # (/en/21148-scholarship-database/?detail=N) is only reachable via
            # <xhtml:link hreflang="en">. Targeting <loc> alone silently
            # yields zero English scholarship pages.
            #
            # When a pattern is supplied it does the language selection, so
            # alternates are fair game. With no pattern we keep <loc> only —
            # otherwise every page would be emitted once per language.
            candidates = [loc]
            if pattern:
                candidates.extend(
                    c.attrib["href"]
                    for c in child
                    if _local(c.tag) == "link" and c.attrib.get("href")
                )

            for candidate in candidates:
                if pattern and not pattern.search(candidate):
                    continue
                if candidate in seen:
                    continue
                seen.add(candidate)
                found.append(candidate)
                if len(found) >= max_urls:
                    break
            if len(found) >= max_urls:
                break

    return found


class RobotsCache:
    def __init__(self) -> None:
        self._parsers: dict[str, robotparser.RobotFileParser] = {}

    def allowed(self, url: str, user_agent: str) -> bool:
        import urllib.request
        import urllib.error

        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self._parsers:
            robots_url = urljoin(origin, "/robots.txt")
            rp = robotparser.RobotFileParser()
            rp.set_url(robots_url)
            try:
                # robotparser.read() uses urllib with no User-Agent header,
                # which some sites (e.g. WordPress security plugins) 403
                # even though the actual robots.txt content permits
                # crawling — fetch it ourselves with our declared UA so a
                # bare-urllib block doesn't get misread as "disallow all".
                req = urllib.request.Request(robots_url, headers={"User-Agent": user_agent})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    lines = resp.read().decode("utf-8", errors="ignore").splitlines()
                rp.parse(lines)
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    # Per RFC 9309 convention, treat an auth-walled robots.txt
                    # as fully disallowed.
                    rp.disallow_all = True
                else:
                    # 404 etc. — no robots.txt means no restrictions.
                    rp.allow_all = True
            except Exception:
                # Network failure fetching robots.txt — fail open (many
                # sites simply don't have one); rate limit + page cap below
                # remain the politeness backstop regardless.
                self._parsers[origin] = None  # type: ignore[assignment]
                return True
            self._parsers[origin] = rp
        rp = self._parsers[origin]
        if rp is None:
            return True
        return rp.can_fetch(user_agent, url)


class Crawl4AICrawler:
    """Crawler contract implementation backed by Crawl4AI's AsyncWebCrawler."""

    def __init__(self) -> None:
        self._robots = RobotsCache()

    async def crawl_page(
        self,
        url: str,
        user_agent: str | None = None,
        timeout_ms: int = 30000,
        delay_before_return_html: float = 2.0,
    ) -> CrawlResult:
        browser_cfg = BrowserConfig(
            headless=True,
            user_agent=user_agent
            or SiteCrawlConfig(seed_urls=[]).user_agent,
        )
        run_cfg = CrawlerRunConfig(
            page_timeout=timeout_ms, delay_before_return_html=delay_before_return_html
        )
        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            result = await crawler.arun(url=url, config=run_cfg)
            markdown = result.markdown.raw_markdown if result.markdown else None
            return CrawlResult(
                url=url,
                http_status=result.status_code,
                html=result.html if result.success else None,
                markdown=markdown,
                metadata={
                    "title": getattr(result, "metadata", {}).get("title")
                    if getattr(result, "metadata", None)
                    else None,
                },
                fetched_at=_now_iso(),
                checksum=_checksum(markdown) if markdown else None,
                success=result.success,
                error=None if result.success else str(result.error_message),
            )

    def extract_links(self, html: str, base_url: str) -> list[str]:
        # Minimal href extraction — good enough for same-site link discovery
        # without pulling in a full HTML parser dependency here (extraction
        # of *content* happens later, from Markdown, not this step).
        hrefs = re.findall(r'href=["\']([^"\'#]+)', html or "")
        links = []
        seen = set()
        for href in hrefs:
            absolute = urljoin(base_url, href)
            if absolute not in seen:
                seen.add(absolute)
                links.append(absolute)
        return links

    async def crawl_site(
        self,
        config: SiteCrawlConfig,
        on_result=None,
        skip_urls: set[str] | None = None,
    ) -> list[CrawlResult]:
        """Crawl a site breadth-first.

        `on_result` is invoked with each CrawlResult the moment it is
        fetched. Callers use it to persist pages as they arrive: a long crawl
        that is interrupted then keeps everything it already fetched, instead
        of discarding hours of work. `skip_urls` lets a re-run resume by
        omitting URLs already collected by a previous run.
        """
        results: list[CrawlResult] = []
        visited: set[str] = set(skip_urls or ())
        resumed_count = len(visited)

        # Sitemap-discovered URLs join the frontier as depth-0 seeds: they are
        # already the exact pages we want, so they must not be subject to
        # max_depth pruning the way BFS-discovered links are.
        discovered: list[str] = []
        if config.sitemap_urls:
            discovered = expand_sitemaps(
                config.sitemap_urls,
                user_agent=config.user_agent,
                url_pattern=config.sitemap_url_pattern,
                max_urls=config.sitemap_max_urls,
            )
            print(
                json.dumps(
                    {
                        "type": "sitemap",
                        "sitemaps": len(config.sitemap_urls),
                        "urlsDiscovered": len(discovered),
                    }
                ),
                flush=True,
            )

        seeds = list(dict.fromkeys([*config.seed_urls, *discovered]))
        queue: list[tuple[str, int]] = [(url, 0) for url in seeds]

        browser_cfg = BrowserConfig(headless=True, user_agent=config.user_agent)
        run_cfg = CrawlerRunConfig(
            page_timeout=30000, delay_before_return_html=config.delay_before_return_html
        )

        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            while queue and len(results) < config.max_pages:
                url, depth = queue.pop(0)
                if url in visited:
                    continue
                visited.add(url)

                if config.respect_robots_txt and not self._robots.allowed(
                    url, config.user_agent
                ):
                    results.append(
                        CrawlResult(
                            url=url,
                            http_status=None,
                            html=None,
                            markdown=None,
                            metadata={},
                            fetched_at=_now_iso(),
                            checksum=None,
                            success=False,
                            error="disallowed by robots.txt",
                        )
                    )
                    continue

                result = await crawler.arun(url=url, config=run_cfg)
                markdown = result.markdown.raw_markdown if result.markdown else None
                crawl_result = CrawlResult(
                    url=url,
                    http_status=result.status_code,
                    html=result.html if result.success else None,
                    markdown=markdown,
                    metadata={},
                    fetched_at=_now_iso(),
                    checksum=_checksum(markdown) if markdown else None,
                    success=result.success,
                    error=None if result.success else str(result.error_message),
                )
                results.append(crawl_result)
                if on_result is not None:
                    on_result(crawl_result)

                print(
                    json.dumps(
                        {
                            "type": "progress",
                            "url": url,
                            "success": crawl_result.success,
                            "pagesCrawled": len(results),
                            "maxPages": config.max_pages,
                        }
                    ),
                    flush=True,
                )

                if crawl_result.success and depth < config.max_depth and crawl_result.html:
                    for link in self.extract_links(crawl_result.html, url):
                        if link not in visited and _matches_patterns(
                            link,
                            config.include_patterns,
                            config.exclude_patterns,
                            config.pattern_syntax,
                        ):
                            queue.append((link, depth + 1))

                if config.rate_limit_ms:
                    await asyncio.sleep(config.rate_limit_ms / 1000)

        return results
