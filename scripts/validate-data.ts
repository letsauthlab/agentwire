import { resolve } from "node:path";
import { readSources } from "../src/lib/sources";

// Checks data/ against the schema. Run after any data edit; `pnpm build` runs it first.
const path = resolve(process.argv[2] ?? "data/sources.yaml");
const { sources, errors } = readSources(path);

if (errors.length > 0) {
  console.error(`${path}: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const by = (status: string) => sources.filter((s) => s.status === status).length;
console.log(
  `${sources.length} sources: ${by("verified")} verified, ${by("proposed")} proposed, ${by("disabled")} disabled.`,
);
