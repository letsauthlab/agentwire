import type { Source } from "../../schema/source";
import type { Position } from "../state";

/** One item as an adapter found it, before it is normalised. All of it is untrusted. */
export interface RawItem {
  url: string;
  title: string;
  /** When the source says the item was published. Missing or unreadable dates are left out. */
  published?: string;
  /** The item's content as HTML, where the source sends HTML. */
  html?: string;
  /** The item's content as plain text or Markdown, where the source sends that. */
  text?: string;
  /** Addresses the item points to that are not in its content. */
  links?: string[];
  /**
   * True when the source sent all the text there is, so the item's page is not fetched even if
   * the text is short.
   */
  complete?: boolean;
}

export interface AdapterResponse {
  status: number;
  body: string;
}

export interface AdapterGetOptions {
  headers?: Record<string, string>;
  /** Remember the validators of this address and send them the next time. */
  conditional?: boolean;
  minIntervalMs?: number;
  robotsExempt?: boolean;
}

export interface AdapterContext {
  /** A polite, guarded GET. Throws on any status other than 200 and 304. */
  get(url: string, options?: AdapterGetOptions): Promise<AdapterResponse>;
  now: Date;
  /** This source's position. Changes are kept only when the whole source succeeded. */
  position: Position;
  /** The sources of this run, for an adapter that looks for reactions to them. */
  sources: readonly Source[];
}

/** Reads one kind of source. */
export interface Adapter {
  fetch(source: Source, context: AdapterContext): Promise<RawItem[]>;
}

/** The fetch target of a source, or an error that names the source. */
export function targetOf(source: Source): string {
  if (source.fetch === undefined) throw new Error(`${source.id}: no fetch target`);
  return source.fetch;
}

/** An ISO instant for a date a source wrote, or undefined when it cannot be read. */
export function toInstant(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}
