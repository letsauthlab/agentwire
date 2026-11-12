# 03 Wire: model layer

## Goal

The wire writes story records. Given the items of the fetch stage, one command decides what is on
topic, writes a summary, groups items into stories and appends the records. The owner can read
real stories in a file, and the design work can use them.

## In

- **A model client** in `src/wire/model/`, behind one interface with two calls: a chat call that
  returns JSON for a given schema, and an embeddings call. It talks to the Mistral API through
  the guarded client in `src/wire/http/`. No SDK is added. The key comes from the environment
  variable `MISTRAL_API_KEY`. The model has no tools. Tests use a fake client with recorded
  answers.
- **Relevance check.** A keyword prefilter for `broad` sources, from a list in
  `data/keywords.yaml`. Then one model call per item, for `core` and `broad` sources alike,
  against the rubric in `prompts/relevance.md`. The model reads the headline and the first 2,000
  characters. It returns a score from 0 to 100, a type and one to three topics. A `broad` item
  passes at 60 or more, a `core` item at 30 or more. These are first values, in one config file,
  to be set again on real data. Type and topics must be values of the story schema, or the item
  is dropped and reported.
- **Summaries.** Two or three sentences from the text of the primary item, by the prompt in
  `prompts/summary.md`. A text under 400 characters gets no summary (`text: null`). A summary
  that holds an address, markup or more than 600 characters is thrown away and recorded as
  `null`. The record stores the model name and the prompt version.
- **Clustering.** An item joins a story of the last 14 days when it links to the story's primary
  item or to one of its reactions, or when its embedding is close enough to the primary's. An
  item with under 200 characters of text joins by link only. An item that joins is a reaction. An
  item that joins nothing starts a story if its source is `core` or `broad` and it passed the
  relevance check. A `core` or `broad` item that is close to a story joins it as a reaction and
  starts no story of its own; the first item stays the primary. This is the first version, to be
  looked at again once real stories exist. A `reactions` item that joins nothing waits 14 days
  for a story, then is dropped. `reactions` items never get a relevance call.
- **Ranking** as one pure function in `src/wire/rank/`: the number of reactions, reduced by the
  age of the story. Every reader calls this function. The score is not stored: it changes with
  age, and a stored one would be out of date between two reactions.
- **Story records.** A new story is revision 1. A new reaction is a new record with the same id
  and the next revision. The id comes from a hash of the primary item's address. Records are
  appended to `var/stories/<day>.jsonl` and checked against the story schema before they are
  written.
- **State.** The result of each stage per item, and the embeddings of the stories of the last 14
  days, so a failed run continues where it stopped and no item is paid for twice.
- **A limit on model calls per run**, so a source that floods the wire cannot run up a bill. Items
  over the limit wait for the next run.
- **A labelled test set** under `tests/labelled/`: 200 items from the fetch run of 11 November,
  each with headline, the first 2,000 characters, and the expected answer (on topic or not,
  type, topics). Each entry names its source and the address of the original article, and the
  README says the texts belong to their publishers. Plus 40 pairs of items marked "same story"
  or "not". Claude proposes the labels; the owner corrects them in review.
- **`pnpm wire:eval`**: runs the real model over the labelled set and writes the answers and the
  scores to `tests/labelled/results.json`, with a hash of the prompts, the model names and the
  set. `pnpm check` fails when that hash is out of date. So a prompt cannot change without a
  fresh run, and CI needs no key. No score has a limit yet: the first run gives the numbers, and
  the limits are set from them.
- **`pnpm wire:stories`**: runs the model stages once over the fetched items and prints, per
  stage, how many items passed, joined, started a story, were dropped or failed, and what the
  run cost in tokens.

## Out

- The block list and hidden stories. They arrive before anything is published, with deployment.
- Corrections to a published story. The record format allows them; no command writes one yet.
- The scheduled job and object storage. Records are local files here.
- Tuning the thresholds and the prompts, and limits on the scores. That is step 6, the tuning
  harness. This brief sets first values and builds the test set.
- The page that publishes the ranking formula. It arrives with the site.
- Individual IETF drafts and the sources that are still `proposed`.
- Anything visual.

## Checks

- `pnpm check` passes without the network and without a key. It has tests for each stage on a
  fake model, including: a model answer that is not valid JSON, an answer with a type outside
  the schema, a summary with an address in it, and an item whose text tells the model to ignore
  its instructions.
- `results.json` is current and the pull request reports from it: relevance precision and
  recall, the share of on-topic items with the right type, and how many of the 40 pairs are
  wrong. It lists the items the model got wrong, so the owner can judge the rubric.
- `pnpm wire:stories` run twice in a row makes no model call and writes no record the second
  time.
- Every line in `var/stories/` parses with the story schema, and every address in it is the
  address of a fetched item.
- The pull request lists the number of stories, the number with reactions, the token count and
  the cost of the first run, and shows twenty stories for the owner to read.

## Findings from the fetch run (11 November 2026)

The run wrote 1,034 items from 92 sources: 37 from `core`, 840 from `broad`, 157 from
`reactions`. They cover 30 days.

- **Most of `broad` is off topic.** OpenAI sent 93 items, mostly customer stories. WorkOS sent 76,
  many of them how-to posts. The prefilter and the rubric carry the whole product.
- **Releases are noisy.** `agntcy-slim` sent 30 items, one per component and patch version. The
  rubric says a patch release is news only when it fixes a security bug, so `core` items get a
  low threshold and not a free pass.
- **Reactions are thin by link.** 21 of the 157 `reactions` items link to an item of a source
  that can start a story. The 79 Hacker News items have no text. The press items have text and
  seldom link to the first-level source, so they need the embeddings.
- **Short texts.** 100 `broad` items have under 200 characters of text. They can pass the check
  on their headline and get no summary.
- **Mistral.** `mistral-small-2603` (Mistral Small 4) supports JSON output that follows a given
  schema, at 0.15 dollars per million tokens in and 0.60 out. `mistral-embed` returns 1,024
  numbers per text and reads up to 8,192 tokens. The docs name an EU endpoint,
  `api.eu.mistral.ai`; the pull request uses it if both models answer there. Model names are
  pinned to a dated version, never `-latest`, so the test set guards what runs.
- **Cost.** The 30-day backlog is about 3 million tokens: under one euro. A day adds about 60
  items: a few cents. The pull request reports the real numbers.

## Open questions

None. The owner settled these on 12 November 2026:

- The key is in `.env`.
- The score is not stored, for now.
- A first-level item close to a story joins it as a reaction. To be looked at again on real
  stories.
- The labelled set keeps the excerpts, each with its source and the address of the original.
- The thresholds are first values. Limits on the scores come with the tuning harness.
