import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { readSources } from "../src/lib/sources";
import { runFetch, type SourceReport } from "../src/wire/fetch/run";
import { createClient } from "../src/wire/http/client";
import { createPoliteFetcher, USER_AGENT } from "../src/wire/http/polite";
import { httpsTransport, systemResolver } from "../src/wire/http/transport";
import { readState, writeState } from "../src/wire/state";

// Runs the fetch stage of the wire once and prints, per source, what it found.
//
//   pnpm wire:fetch                 fetch every verified source
//   pnpm wire:fetch --verify        also fetch proposed sources that have a fetch target
//   pnpm wire:fetch --only a2a      fetch one source (repeat the flag for more)
//   pnpm wire:fetch --dir var       where the state file and the items go
const { values } = parseArgs({
  options: {
    verify: { type: "boolean", default: false },
    only: { type: "string", multiple: true },
    dir: { type: "string", default: "var" },
    sources: { type: "string", default: "data/sources.yaml" },
  },
});

const { sources, errors } = readSources(resolve(values.sources));
if (errors.length > 0) {
  console.error(`${values.sources}: ${errors.length} problem(s). Run pnpm validate:data.`);
  process.exit(1);
}

const dir = resolve(values.dir);
const statePath = join(dir, "state.json");
const state = readState(statePath);

const client = createClient({
  transport: httpsTransport,
  resolve: systemResolver,
  userAgent: USER_AGENT,
  maxBytes: 10_000_000,
  timeoutMs: 30_000,
  maxRedirects: 5,
});
const fetcher = createPoliteFetcher({ client, now: Date.now, sleep: (ms) => sleep(ms) });

const pad = (value: string | number, width: number) => String(value).padStart(width);
const line = (r: SourceReport) =>
  `${r.id.padEnd(34)}${pad(r.fetched, 8)}${pad(r.fresh, 6)}${pad(r.seen, 6)}${pad(r.old, 6)}${pad(r.failed, 8)}${r.error ? `  ${r.error}` : ""}`;

console.log(
  `${"source".padEnd(34)}${pad("fetched", 8)}${pad("new", 6)}${pad("seen", 6)}${pad("old", 6)}${pad("failed", 8)}`,
);
const { items, reports } = await runFetch({
  sources,
  state,
  fetcher,
  now: () => new Date(),
  includeProposed: values.verify,
  only: values.only,
  onReport: (report) => console.log(line(report)),
});

// Items first, then the state: a crash in between repeats items and never loses one.
const itemsDir = join(dir, "items");
mkdirSync(itemsDir, { recursive: true });
for (const item of items) {
  appendFileSync(join(itemsDir, `${item.fetched.slice(0, 10)}.jsonl`), `${JSON.stringify(item)}\n`);
}
writeState(statePath, state);

const sum = (pick: (r: SourceReport) => number) => reports.reduce((n, r) => n + pick(r), 0);
const broken = reports.filter((r) => r.error !== undefined).length;
console.log(
  `\n${reports.length} sources, ${broken} could not be read. ${sum((r) => r.fetched)} items fetched: ${sum((r) => r.fresh)} new, ${sum((r) => r.seen)} seen, ${sum((r) => r.old)} old, ${sum((r) => r.failed)} failed.`,
);
