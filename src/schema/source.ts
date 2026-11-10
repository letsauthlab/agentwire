import { z } from "zod";

/** The topics a story can carry. A source names the ones its stories usually belong to. */
export const TOPICS = [
  "standards",
  "agent-protocols",
  "workload-identity",
  "authorization",
  "platforms",
  "research",
  "incidents",
  "policy",
] as const;

export const topicSchema = z.enum(TOPICS);

/** What kind of publisher a source is. It groups the source list and never affects ranking. */
export const SOURCE_KINDS = [
  "standards-body",
  "open-source",
  "public-body",
  "identity-vendor",
  "nhi-vendor",
  "platform",
  "research",
  "person",
  "community",
] as const;

/**
 * How much of a source is on topic. `core` sources pass the relevance check almost always;
 * `broad` sources pass a keyword prefilter and the full check; `reactions` sources never start a
 * story and only attach to one.
 */
export const SOURCE_TIERS = ["core", "broad", "reactions"] as const;

/** How the job reads a source. Set when the source is verified. */
export const ADAPTERS = [
  "feed",
  "datatracker",
  "github-releases",
  "arxiv",
  "hn-search",
  "lobsters",
] as const;

/**
 * `proposed`: named, but the job does not fetch it and its addresses are untested.
 * `verified`: the feed was fetched and parsed once by a person or by CI; the job fetches it.
 * `disabled`: switched off; the job skips it and its past stories stay.
 */
export const SOURCE_STATUSES = ["proposed", "verified", "disabled"] as const;

const httpsUrl = z.url({ protocol: /^https$/ });

export const sourceSchema = z
  .strictObject({
    /** Stable id: lower case letters, digits and hyphens. Never reused. */
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(1),
    /** The page a reader opens to see the source itself. */
    url: httpsUrl,
    kind: z.enum(SOURCE_KINDS),
    tier: z.enum(SOURCE_TIERS),
    topics: z.array(topicSchema).min(1),
    status: z.enum(SOURCE_STATUSES),
    adapter: z.enum(ADAPTERS).optional(),
    /** What the adapter fetches: a feed address, a working group acronym, a repository, a query. */
    fetch: z.string().min(1).optional(),
  })
  .refine((s) => s.status !== "verified" || (s.adapter !== undefined && s.fetch !== undefined), {
    message: "a verified source needs an adapter and a fetch target",
  });

export type Source = z.infer<typeof sourceSchema>;
export type Topic = z.infer<typeof topicSchema>;
