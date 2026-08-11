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


def _matches_patterns(url: str, include: list[str], exclude: list[str]) -> bool:
    if exclude and any(pat in url for pat in exclude):
        return False
    if include and not any(pat in url for pat in include):
        return False
    return True


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

    async def crawl_site(self, config: SiteCrawlConfig) -> list[CrawlResult]:
        results: list[CrawlResult] = []
        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(url, 0) for url in config.seed_urls]

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
                            link, config.include_patterns, config.exclude_patterns
                        ):
                            queue.append((link, depth + 1))

                if config.rate_limit_ms:
                    await asyncio.sleep(config.rate_limit_ms / 1000)

        return results
