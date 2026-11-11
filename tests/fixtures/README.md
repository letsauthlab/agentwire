# Fixtures

Recorded responses, one per adapter, so every stage of the wire is tested without the network.
Each was fetched once on 11 November 2026 and cut down: a few entries per file, long bodies
shortened. The texts belong to their publishers.

| File                         | Recorded from                                              |
| ---------------------------- | ---------------------------------------------------------- |
| `feed-rss.xml`               | `https://openid.net/feed/`                                 |
| `feed-atom.xml`              | `https://aaronparecki.com/feed.xml`                        |
| `datatracker-documents.json` | the datatracker document list of the OAuth working group   |
| `github-releases.json`       | the GitHub releases of `a2aproject/A2A`                    |
| `arxiv-query.xml`            | an arXiv API query in cs.CR                                |
| `hn-search.json`             | the Hacker News search API, submissions by date            |
| `article.html`               | written by hand: a page with navigation around one article |

In `github-releases.json` the third release is marked as a pre-release by hand, to cover the
filter.
