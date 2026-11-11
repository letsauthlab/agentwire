import type { Source } from "../../schema/source";
import { canonicalUrl, contentHash, contentKey, urlKey } from "../dedupe/canonical";
import {
  cleanText,
  extractArticle,
  htmlToText,
  linksInText,
  MAX_TEXT_CHARS,
} from "../extract/text";
import type { ClientResponse } from "../http/client";
import { type PoliteFetcher, validatorsOf } from "../http/polite";
import { type WireItem, wireItemSchema } from "../item";
import type { Position, State } from "../state";
import type { AdapterContext, RawItem } from "./adapter";
import { ADAPTERS } from "./index";

/** What happened to one source in one run. */
export interface SourceReport {
  id: string;
  /** Items the adapter read from the source. */
  fetched: number;
  /** Items written by this run. */
  fresh: number;
  /** Items dropped because their address or text was seen before. */
  seen: number;
  /** Items dropped because they were published too long ago to be news. */
  old: number;
  /** Items dropped because they had no usable address or headline. */
  failed: number;
  /** Set when the source itself could not be fetched or parsed. */
  error?: string;
}

export interface RunOptions {
  sources: readonly Source[];
  /** Read at the start and changed in place. The caller writes it at the end. */
  state: State;
  fetcher: PoliteFetcher;
  now: () => Date;
  /** Also fetch `proposed` sources that have a fetch target. For the run that verifies them. */
  includeProposed?: boolean;
  /** Fetch only these source ids. */
  only?: readonly string[];
  /** Items published longer ago than this are not news and are dropped. */
  maxAgeDays?: number;
  onReport?: (report: SourceReport) => void;
}

export interface RunResult {
  items: WireItem[];
  reports: SourceReport[];
}

const FEED_MAX_BYTES = 10_000_000;
const PAGE_MAX_BYTES = 3_000_000;
const MAX_TITLE_CHARS = 300;
const MAX_LINKS = 50;
/** A feed item with less text than this is a teaser, and its page is fetched. */
const TEASER_CHARS = 500;
/** Texts shorter than this are too alike to prove two items are the same. */
const MIN_HASHED_CHARS = 200;
const DEFAULT_MAX_AGE_DAYS = 30;

function decode(response: ClientResponse): string {
  const declared =
    /charset=["']?([\w-]+)/i.exec(response.headers["content-type"] ?? "")?.[1] ??
    /^<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(
      new TextDecoder("latin1").decode(response.body.subarray(0, 200)),
    )?.[1];
  try {
    return new TextDecoder(declared ?? "utf-8").decode(response.body);
  } catch {
    return new TextDecoder().decode(response.body);
  }
}

/** An error as one short line that is safe to print: it can quote text from a source. */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return cleanText(message).replace(/\n/g, " ").slice(0, 160);
}

