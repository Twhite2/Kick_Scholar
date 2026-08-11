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
    )

    run_timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = RAW_DIR / args.source_id / run_timestamp
    out_dir.mkdir(parents=True, exist_ok=True)

    log({"type": "start", "sourceId": args.source_id, "seedUrls": site_config.seed_urls, "maxPages": site_config.max_pages})

    crawler = Crawl4AICrawler()
    results = await crawler.crawl_site(site_config)

    manifest = {
        "sourceId": args.source_id,
        "runTimestamp": run_timestamp,
        "startedAt": results[0].fetched_at if results else None,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "pagesDiscovered": len(results),
        "pagesCrawled": sum(1 for r in results if r.success),
        "pagesFailed": sum(1 for r in results if not r.success),
        "documents": [],
    }

    for result in results:
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
        meta_path = out_dir / f"{h}.meta.json"
        meta_path.write_text(json.dumps({**doc_entry, "metadata": result.metadata}, indent=2), encoding="utf-8")
        manifest["documents"].append(doc_entry)

    manifest_path = out_dir / "manifest.json"
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
