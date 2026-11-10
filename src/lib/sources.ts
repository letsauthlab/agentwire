import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { type Source, sourceSchema } from "../schema/source";

export interface SourcesResult {
  sources: Source[];
  /** One line per problem, each naming the entry it is about. Empty when the file is valid. */
  errors: string[];
}

/** Reads and checks a sources file: the schema, unique ids, and alphabetical order by id. */
export function readSources(path: string): SourcesResult {
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) return { sources: [], errors: [`${path}: expected a list of sources`] };

  const sources: Source[] = [];
  const errors: string[] = [];
  raw.forEach((entry, index) => {
    const parsed = sourceSchema.safeParse(entry);
    const label = typeof entry?.id === "string" ? entry.id : `entry ${index + 1}`;
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${label}: ${issue.path.join(".") || "(entry)"}: ${issue.message}`);
      }
      return;
    }
    sources.push(parsed.data);
  });

  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.id)) errors.push(`${s.id}: id is used more than once`);
    seen.add(s.id);
  }
  // Source lists are alphabetical, so the file order carries no judgement (docs/DECISIONS.md).
  for (let i = 1; i < sources.length; i++) {
    const prev = sources[i - 1];
    const cur = sources[i];
    if (prev && cur && prev.id > cur.id) {
      errors.push(`${cur.id}: out of order, it sorts before ${prev.id}`);
    }
  }
  return { sources, errors };
}
