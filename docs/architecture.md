# Architecture

How the repository is laid out and how data will flow. The first part describes what exists; the
second what is decided and not yet built. The order of the work is in `roadmap.md`.

Agentwire has two parts. **The wire** is the product: a scheduled job that turns sources into
story records. **The site** is one reader of those records, beside the open data export, the
feeds and a later MCP endpoint. The story schema is the contract between them.

## What exists

```
data/sources.yaml        the source list, all entries `proposed`
src/schema/              Zod schemas: source and story (the contract)
src/lib/sources.ts       reads and checks the source list
scripts/validate-data.ts the data check
tests/unit/              Vitest tests for the schemas and the reader
docs/                    DECISIONS.md, roadmap.md, briefs/
```

`pnpm check` is the one gate: data validation, lint, typecheck, unit tests.

## The wire (decided, not built)

One scheduled job runs every 30 minutes. Each stage records its result, so a failed run
continues where it stopped.

1. **Fetch.** One adapter per kind of source: feeds, the IETF Datatracker, GitHub releases, arXiv,
   and discussion sites for reactions. Conditional requests and a rate limit per host.
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

Planned layout: `src/wire/` with one folder per stage, each testable on recorded fixtures without
the network or a model.

## The site (decided in outline, not built)

A static Astro site built from the story records by the same job, checked against the byte
budgets, and uploaded to Bunny. A failed check leaves the last good site online. The job is the
only writer to the site's storage; CI builds and tests the job's image and never uploads site
files.

The visual design is open (`DECISIONS.md`). No styles, layouts or pages are in the repository
until it is picked.
