# Roadmap

What comes next, in what order. Each step starts with a brief under `briefs/`; settled questions
are in `DECISIONS.md`.

The wire comes first, because it is the product and because its output is what a design has to
show. The design work needs the owner's eye and little else, so it runs beside steps 2 and 3
instead of blocking them.

| #   | Step                       | What it delivers                                                                                                                                                                        | Status    |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **Foundation**             | The contract (source and story schemas), the source list as data, one check command, CI, and the decisions written down.                                                                | In review |
| 2   | **Wire: fetch**            | Adapters for each kind of source, dedupe and text extraction, run on recorded fixtures. Every source in the list verified: fetched and parsed once.                                     | Planned   |
| 3   | **Wire: model layer**      | Relevance check, summaries, clustering and ranking, with a labelled test set that guards the prompts. The wire writes real story records.                                               | Planned   |
| D   | **Design**, beside 2 and 3 | Wordmark and icon. Mock-ups of the home page with its animated masthead and of a story page, on real records once step 3 has some. The owner picks; the pick becomes the design system. | Planned   |
| 4   | **Site**                   | Every page type built from the story records in the picked design, inside the speed and accessibility gates. Feeds and the open data export.                                            | Planned   |
| 5   | **Deployment**             | The scheduled job, the storage and pull zones at agentwire.eu, analytics and edge rules. Live but not announced.                                                                        | Planned   |
| 6   | **Soak and launch**        | One week of unattended runs to tune the relevance threshold and the prompts and to check real costs. Then the announcement.                                                             | Planned   |

After launch, in order of value: an MCP endpoint over the published records, links to letsauth
atlas pages where a story is about a specification or server listed there, a weekly digest, and
posts to Mastodon and Bluesky.
