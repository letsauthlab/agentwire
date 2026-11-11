import { z } from "zod";
import { itemSchema } from "../schema/story";

/**
 * What the fetch stage writes for the later stages of the wire: an item of the story schema
 * plus its text. This shape is internal to the wire; readers only ever see story records.
 */
export const wireItemSchema = itemSchema.extend({
  /** A hash of the title and text. */
  hash: z.string().regex(/^[0-9a-f]{32}$/),
  /** The item's text, cleaned and capped. Untrusted: it comes from the source. */
  text: z.string(),
  /** The https addresses the item links to. A reaction joins a story through them. */
  links: z.array(z.url({ protocol: /^https$/ })),
});

export type WireItem = z.infer<typeof wireItemSchema>;
