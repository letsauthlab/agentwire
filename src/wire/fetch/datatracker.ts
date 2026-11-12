import { z } from "zod";
import { type Adapter, type RawItem, targetOf, toInstant } from "./adapter";

const ORIGIN = "https://datatracker.ietf.org";
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

const documentSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  rev: z.string().regex(/^\d{2}$/),
  title: z.string().min(1),
  time: z.string(),
  abstract: z.string().default(""),
});

const pageSchema = z.object({
  meta: z.object({ next: z.string().nullable() }),
  objects: z.array(z.unknown()),
});

/**
 * Reads one page of the datatracker's document list. Each active draft becomes one item per
 * revision: the address holds the revision, so a new revision is a new item. A document the
 * schema does not accept is skipped.
 */
export function parseDocuments(json: string): { items: RawItem[]; next: string | null } {
  const page = pageSchema.parse(JSON.parse(json));
  const items: RawItem[] = [];
  for (const object of page.objects) {
    const parsed = documentSchema.safeParse(object);
    if (!parsed.success) continue;
    const doc = parsed.data;
    const published = toInstant(doc.time);
    items.push({
      url: `${ORIGIN}/doc/${doc.name}/${doc.rev}/`,
      title: `${doc.title.replace(/\s+/g, " ").trim()} (${doc.name}-${doc.rev})`,
      text: doc.abstract,
      complete: true,
      ...(published ? { published } : {}),
    });
  }
  return { items, next: page.meta.next };
}

/**
 * The active drafts of one IETF working group, from the datatracker API. The fetch target is
 * the group's acronym. The date of an item is the document's last change, which for a new
 * revision is the day it was posted.
 */
export const datatrackerAdapter: Adapter = {
  async fetch(source, context) {
    const group = targetOf(source);
    if (!/^[a-z0-9]+$/.test(group)) throw new Error(`${source.id}: not a group acronym`);
    const query = new URLSearchParams({
      group__acronym: group,
      type: "draft",
      states__type: "draft",
      states__slug: "active",
      limit: String(PAGE_SIZE),
      format: "json",
    });
    const items: RawItem[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      query.set("offset", String(page * PAGE_SIZE));
      const url = `${ORIGIN}/api/v1/doc/document/?${query}`;
      // Only the first page is conditional: a group with more than one page is rare.
      const response = await context.get(url, { conditional: page === 0 });
      if (response.status === 304) break;
      const parsed = parseDocuments(response.body);
      items.push(...parsed.items);
      if (parsed.next === null) break;
    }
    return items;
  },
};
