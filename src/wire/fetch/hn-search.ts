import { z } from "zod";
import type { Source } from "../../schema/source";
import { type Adapter, type RawItem, targetOf, toInstant } from "./adapter";

const HITS_PER_PAGE = 1000;
const MAX_REQUESTS = 10;
/** How far back the first run looks. Later runs continue where the last one stopped. */
const FIRST_RUN_DAYS = 3;

const hitSchema = z.object({
  objectID: z.string().regex(/^\d+$/),
  title: z.string().min(1),
  url: z.string().min(1),
  created_at_i: z.number().int(),
});

const answerSchema = z.object({ hits: z.array(z.unknown()) });

/**
 * What a submission must link to: the site of a source that can start a story. For GitHub it
 * is the repository, because the host alone would match all of GitHub.
 */
export function linkTargets(sources: readonly Source[]): string[] {
  const targets = new Set<string>();
  for (const source of sources) {
    if (source.tier === "reactions") continue;
    const url = new URL(source.url);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "github.com") {
      const [owner, repository] = url.pathname.split("/").filter(Boolean);
      if (owner && repository) targets.add(`github.com/${owner}/${repository}`.toLowerCase());
    } else {
      targets.add(host);
    }
  }
  return [...targets];
}

function linksTo(link: string, targets: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = `${host}${url.pathname}`.toLowerCase();
  return targets.some((t) =>
    t.includes("/") ? path === t || path.startsWith(`${t}/`) : host === t || host.endsWith(`.${t}`),
  );
}

/**
 * Reads one answer of the Hacker News search API and keeps the submissions that link to one of
 * `targets`. The item is the discussion page; the submitted address is its link. Also returns
 * the creation time of the oldest hit, to ask for the hits before it.
 */
export function parseHits(
  json: string,
  targets: readonly string[],
): { items: RawItem[]; count: number; oldest: number | undefined } {
  const answer = answerSchema.parse(JSON.parse(json));
  const items: RawItem[] = [];
  let oldest: number | undefined;
  for (const entry of answer.hits) {
    const created = z.object({ created_at_i: z.number().int() }).safeParse(entry);
    if (created.success && (oldest === undefined || created.data.created_at_i < oldest)) {
      oldest = created.data.created_at_i;
    }
    const parsed = hitSchema.safeParse(entry);
    if (!parsed.success || !linksTo(parsed.data.url, targets)) continue;
    const hit = parsed.data;
    const published = toInstant(new Date(hit.created_at_i * 1000).toISOString());
    items.push({
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      title: hit.title,
      links: [hit.url],
      complete: true,
      ...(published ? { published } : {}),
    });
  }
  return { items, count: answer.hits.length, oldest };
}

/**
 * Hacker News submissions that link to a first-level source, as reactions. The fetch target is
 * the search endpoint. One request returns every new submission since the last run, newest
 * first; the wire keeps those whose address is on a source's site. A long gap is read in
 * steps of 1000 hits, back in time.
 */
export const hnSearchAdapter: Adapter = {
  async fetch(source, context) {
    const endpoint = targetOf(source);
    const targets = linkTargets(context.sources);
    const now = Math.floor(context.now.getTime() / 1000);
    const since = context.position.since
      ? Math.floor(Date.parse(context.position.since) / 1000)
      : now - FIRST_RUN_DAYS * 86_400;

    const items: RawItem[] = [];
    let until = now;
    for (let request = 0; request < MAX_REQUESTS; request++) {
      const query = new URLSearchParams({
        tags: "story",
        numericFilters: `created_at_i>${since},created_at_i<=${until}`,
        hitsPerPage: String(HITS_PER_PAGE),
      });
      const response = await context.get(`${endpoint}?${query}`);
      const parsed = parseHits(response.body, targets);
      items.push(...parsed.items);
      if (parsed.count < HITS_PER_PAGE || parsed.oldest === undefined) break;
      until = parsed.oldest - 1;
    }
    context.position.since = new Date(now * 1000).toISOString();
    return items;
  },
};
