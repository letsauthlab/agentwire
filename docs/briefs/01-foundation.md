# 01 Foundation

## Goal

The repository can be worked in: it builds, it checks itself with one command, and the rules and
decisions are written down where a person or an agent finds them.

## In

- The Astro skeleton on letsauth's design tokens, with a placeholder home page and a 404 page.
- The schemas for a source and a story, and the source list as data, every entry `proposed`.
- `pnpm check`: data validation, lint, typecheck, unit tests, build, byte budgets.
- `pnpm check:tokens`: the tokens match letsauth's.
- CI that runs both.
- `CLAUDE.md`, `docs/DECISIONS.md`, `docs/architecture.md`, `docs/roadmap.md`.

## Out

- Verifying the sources. Each feed is fetched and parsed in a later pull request, which sets the
  source to `verified`.
- Any design work: wordmark, icon, masthead and page layouts belong to brief 02.
- Ingestion, the scheduled job and deployment.

## Checks

- `pnpm check` passes locally and in CI.
- `pnpm check:tokens` passes in CI.
- The home page renders in light and dark and loads nothing from another host.

## Open questions

None.
