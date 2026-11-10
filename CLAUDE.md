# Agentwire: working notes for coding agents

Read first, in this order:

1. `docs/DECISIONS.md`: what is settled, why, and what each decision rules out. Do not reopen
   one in passing; propose a new entry.
2. `docs/architecture.md`: the layout of the repository and how data flows.
3. `docs/roadmap.md`: what comes next and in what order.
4. `docs/briefs/`: the brief for the work you are doing. Work starts from an approved brief, and
   the pull request repeats its checks.

`README.md` is the public front page; keep working notes out of it.

## Commands

- `pnpm install`: Node 22, pnpm 10.
- `pnpm validate:data`: schema, uniqueness and order checks over `data/`. Run after any data
  edit.
- `pnpm check`: validate:data, lint (Biome), typecheck, unit tests. Must pass before a push.
- `pnpm lint:fix`: applies Biome's formatting and safe fixes.

## Conventions

- The source list is `data/sources.yaml`, one entry per source, in alphabetical order by id. A
  new source starts as `proposed`. It becomes `verified` only in a pull request that adds its
  `adapter` and `fetch` target and shows the feed was fetched and parsed.
- The wire is the product; the site is one reader of its records. Logic belongs in the wire,
  never only in a page template.
- `src/schema/` is the contract. Change the schema first, in its own pull request, when the wire
  or a reader needs a field.
- Story records are append-only. Never write code that edits or deletes one.
- An address shown to a reader comes from a source, never from a model. Text from a source and
  text from a model are both untrusted: escape them, and never pass them to a shell, a file path
  or a URL.
- The visual design is open. Add no styles, layouts or pages until `docs/DECISIONS.md` records
  the picked design.
- Every stage of the wire is testable on recorded fixtures, without the network or a model.
- Plain English in every text a reader or contributor sees: short sentences, no marketing words.
