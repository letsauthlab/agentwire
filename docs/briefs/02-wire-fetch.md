# 02 Wire: fetch

## Goal

The wire can read its sources. Given the source list, one command fetches what is new, drops what
it has seen, and writes clean items with their text. No model is involved yet.

## In

- **Adapters**, one per kind of source, behind one interface: `feed` (RSS and Atom),
  `datatracker` (documents and revisions of an IETF working group), `github-releases`, `arxiv`
  (a saved query), and `hn-search` and `lobsters` for reactions.
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
- **The sources verified.** Each entry in `data/sources.yaml` gets its `adapter` and `fetch`
  target and is set to `verified` once it was fetched and parsed. An entry that has no usable
  feed stays `proposed` with a note, or is removed.
- **`pnpm wire:fetch`**: runs the stage once and prints, per source, how many items were new,
  seen or failed.

## Out

- The relevance check, summaries, clustering and ranking. Those are brief 03.
- Story records. This stage writes items; stories are formed in brief 03.
- The scheduled job, object storage and deployment. The state file is local here.
- Anything visual.

## Checks

- `pnpm check` passes, with tests for every adapter on its fixture and for the guarded client
  (a private address, a non-https redirect and an oversized response are each refused).
- `pnpm wire:fetch` run twice in a row reports no new items the second time.
- Every source in `data/sources.yaml` is `verified`, or carries a note saying why it is not.
- The pull request lists, per source, the number of items fetched in the verifying run.

## Open questions

- **Network access.** The environment this work runs in blocks most hosts, so the sources cannot
  be fetched from it. The work can start on fixtures, but the verification needs wider access.
- **People.** The list has one personal blog. Which working group authors and practitioners
  should it follow?