function selected(options: RunOptions): Source[] {
  return options.sources
    .filter((s) => s.adapter !== undefined && s.fetch !== undefined)
    .filter((s) => s.status === "verified" || (options.includeProposed && s.status === "proposed"))
    .filter((s) => !options.only || options.only.includes(s.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function contextFor(source: Source, position: Position, options: RunOptions): AdapterContext {
  return {
    now: options.now(),
    position,
    sources: options.sources.filter((s) => s.status !== "disabled"),
    async get(url, get = {}) {
      const response = await options.fetcher.get(url, {
        headers: get.headers,
        validators: get.conditional ? position.validators[url] : undefined,
        minIntervalMs: get.minIntervalMs,
        robotsExempt: get.robotsExempt,
        maxBytes: FEED_MAX_BYTES,
      });
      if (response.status === 304) return { status: 304, body: "" };
      if (response.status !== 200) throw new Error(`${source.id}: status ${response.status}`);
      if (get.conditional) {
        const validators = validatorsOf(response);
        if (validators) position.validators[url] = validators;
        else delete position.validators[url];
      }
      return { status: 200, body: decode(response) };
    },
  };
}

/** The article text of an item's page, or undefined when the page cannot be read politely. */
async function pageText(url: string, fetcher: PoliteFetcher) {
  try {
    const response = await fetcher.get(url, {
      headers: { accept: "text/html" },
      maxBytes: PAGE_MAX_BYTES,
    });
    if (response.status !== 200) return undefined;
    if (!/html/i.test(response.headers["content-type"] ?? "")) return undefined;
    return extractArticle(decode(response), { baseUrl: response.url });
  } catch {
    return undefined;
  }
}

function canonicalLinks(links: readonly string[], self: string): string[] {
  const out = new Set<string>();
  for (const link of links) {
    const canonical = canonicalUrl(link);
    if (canonical && canonical !== self) out.add(canonical);
  }
  return [...out].slice(0, MAX_LINKS);
}

async function normalise(
  raw: RawItem,
  source: Source,
  report: SourceReport,
  options: RunOptions,
): Promise<WireItem | undefined> {
  const now = options.now();
  const url = canonicalUrl(raw.url);
  const title = cleanText(raw.title).replace(/\n/g, " ").slice(0, MAX_TITLE_CHARS).trim();
  if (!url || title === "") {
    report.failed++;
    return undefined;
  }
  // A source without dates, or with one in the future, gets the time the item was first seen.
  const stated = raw.published ? Date.parse(raw.published) : Number.NaN;
  const published = Number.isNaN(stated) || stated > now.getTime() ? now : new Date(stated);
  const maxAgeMs = (options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS) * 86_400_000;
  if (now.getTime() - published.getTime() > maxAgeMs) {
    report.old++;
    return undefined;
  }
  const seen = options.state.seen;
  if (seen[urlKey(url)]) {
    report.seen++;
    return undefined;
  }

  let { text, links } = raw.html
    ? htmlToText(raw.html, { baseUrl: url })
    : {
        text: cleanText(raw.text ?? "").slice(0, MAX_TEXT_CHARS),
        links: linksInText(raw.text ?? ""),
      };
  links = [...(raw.links ?? []), ...links];
  if (!raw.complete && text.length < TEASER_CHARS) {
    const page = await pageText(url, options.fetcher);
    if (page && page.text.length > text.length) {
      text = page.text;
      links = [...links, ...page.links];
    }
  }

  const stamp = now.toISOString();
  const hash = contentHash(title, text);
  seen[urlKey(url)] = stamp;
  if (text.length >= MIN_HASHED_CHARS) {
    if (seen[contentKey(hash)]) {
      report.seen++;
      return undefined;
    }
    seen[contentKey(hash)] = stamp;
  }
  report.fresh++;
  return wireItemSchema.parse({
    url,
    title,
    source: source.id,
    published: published.toISOString(),
    fetched: stamp,
    hash,
    text,
    links: canonicalLinks(links, url),
  });
}

/**
 * Runs the fetch stage once: every selected source is fetched, its items are normalised, and
 * what was seen before is dropped. A source that fails is reported and does not stop the run;
 * its position is left as it was, so the next run tries again.
 */
export async function runFetch(options: RunOptions): Promise<RunResult> {
  const items: WireItem[] = [];
  const reports: SourceReport[] = [];
  for (const source of selected(options)) {
    const report: SourceReport = {
      id: source.id,
      fetched: 0,
      fresh: 0,
      seen: 0,
      old: 0,
      failed: 0,
    };
    const position = structuredClone(options.state.sources[source.id] ?? { validators: {} });
    try {
      const adapter = ADAPTERS[source.adapter as keyof typeof ADAPTERS];
      const raw = await adapter.fetch(source, contextFor(source, position, options));
      report.fetched = raw.length;
      for (const item of raw) {
        const normalised = await normalise(item, source, report, options);
        if (normalised) items.push(normalised);
      }
      options.state.sources[source.id] = position;
    } catch (error) {
      report.error = describe(error);
    }
    reports.push(report);
    options.onReport?.(report);
  }
  return { items, reports };
}
