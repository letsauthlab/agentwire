# Architecture

How the repository is laid out and how data will flow. The first part describes what exists; the
second what is decided and not yet built. The order of the work is in `roadmap.md`.

## What exists

```
data/sources.yaml        the source list, all entries `proposed`
src/schema/              Zod schemas: source and story (the contract)
src/lib/                 site constants, the source list reader
src/styles/              tokens.css (letsauth's tokens), fonts.css, global.css
src/layouts/Base.astro   the one page shell
src/pages/               the placeholder home page and the 404 page
scripts/                 validate-data, check-budgets, check-tokens
docs/                    DECISIONS.md, roadmap.md, briefs/
tests/unit/              Vitest tests for the schema and the reader
```

`pnpm check` is the one gate: data validation, lint, typecheck, unit tests, build, byte budgets.

## What is decided

One scheduled job does everything from fetching to publishing. Nothing else runs between jobs
except the CDN and the analytics service.

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
   daily files in object storage.
8. **Build, check, publish.** Astro builds the site from the records, the byte budgets are
   checked, and changed files are uploaded. A failed check leaves the last good site online.

The job is the only writer to the site's storage. CI builds and tests the job's image and never
uploads site files.

## Design

The tokens in `src/styles/tokens.css` are letsauth's. Tokens that only letsauth's atlas and
explorer use are left out. The decision and the budgets are in `DECISIONS.md`.
