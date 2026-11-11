import { createHash } from "node:crypto";

/** Query parameters that track a click and never change the page. */
const TRACKING = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|_hsenc|_hsmi)$/i;

/**
 * The one address an item is known by: https, no fragment, no tracking parameters. Returns
 * undefined for anything that is not a plain https address; such an item is not kept.
 */
export function canonicalUrl(raw: string, base?: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return undefined;
  url.hash = "";
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING.test(name)) url.searchParams.delete(name);
  }
  if (url.search === "?") url.search = "";
  return url.href;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** The key under which a canonical address is remembered. */
export const urlKey = (canonical: string): string => `u:${digest(canonical)}`;

/** A hash of what an item says, so the same text at a second address is noticed. */
export function contentHash(title: string, text: string): string {
  const tidy = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return digest(`${tidy(title)}\n${tidy(text)}`);
}

export const contentKey = (hash: string): string => `c:${hash}`;
