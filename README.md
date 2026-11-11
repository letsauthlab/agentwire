# Agentwire

**[agentwire.eu](https://agentwire.eu/)** is a news wire for agentic identity, security and
platforms. It collects announcements, drafts, releases, papers and incident reports from
standards bodies, vendors, research labs and open source projects. Each story shows a short AI
summary, a link to the source and the reactions to it.

Agentwire is a project of the [letsauth lab](https://github.com/letsauthlab). It is in
preparation: this repository holds the foundation and the part of the wire that fetches the
sources, and nothing is live yet.

The wire is the product: a scheduled job that turns sources into story records. The website is
one reader of those records, beside the open data export and the feeds.

## How it will work

- **Every story cites its source.** A summary is written only from the fetched text and is
  labelled as written by a model. The headline and the link come from the source.
- **Neutral.** Ranking uses the number of reactions and the age of a story, nothing else. Nobody
  pays for placement.
- **Open data.** Story records are append-only and published under CC BY 4.0.
- **Unattended, with switches.** A scheduled job publishes stories without review. Any source can
  be switched off and any story hidden by a one-line pull request.
- **European.** Hosting, the job, the language model and analytics run with EU providers.

The decisions behind these are in [docs/DECISIONS.md](docs/DECISIONS.md), the design in
[docs/architecture.md](docs/architecture.md) and the order of work in
[docs/roadmap.md](docs/roadmap.md).

## Propose a source

The sources are listed in [`data/sources.yaml`](data/sources.yaml). To propose one, add an entry
in a pull request. The fields are described in [`src/schema/source.ts`](src/schema/source.ts).

## Develop

```sh
pnpm install   # Node 22, pnpm 10
pnpm check     # data validation, lint, typecheck, tests
pnpm wire:fetch  # fetch the sources once; items and state go to var/
```

## Licences

Code is under the [MIT License](LICENSE). Data is under [CC BY 4.0](LICENSE-DATA).
