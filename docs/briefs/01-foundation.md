# 01 Foundation

## Goal

The repository can be worked in: the contract between the wire and its readers is written as a
schema, the sources are data, one command checks everything, and the decisions are written down
where a person or an agent finds them.

## In

- The schemas for a source and a story.
- The source list as data, every entry `proposed`.
- `pnpm check`: data validation, lint, typecheck, unit tests.
- CI that runs it.
- `CLAUDE.md`, `docs/DECISIONS.md`, `docs/architecture.md`, `docs/roadmap.md`.

## Out

- The wire itself. Fetching starts with brief 02.
- Verifying the sources. Each feed is fetched and parsed in brief 02, which sets the source to
  `verified`.
- Anything visual. No site, styles or pages until the design is picked.

## Checks

- `pnpm check` passes locally and in CI.
- The repository holds no styles, layouts or pages.

## Open questions

None.
