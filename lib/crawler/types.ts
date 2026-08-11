/**
 * Conceptual contract every crawler implementation should honor, regardless
 * of language/runtime. Crawl4AICrawler (crawler/crawl4ai_crawler.py) is the
 * first and only implementation today; a future implementation (a different
 * crawl engine entirely) could replace it without this contract — or
 * runCrawlJob.ts, which only talks to it via the CLI + manifest.json below —
 * needing to change.
 */
export interface CrawlOptions {
  timeoutMs?: number;
  userAgent?: string;
}

export interface CrawlResult {
  url: string;
  httpStatus: number | null;
  html: string | null;
  markdown: string | null;
  metadata: Record<string, unknown>;
  fetchedAt: string;
  checksum: string | null;
  success: boolean;
  error?: string | null;
}

export interface Crawler {
  crawlPage(url: string, options?: CrawlOptions): Promise<CrawlResult>;
  crawlSite(config: { seedUrls: string[] }): Promise<CrawlResult[]>;
  extractLinks(html: string, baseUrl: string): string[];
}

/** Shape of crawler/run_crawl.py's manifest.json — the actual Node/Python boundary. */
export interface CrawlManifest {
  sourceId: string;
  runTimestamp: string;
  startedAt: string | null;
  finishedAt: string;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesFailed: number;
  documents: Array<{
    url: string;
    httpStatus: number | null;
    fetchedAt: string;
    success: boolean;
    error: string | null;
    checksum: string | null;
    rawHtmlPath: string | null;
    markdownPath: string | null;
  }>;
}
