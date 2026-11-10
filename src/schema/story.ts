import { z } from "zod";
import { topicSchema } from "./source";

/** What a story is. Shown as a text badge. */
export const STORY_TYPES = [
  "draft",
  "release",
  "paper",
  "announcement",
  "incident",
  "opinion",
] as const;

const httpsUrl = z.url({ protocol: /^https$/ });
const instant = z.iso.datetime({ offset: true });

/** One fetched item: the primary item of a story, or a reaction to it. */
export const itemSchema = z.strictObject({
  /** The canonical address of the item. Always taken from the source, never from a model. */
  url: httpsUrl,
  /** The original headline, unchanged. */
  title: z.string().min(1),
  /** The id of the source in data/sources.yaml. */
  source: z.string().min(1),
  published: instant,
  fetched: instant,
});

/**
 * A summary and the model that wrote it. `text` is written only from the fetched text of the
 * primary item. It is null when that text was too short to summarise; the story then shows the
 * headline and the link alone.
 */
export const summarySchema = z.strictObject({
  text: z.string().min(1).nullable(),
  model: z.string().min(1),
  prompt: z.string().min(1),
});

/**
 * A story record. Records are append-only: a correction, a new reaction or a hidden story is a
 * newer record with the same id and a higher `revision`, and the site shows the newest one.
 */
export const storySchema = z.strictObject({
  /** Stable id, assigned when the story is first recorded. */
  id: z.string().regex(/^[a-z0-9]+$/),
  revision: z.number().int().min(1),
  recorded: instant,
  type: z.enum(STORY_TYPES),
  topics: z.array(topicSchema).min(1),
  primary: itemSchema,
  summary: summarySchema,
  reactions: z.array(itemSchema),
  /** Set by the block list. A hidden story is not rendered; its records stay in the data. */
  hidden: z.boolean().default(false),
});

export type Item = z.infer<typeof itemSchema>;
export type Story = z.infer<typeof storySchema>;
