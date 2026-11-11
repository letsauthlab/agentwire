# 02 Wire: fetch

## Goal

The wire can read its sources. Given the source list, one command fetches what is new, drops what
it has seen, and writes clean items with their text. No model is involved yet.

## In

- **Adapters**, one per kind of source, behind one interface: `feed` (RSS and Atom),
  `datatracker` (documents and revisions of an IETF working group, from the datatracker API),
  `github-releases` (the GitHub REST API, see Findings), `arxiv` (a saved query), and `hn-search`
  for reactions.
- **Polite fetching.** Conditional requests (`ETag`, `Last-Modified`), a rate limit per host, a
  time limit and a size limit per response, a user agent that names Agentwire and links to the
  site, and `robots.txt` respected.
- **A guarded client.** Only `https`, only public addresses, redirects followed a few times and
  checked again at each hop. A source's address is data, so it gets the same care as user input.
- **Normalise and dedupe.** A canonical address (tracking parameters removed) plus a content
  hash. An item seen before is dropped before any later cost.
- **Text extraction** for feeds that carry only a teaser: the article text, without navigation
  and scripts, capped in length.
- **State.** The position in each feed and the seen hashes, in one small file that the job reads
  at the start and writes at the end.
- **Fixtures.** One recorded response per adapter under `tests/fixtures/`, so every stage is
  tested without the network.
- **The sources verified.** Each entry in `data/sources.yaml` that has an `adapter` and a `fetch`
  target is set to `verified` once the real adapter fetched and parsed it. An entry that has no
  usable feed stays `proposed` with a note, or is removed.
- **A schema change first**, in its own small pull request: remove the `lobsters` adapter and add
  the source kind `press`. Then add the trade press feeds as `reactions` sources (see Findings).
- **`pnpm wire:fetch`**: runs the stage once and prints, per source, how many items were new,
  seen or failed.

## Out

- The relevance check, summaries, clustering and ranking. Those are brief 03.
- Story records. This stage writes items; stories are formed in brief 03.
- The scheduled job, object storage and deployment. The state file is local here.
- Anything visual.
- An adapter for list pages without a feed, and an adapter for repository commits. The commits
  adapter is for a later brief. The sources that need one stay `proposed` for now.
- Mailing lists. Neither the IETF nor the OpenID list archive has a feed.
- Individual IETF drafts. The wire reads working group documents only. About 30 active drafts
  are named `draft-*-wimse-*`; they wait until the relevance check exists.

## Checks

- `pnpm check` passes, with tests for every adapter on its fixture and for the guarded client
  (a private address, a non-https redirect and an oversized response are each refused).
- `pnpm wire:fetch` run twice in a row reports no new items the second time.
- Every source in `data/sources.yaml` is `verified`, or carries a note saying why it is not.
- The pull request lists, per source, the number of items fetched in the verifying run.

## Findings from the source research (11 November 2026)

Every fetch target in `data/sources.yaml` was requested once by hand on this day, with a client
that named Agentwire. 90 of the 102 entries have a target that answered with a response that
parses. The list holds first-level sources only (`docs/DECISIONS.md`).

- **GitHub** forbids `*.atom` and commit pages in its `robots.txt`. The `github-releases` adapter
  reads `api.github.com/repos/<owner>/<repo>/releases`. It sends an `ETag` and allows 60 requests
  an hour without a token. The API was tested on `a2aproject/A2A` only.
- **Lobsters** forbids every client that is not a named search engine. It is removed. Hacker News
  search stays; its API answered and its `robots.txt` is empty.
- **Reactions will be thin** with Hacker News alone, and ranking counts reactions. Trade press
  feeds fill the gap as `reactions` sources that never start a story. These three answered and
  allow fetching: `https://www.helpnetsecurity.com/feed/`, `https://thenewstack.io/feed/` and
  `https://www.theregister.com/security/headlines.atom`.
- **IETF.** The datatracker API answers per working group. Revisions are separate events under
  `/api/v1/doc/newrevisiondocevent/`; that list also holds slides and needs a filter. New groups
  in the list: `agentproto` and `dawn`.
- **OpenID.** The working groups have tag feeds on openid.net. Each is a subset of the main feed,
  so the dedupe step must hold across sources.
- **arXiv.** The saved query returns about 100 papers in 11 days. That is fine for a `broad`
  source once the relevance check exists, and too many before. The adapter uses the arXiv API at
  its documented rate of one request every three seconds. `export.arxiv.org/robots.txt` says
  `Disallow: /`, but the API terms allow this use; the owner decided for the API.
- **Large responses.** Wiz (719 items), OpenAI (1381) and the IETF blog (602) send the whole
  archive and no `ETag`. The size limit must allow them or they are dropped.
- **People.** Of the 14 personal blogs, the three by researchers who publish their own findings
  are `broad` and start stories. The eleven by standards authors and practitioners are
  `reactions`: the news they write about arrives first-hand from the datatracker or the OpenID
  feed, and their post attaches to that story.
- **Blocked.** NCCoE and Strata answer 403 to a client that is not a browser. They stay
  `proposed`. The block is not worked around.

## Open questions

None. The owner approved the source list on 11 November 2026.
