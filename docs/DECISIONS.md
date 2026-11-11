# Decisions

Settled questions. Each entry says what was decided, why, and what it rules out, so a later pull
request does not reopen it by accident. Dates are when the decision was taken. A new decision is
a new entry; a reversed one is marked as replaced and kept.

## Name, domain and home (10 November 2026)

**Agentwire, at agentwire.eu, a standalone project of the letsauth lab.** It has its own
repository, `letsauthlab/agentwire`, and its own domain. letsauth measures how MCP servers behave;
Agentwire reports news across agentic identity, security and platforms. Rules out: a path or
subdomain of letsauth.eu, a shared repository or data model with letsauth.

## Stack (10 November 2026)

**TypeScript for the wire, Astro for the site,** the same stack as letsauth, so one person and
their agents can keep both. Pages are static HTML. Rules out: a second toolchain for the wire, a
client-side framework for the site.

## Hosting and services (10 November 2026)

**EU providers throughout.** A Scaleway Serverless Job runs every 30 minutes in its own Scaleway
project. The site is served from Bunny, with its own storage zone and pull zone in the lab's
account. Mistral does the relevance check, the summaries and the embeddings. Plausible counts
page views, proxied through the site's own host. GitHub, for code and CI, is the one service
outside the EU. Rules out: a page that loads anything from another host, cookies that need
consent.

## Licences (10 November 2026)

**Public repository. MIT for code, CC BY 4.0 for data,** as in letsauth. The data licence covers
what Agentwire writes: summaries, tags, groupings and rankings. Headlines and linked articles
belong to their publishers.

## Stories publish without review (10 November 2026)

**The scheduled job publishes stories without a person reading them first.** A wire that updates
every 30 minutes cannot wait for review. In exchange: code, the source list, the prompts and the
block list change only through reviewed pull requests; any source can be switched off and any
story hidden by a one-line pull request; a build that fails a check is not published and the last
good site stays online. Rules out: hand curation as a requirement, silent edits to a published
story.

## Ranking (10 November 2026)

**Ranking uses the number of reactions and the age of a story, nothing else.** The formula is
published on the site. Rules out: hand-set source weights, paid placement. Lists of sources are
alphabetical.

## First-level sources start stories (11 November 2026)

**A story starts only from the source that made the news:** the standards body, the project, the
company, the public body, or the person who wrote the draft or found the bug. News outlets and
discussion sites are `reactions` sources. They attach to a story and count for its ranking. The
source list is picked and kept by hand. Rules out: stories that start from a newsletter, an
aggregator or a news report, and sources added by the job itself.

## Story data is append-only (10 November 2026)

**A story record is never edited or removed.** A correction, a new reaction or the hiding of a
story is a newer record with the same id. The records are published as open data. Rules out: a
database that overwrites rows, deleting a story to hide it.

## The wire is the product, the site is one reader of it (10 November 2026)

**The repository is built around the wire:** the job that fetches, filters, summarises, groups
and ranks, and the story records it writes. The website is one consumer of those records, beside
the open data export, the feeds and a later MCP endpoint. The story schema is the contract
between them. Rules out: logic that lives only in a page template, a site that reads anything
but the published records.

## Visual design is open (10 November 2026)

**Nothing visual is in the repository until the owner has picked a design.** The direction is
set: inspired by letsauth.eu, with an animated masthead, a wordmark and an icon of its own. The
tokens, type and layout are decided on mock-ups first. Rules out: copying letsauth's styles
ahead of that decision.

## Budgets are release gates (10 November 2026)

**A page over budget is not published.** The byte budgets are checked over the built site,
compressed with gzip, on every code change and on every scheduled build. The check arrives with
the site.

| Budget                   | Limit           |
| ------------------------ | --------------- |
| HTML per page            | 35 kB           |
| CSS per page             | 15 kB           |
| JavaScript per page      | 8 kB            |
| Preloaded fonts per page | 35 kB, one file |
| Requests to another host | 0               |

Planned with the Lighthouse job: performance, accessibility, best practices and SEO at 100 on the
home page, a story, a topic and a week page; Largest Contentful Paint within 2.0 s on simulated
mobile; no layout shift. WCAG 2.2 AA is the accessibility level. Every page renders in light and
dark, respects reduced motion and reads fully without JavaScript.

## Working method (10 November 2026)

**One short brief per piece of work, no Spec Kit and no constitution.** Spec Kit did not work well
for letsauth. Here each step of `docs/roadmap.md` starts with a brief under `docs/briefs/`: the
goal, what is in and out, and the checks that show it is done. The owner edits or approves the
brief, then one pull request implements it and its description repeats the checks. Decisions
that outlive a brief are recorded in this file. Rules out: `.specify/`, per-feature spec, plan
and task files.
