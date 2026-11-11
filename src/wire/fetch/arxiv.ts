import { type Adapter, type RawItem, targetOf } from "./adapter";
import { parseFeed } from "./feed";

const MAX_RESULTS = 100;
/** arXiv asks for one request every three seconds. */
const ARXIV_INTERVAL_MS = 3000;

/**
 * Reads the Atom answer of the arXiv API. The version is cut from the address, so a revised
 * paper is the same item. The abstract is all the text the wire takes from a paper.
 */
export function parsePapers(xml: string, queryUrl: string): RawItem[] {
  return parseFeed(xml, queryUrl).map((item) => ({
    ...item,
    url: item.url.replace(/^http:/, "https:").replace(/(\/abs\/[^/?#]+?)v\d+$/, "$1"),
    title: item.title,
    complete: true,
  }));
}

/**
 * A saved arXiv query, newest first. The fetch target is the query.
 *
 * `export.arxiv.org/robots.txt` says `Disallow: /`, but arXiv's API terms allow this use at
 * the documented rate, and the owner decided for the API (docs/briefs/02-wire-fetch.md). This
 * is the only request in the wire that skips the robots.txt check.
 */
export const arxivAdapter: Adapter = {
  async fetch(source, context) {
    const query = new URLSearchParams({
      search_query: targetOf(source),
      sortBy: "submittedDate",
      sortOrder: "descending",
      max_results: String(MAX_RESULTS),
    });
    const url = `https://export.arxiv.org/api/query?${query}`;
    const response = await context.get(url, {
      robotsExempt: true,
      minIntervalMs: ARXIV_INTERVAL_MS,
    });
    return parsePapers(response.body, url);
  },
};
