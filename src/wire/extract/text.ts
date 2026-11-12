import { isTag, isText, type ChildNode as Node } from "domhandler";
import { DomUtils, parseDocument } from "htmlparser2";

export interface Extracted {
  text: string;
  /** The https addresses the text links to, in order, without repeats. */
  links: string[];
}

export interface ExtractOptions {
  /** The address of the page, to resolve relative links. */
  baseUrl?: string;
  maxChars?: number;
  maxLinks?: number;
}

export const MAX_TEXT_CHARS = 20_000;
const MAX_LINKS = 50;

/** Elements that never hold article text. */
const SKIPPED = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "svg",
  "iframe",
  "button",
  "select",
  "dialog",
  "head",
]);

/** Elements that end a line. */
const BLOCKS = new Set([
  "p",
  "div",
  "section",
  "article",
  "main",
  "br",
  "li",
  "ul",
  "ol",
  "tr",
  "table",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "figure",
  "figcaption",
  "dt",
  "dd",
  "hr",
]);

/** Removes control and invisible format characters and tidies white space. Line breaks between blocks stay. */
export function cleanText(raw: string): string {
  return raw
    .replace(/[^\P{C}\n\t]/gu, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function walk(nodes: Node[], out: { text: string[]; links: string[] }, baseUrl?: string): void {
  for (const node of nodes) {
    if (isText(node)) {
      out.text.push(node.data);
      continue;
    }
    if (!isTag(node)) continue;
    const name = node.name.toLowerCase();
    if (SKIPPED.has(name)) continue;
    const href = name === "a" ? node.attribs.href : undefined;
    if (href) {
      const link = httpsLink(href, baseUrl);
      if (link) out.links.push(link);
    }
    const block = BLOCKS.has(name);
    if (block) out.text.push("\n");
    walk(node.children, out, baseUrl);
    if (block) out.text.push("\n");
  }
}

function httpsLink(href: string, baseUrl?: string): string | undefined {
  try {
    const url = new URL(href, baseUrl);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function render(nodes: Node[], baseUrl?: string): Extracted {
  const out = { text: [] as string[], links: [] as string[] };
  walk(nodes, out, baseUrl);
  return { text: cleanText(out.text.join("")), links: [...new Set(out.links)] };
}

function cap(found: Extracted, options: ExtractOptions): Extracted {
  return {
    text: found.text.slice(0, options.maxChars ?? MAX_TEXT_CHARS).trimEnd(),
    links: found.links.slice(0, options.maxLinks ?? MAX_LINKS),
  };
}

/** The text and links of a piece of HTML, such as the content a feed carries for an item. */
export function htmlToText(html: string, options: ExtractOptions = {}): Extracted {
  return cap(render(parseDocument(html).children, options.baseUrl), options);
}

/**
 * The article text of a whole page, without navigation and scripts. The longest `<article>`
 * is taken, else `<main>`, else the body.
 */
export function extractArticle(html: string, options: ExtractOptions = {}): Extracted {
  const doc = parseDocument(html);
  const candidates = (tag: string) =>
    DomUtils.getElementsByTagName(tag, doc.children, true).map((el) =>
      render(el.children, options.baseUrl),
    );
  const longest = (found: Extracted[]) =>
    found.reduce<Extracted | undefined>(
      (best, f) => (!best || f.text.length > best.text.length ? f : best),
      undefined,
    );
  const found =
    longest(candidates("article")) ??
    longest(candidates("main")) ??
    render(doc.children, options.baseUrl);
  return cap(found, options);
}

/** The https addresses written out in plain text or Markdown, such as release notes. */
export function linksInText(text: string, maxLinks = MAX_LINKS): string[] {
  const found = text.match(/https:\/\/[^\s<>()[\]"'`]+/g) ?? [];
  const links: string[] = [];
  for (const raw of found) {
    const link = httpsLink(raw.replace(/[.,;:!?]+$/, ""));
    if (link && !links.includes(link)) links.push(link);
    if (links.length >= maxLinks) break;
  }
  return links;
}
