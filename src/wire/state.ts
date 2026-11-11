import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const validatorsSchema = z.strictObject({
  etag: z.string().optional(),
  lastModified: z.string().optional(),
});

const positionSchema = z.strictObject({
  /** Per fetched address: what the server sent to make the next request conditional. */
  validators: z.record(z.string(), validatorsSchema).default({}),
  /** Where a search stopped, for adapters that ask for "everything since". */
  since: z.iso.datetime({ offset: true }).optional(),
});

const stateSchema = z.strictObject({
  version: z.literal(1),
  /** The position in each source, by source id. */
  sources: z.record(z.string(), positionSchema).default({}),
  /** Keys of the addresses and texts seen so far, with the time they were first seen. */
  seen: z.record(z.string(), z.iso.datetime({ offset: true })).default({}),
});

export type Position = z.infer<typeof positionSchema>;
export type State = z.infer<typeof stateSchema>;

export const emptyState = (): State => ({ version: 1, sources: {}, seen: {} });

/** Reads the state file. A missing file is a first run; a broken one is an error. */
export function readState(path: string): State {
  if (!existsSync(path)) return emptyState();
  return stateSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/** Writes the state file in one step, so a crash never leaves half a file. */
export function writeState(path: string, state: State): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(stateSchema.parse(state))}\n`);
  renameSync(tmp, path);
}
