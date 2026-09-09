#!/usr/bin/env python3
"""CLI entrypoint: crawl one configured source and write raw artifacts.

Usage:
    .venv/bin/python run_crawl.py --source-id src-studyinfo --config ../data/sources/configs/fi-studyinfo.json

Writes to data/raw/<sourceId>/<runTimestamp>/:
  - <url-hash>.html
  - <url-hash>.md
  - <url-hash>.meta.json
  - manifest.json   (list of all fetched docs + checksums + status)

Prints JSON-lines progress to stdout (both its own lines and the ones
crawl4ai_crawler.py emits per page) so the Node wrapper (lib/crawler/
runCrawlJob.ts) can parse it and update CrawlJob rows without polling files.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from crawl4ai_crawler import Crawl4AICrawler, SiteCrawlConfig

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"


def log(event: dict) -> None:
    print(json.dumps(event), flush=True)


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--config", required=True, help="Path to the source's JSON config")
    parser.add_argument("--max-pages", type=int, default=None, help="Override config maxPages")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip URLs already fetched successfully by earlier runs of this source",
    )
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = Path.cwd() / config_path
    raw_config = json.loads(config_path.read_text())

    if raw_config["id"] != args.source_id:
        log({"type": "error", "message": f"--source-id {args.source_id} does not match config id {raw_config['id']}"})
        return 1

    site_config = SiteCrawlConfig(
        seed_urls=raw_config["seedUrls"],
        include_patterns=raw_config.get("urlPatterns", {}).get("include", []),
        exclude_patterns=raw_config.get("urlPatterns", {}).get("exclude", []),
        max_depth=raw_config.get("maxDepth", 2),
        max_pages=args.max_pages or raw_config.get("maxPages", 25),
        rate_limit_ms=raw_config.get("rateLimitMs", 3000),
        respect_robots_txt=raw_config.get("respectRobotsTxt", True),
        delay_before_return_html=raw_config.get("delayBeforeReturnHtmlSeconds", 2.0),
        sitemap_urls=raw_config.get("sitemapUrls", []),
        sitemap_url_pattern=raw_config.get("sitemapUrlPattern"),
        sitemap_max_urls=raw_config.get("sitemapMaxUrls", 2000),
        pattern_syntax=raw_config.get("urlPatternMode", "substring"),
    )

    run_timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = RAW_DIR / args.source_id / run_timestamp
    out_dir.mkdir(parents=True, exist_ok=True)

    # Resume support: a long crawl that was interrupted leaves its pages on
    # disk. Collect every URL this source already fetched successfully so the
    # re-run skips them instead of paying for them twice.
    skip_urls: set[str] = set()
    if args.resume:
        for prior_meta in (RAW_DIR / args.source_id).glob("*/*.meta.json"):
            try:
                prior = json.loads(prior_meta.read_text(encoding="utf-8"))
            except Exception:
                continue
            if prior.get("success") and prior.get("url"):
                skip_urls.add(prior["url"])

    log(
        {
            "type": "start",
            "sourceId": args.source_id,
            "seedUrls": site_config.seed_urls,
            "maxPages": site_config.max_pages,
            "resumeSkipping": len(skip_urls),
        }
    )

    manifest = {
        "sourceId": args.source_id,
        "runTimestamp": run_timestamp,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "finishedAt": None,
        "pagesDiscovered": 0,
        "pagesCrawled": 0,
        "pagesFailed": 0,
        "documents": [],
    }
    manifest_path = out_dir / "manifest.json"

    def persist(result) -> None:
        """Write one page's artifacts the moment it is fetched.

        Previously every page was buffered in memory and written only after
        the whole crawl finished, so an interrupted run lost everything — two
        multi-hour crawls (687 and 416 pages) were discarded exactly this way.
        Writing incrementally means an interruption costs at most one page.
        """
        h = url_hash(result.url)
        doc_entry = {
            "url": result.url,
            "httpStatus": result.http_status,
            "fetchedAt": result.fetched_at,
            "success": result.success,
            "error": result.error,
            "checksum": result.checksum,
            "rawHtmlPath": None,
            "markdownPath": None,
        }
        if result.html:
            html_path = out_dir / f"{h}.html"
            html_path.write_text(result.html, encoding="utf-8")
            doc_entry["rawHtmlPath"] = str(html_path.relative_to(REPO_ROOT))
        if result.markdown:
            md_path = out_dir / f"{h}.md"
            md_path.write_text(result.markdown, encoding="utf-8")
            doc_entry["markdownPath"] = str(md_path.relative_to(REPO_ROOT))
        (out_dir / f"{h}.meta.json").write_text(
            json.dumps({**doc_entry, "metadata": result.metadata}, indent=2),
            encoding="utf-8",
        )

        manifest["documents"].append(doc_entry)
        manifest["pagesDiscovered"] = len(manifest["documents"])
        manifest["pagesCrawled"] = sum(1 for d in manifest["documents"] if d["success"])
        manifest["pagesFailed"] = sum(1 for d in manifest["documents"] if not d["success"])
        # Rewritten every page so the manifest is always a truthful record of
        # what is actually on disk, even if the process is killed next second.
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    crawler = Crawl4AICrawler()
    await crawler.crawl_site(site_config, on_result=persist, skip_urls=skip_urls)

    manifest["finishedAt"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    log(
        {
            "type": "complete",
            "sourceId": args.source_id,
            "manifestPath": str(manifest_path.relative_to(REPO_ROOT)),
            "pagesCrawled": manifest["pagesCrawled"],
            "pagesFailed": manifest["pagesFailed"],
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
