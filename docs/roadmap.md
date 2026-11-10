# Roadmap

What comes next, in what order. Each step starts with a brief under `briefs/`; settled questions
are in `DECISIONS.md`.

| #   | Step                          | What it delivers                                                                                                                                                                         | Status      |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **Foundation**                | Decisions and agent notes, the Astro skeleton on letsauth's tokens, `pnpm check` and CI, and the source list as data. Then the source list verified: every feed fetched and parsed once. | In progress |
| 2   | **Design and site**           | Wordmark and icon. The home page with its animated masthead, and every page type built on sample stories, inside the speed and accessibility gates, with screenshot baselines.           | Planned     |
| 3   | **Ingestion and model layer** | Fetch, dedupe and text extraction. Then relevance check, summaries, clustering and ranking, with a labelled test set that guards the prompts.                                            | Planned     |
| 4   | **Deployment**                | The scheduled job, the storage and pull zones at agentwire.eu, analytics and edge rules. Live but not announced.                                                                         | Planned     |
| 5   | **Soak and launch**           | One week of unattended runs to tune the relevance threshold and the prompts and to check real costs. Then the announcement.                                                              | Planned     |

After launch, in order of value: an MCP endpoint over the published data, links to letsauth
atlas pages where a story is about a specification or server listed there, a weekly digest, and
posts to Mastodon and Bluesky.
