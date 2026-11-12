import { type Element, isTag } from "domhandler";
import { DomUtils, parseDocument } from "htmlparser2";
import { type Adapter, type RawItem, targetOf, toInstant } from "./adapter";

const children = (el: Element, name: string): Element[] =>
  el.children.filter((c): c is Element => isTag(c) && c.name.toLowerCase() === name);

const text = (el: Element | undefined): string => (el ? DomUtils.textContent(el).trim() : "");

const first = (el: Element, ...names: string[]): string => {
  for (const name of names) {
    const value = text(children(el, name)[0]);
    if (value !== "") return value;
  }
  return "";
};

/** The content of an Atom element as HTML. `xhtml` content holds real elements. */
function atomHtml(el: Element | undefined): string {
  if (!el) return "";
  if (el.attribs.type === "xhtml") return DomUtils.getInnerHTML(el, { xmlMode: false });
  return text(el);
}

function atomLink(entry: Element): string {
  const links = children(entry, "link").filter((l) => l.attribs.href);
  const page = links.find((l) => (l.attribs.rel ?? "alternate") === "alternate") ?? links[0];
  return page?.attribs.href ?? "";
}

function rssLink(item: Element): string {
  const link = first(item, "link");
  if (link !== "") return link;
  const guid = children(item, "guid")[0];
  return guid && guid.attribs.isPermaLink !== "false" ? text(guid) : "";
}

const longest = (...values: string[]): string =>
  values.reduce((best, v) => (v.length > best.length ? v : best), "");

/** A headline can carry markup and entities; the reader gets its plain text. */
const plain = (value: string): string =>
  DomUtils.textContent(parseDocument(value)).replace(/\s+/g, " ").trim();

/**
 * The address of an entry. Some feeds served over https still write `http:` links to their own
 * site; those are read as https, because that host has just answered over https. A plain http
 * link to another host stays as it is and is dropped later.
 */
function itemUrl(link: string, feedUrl: string): string | undefined {
  try {
    const feed = new URL(feedUrl);
    const url = new URL(link, feed);
    const bare = (host: string) => host.replace(/^www\./, "");
    if (url.protocol === "http:" && url.port === "" && bare(url.hostname) === bare(feed.hostname)) {
      url.protocol = "https:";
    }
    return url.href;
  } catch {
    return undefined;
  }
}

/**
 * Reads an RSS 2.0, RSS 1.0 or Atom feed. An entry without a title or a link is left out.
 * `feedUrl` resolves relative links.
 */
export function parseFeed(xml: string, feedUrl: string): RawItem[] {
  const doc = parseDocument(xml, { xmlMode: true });
  const entries = DomUtils.findAll(
    (el) => ["item", "entry"].includes(el.name.toLowerCase()),
    doc.children,
  );
  if (
    entries.length === 0 &&
    DomUtils.findAll((el) => /^(rss|feed|rdf:rdf)$/i.test(el.name), doc.children).length === 0
  ) {
    throw new Error("not a feed");
  }
  const items: RawItem[] = [];
  for (const entry of entries) {
    const atom = entry.name.toLowerCase() === "entry";
    const title = plain(first(entry, "title"));
    const link = atom ? atomLink(entry) : rssLink(entry);
    if (title === "" || link === "") continue;
    const url = itemUrl(link, feedUrl);
    if (!url) continue;
    const html = atom
      ? longest(atomHtml(children(entry, "content")[0]), atomHtml(children(entry, "summary")[0]))
      : longest(first(entry, "content:encoded"), first(entry, "description"));
    const published = toInstant(first(entry, "published", "pubdate", "dc:date", "updated", "date"));
    items.push({ url, title, html, ...(published ? { published } : {}) });
  }
  return items;
}

/** RSS and Atom feeds. The fetch target is the address of the feed. */
export const feedAdapter: Adapter = {
  async fetch(source, context) {
    const target = targetOf(source);
    const response = await context.get(target, {
      conditional: true,
      headers: {
        accept: "application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.5",
      },
    });
    return response.status === 304 ? [] : parseFeed(response.body, target);
  },
};
