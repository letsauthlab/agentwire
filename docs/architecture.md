# Architecture

How the repository is laid out and how data flows. It says what exists and what is decided and
not yet built. The order of the work is in `roadmap.md`.

Agentwire has two parts. **The wire** is the product: a scheduled job that turns sources into
story records. **The site** is one reader of those records, beside the open data export, the
feeds and a later MCP endpoint. The story schema is the contract between them.

## What exists

```
data/sources.yaml        the source list: `verified` sources are fetched, `proposed` are not
src/schema/              Zod schemas: source and story (the contract)
src/lib/sources.ts       reads and checks the source list
src/wire/http/           the guarded client, robots.txt, the rate limit per host
src/wire/fetch/          one adapter per kind of source, and the run over all sources
src/wire/dedupe/         the canonical address and the content hash
src/wire/extract/        article text and links from HTML
src/wire/state.ts        the state file: the position in each source and what was seen
src/wire/item.ts         the item the fetch stage hands to the later stages
scripts/validate-data.ts the data check
scripts/wire-fetch.ts    `pnpm wire:fetch`: runs the fetch stage once
tests/unit/              Vitest tests, on the recorded responses in tests/fixtures/
docs/                    DECISIONS.md, roadmap.md, briefs/
```

`pnpm check` is the one gate: data validation, lint, typecheck, unit tests.

## The wire

One scheduled job runs every 30 minutes. Each stage records its result, so a failed run
continues where it stopped. Stages 1 to 3 are built; the rest is decided and not built.

1. **Fetch.** One adapter per kind of source: feeds, the IETF Datatracker, GitHub releases, arXiv,
   and Hacker News for reactions. Conditional requests and a rate limit per host.
2. **Normalise and dedupe.** Canonical address plus a content hash, before any model cost.
3. **Extract text**, where a feed carries only a teaser. `robots.txt` is respected.
4. **Relevance check.** `core` sources pass almost always. `broad` sources pass a keyword
   prefilter and then a model check against a written rubric. The model returns a score, a type
   and topics as JSON.
5. **Summarise.** Two or three sentences, from the fetched text only. Model and prompt version
   are stored with the summary.
6. **Cluster.** Embeddings and explicit links group items into stories within 14 days. An item
   that links to a story's primary item joins it as a reaction.
7. **Rank and record.** Score is the number of reactions, reduced by age. Records are appended to
   daily files in object storage. These files are the open data export.

Text fetched from a source is untrusted input. The model that reads it has no tools, its output
is checked against the schema, and an address shown to a reader always comes from the source.

### How the fetch stage works

`pnpm wire:fetch` reads `var/state.json`, fetches every `verified` source in order of its id,
appends the new items to `var/items/<day>.jsonl` and writes the state back. `var/` is local and
not in the repository; object storage comes with the deployment.

- **Every request goes through the guarded client.** A source's address is data. The client
  accepts only `https` on the default port, resolves the host itself, refuses every address
  that is not public, and connects to the address it checked. A redirect is checked like a first
  address, at most five times. A response over the size limit or the time limit is dropped.
- **The polite fetcher sits on top.** It reads `robots.txt` once per host and run, and obeys
  it. It leaves a second between two requests to one host. The arXiv API is the one request that
  skips `robots.txt`; `src/wire/fetch/arxiv.ts` says why.
- **An adapter turns one source into raw items.** It never touches the network or the state
  directly, so it runs on a recorded response.
- **The run normalises each item.** It drops an item with no usable address, an item published
  more than 30 days ago, and an item whose address or text was seen before, by any source. Where
  a feed carries a teaser, it fetches the page and takes the article text. An item without a
  date gets the time it was first seen.
- **A source that fails is reported and skipped.** Its position stays as it was, so the next run
  tries again.
- **Hacker News is read once per run.** One request returns every new submission. The wire
  keeps those that link to the site of a source that can start a story.

## The site (decided in outline, not built)

A static Astro site built from the story records by the same job, checked against the byte
budgets, and uploaded to Bunny. A failed check leaves the last good site online. The job is the
only writer to the site's storage; CI builds and tests the job's image and never uploads site
files.

The visual design is open (`DECISIONS.md`). No styles, layouts or pages are in the repository
until it is picked.
