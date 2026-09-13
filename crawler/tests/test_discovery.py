"""Pure (no-network) tests for sitemap discovery and URL pattern matching.

Deliberately stdlib-only so it runs with `python crawler/tests/test_discovery.py`
without adding a test dependency to the crawler venv.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from crawl4ai_crawler import _matches_patterns, expand_sitemaps  # noqa: E402

# Mirrors the real DAAD shape: <loc> is the GERMAN page and the English one is
# reachable only via <xhtml:link hreflang="en">. Targeting <loc> alone yields
# zero English scholarship pages — the regression this file exists to prevent.
DAAD_SHAPED = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www2.daad.de/deutschland/stipendium/datenbank/de/21148-stipendiendatenbank/?detail=10000092</loc>
    <xhtml:link rel="alternate" hreflang="en"
      href="https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=10000092"/>
  </url>
  <url>
    <loc>https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/3589/</loc>
  </url>
</urlset>
"""

SITEMAP_INDEX = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/post-sitemap1.xml</loc></sitemap>
</sitemapindex>
"""

CHILD_SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/a-scholarship/</loc></url>
  <url><loc>https://example.com/tag/europe/</loc></url>
</urlset>
"""


def _fake_fetch(pages: dict[str, str]):
    def inner(url: str, user_agent: str, timeout: int = 30) -> str:
        return pages[url]

    return inner


def test_finds_english_url_in_hreflang_alternate() -> None:
    with patch(
        "crawl4ai_crawler._fetch_text",
        _fake_fetch({"https://s/sitemap.xml": DAAD_SHAPED}),
    ):
        found = expand_sitemaps(
            ["https://s/sitemap.xml"],
            "UA",
            url_pattern=r"/en/21148-scholarship-database/\?detail=\d+",
        )
    assert len(found) == 1, found
    assert "/en/21148-scholarship-database/?detail=10000092" in found[0]


def test_loc_only_when_no_pattern_given() -> None:
    """Without a pattern, alternates must not be emitted — otherwise every
    page appears once per language."""
    with patch(
        "crawl4ai_crawler._fetch_text",
        _fake_fetch({"https://s/sitemap.xml": DAAD_SHAPED}),
    ):
        found = expand_sitemaps(["https://s/sitemap.xml"], "UA")
    assert len(found) == 2, found
    assert all("/de/" in u or "/en/detail" in u or "international" in u for u in found)


def test_recurses_into_sitemap_index() -> None:
    with patch(
        "crawl4ai_crawler._fetch_text",
        _fake_fetch(
            {
                "https://example.com/sitemap_index.xml": SITEMAP_INDEX,
                "https://example.com/post-sitemap1.xml": CHILD_SITEMAP,
            }
        ),
    ):
        found = expand_sitemaps(["https://example.com/sitemap_index.xml"], "UA")
    assert "https://example.com/a-scholarship/" in found


def test_respects_max_urls_cap() -> None:
    with patch(
        "crawl4ai_crawler._fetch_text",
        _fake_fetch(
            {
                "https://example.com/sitemap_index.xml": SITEMAP_INDEX,
                "https://example.com/post-sitemap1.xml": CHILD_SITEMAP,
            }
        ),
    ):
        found = expand_sitemaps(["https://example.com/sitemap_index.xml"], "UA", max_urls=1)
    assert len(found) == 1


def test_unreachable_sitemap_is_reported_not_fatal() -> None:
    def boom(url: str, user_agent: str, timeout: int = 30) -> str:
        raise OSError("connection refused")

    with patch("crawl4ai_crawler._fetch_text", boom):
        assert expand_sitemaps(["https://dead/sitemap.xml"], "UA") == []


def test_pattern_matching_modes() -> None:
    url = "https://www2.daad.de/en/x"
    assert _matches_patterns(url, ["daad.de/en/"], [], "substring")
    assert _matches_patterns(url, [r"^https://www2\.daad\.de/"], [], "regex")
    # Substring matching cannot anchor, so a hostile URL embedding the pattern
    # passes; regex can reject it.
    spoof = "https://evil.com/?u=daad.de/en/"
    assert _matches_patterns(spoof, ["daad.de/en/"], [], "substring")
    assert not _matches_patterns(spoof, [r"^https://www2\.daad\.de/"], [], "regex")


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS  {name}")
            except AssertionError as exc:
                failures += 1
                print(f"  FAIL  {name}: {exc}")
    print(f"\n{'FAILED' if failures else 'All discovery tests passed'}")
    sys.exit(1 if failures else 0)
