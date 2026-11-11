import { describe, expect, it } from "vitest";
import type { Source } from "@/schema/source";
import { parsePapers } from "@/wire/fetch/arxiv";
import { parseDocuments } from "@/wire/fetch/datatracker";
import { parseFeed } from "@/wire/fetch/feed";
import { parseReleases } from "@/wire/fetch/github-releases";
import { linkTargets, parseHits } from "@/wire/fetch/hn-search";
import { fixture } from "./helpers";

describe("the feed adapter", () => {
  it("reads an RSS feed", () => {
    const items = parseFeed(fixture("feed-rss.xml"), "https://openid.net/feed/");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://openid.net/closing-the-assurance-gap/",
      title: "Closing the assurance gap",
      published: "2026-11-05T10:31:22.000Z",
    });
    expect(items[0]?.html).toContain("<p>");
  });

  it("reads an Atom feed", () => {
    const items = parseFeed(fixture("feed-atom.xml"), "https://aaronparecki.com/feed.xml");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://aaronparecki.com/2026/10/30/19/oauth-id-jag-draft-06",
      title: "Identity Assertion JWT Authorization Grant Draft 06",
      published: "2026-10-31T00:55:21.000Z",
    });
    expect(items[0]?.html).toContain("draft -06");
  });

  it("resolves relative links, strips markup from headlines and skips broken entries", () => {
    const xml = `<rss><channel>
      <item><title>Fish &amp;amp; &lt;b&gt;chips&lt;/b&gt;</title><link>/post/1</link></item>
      <item><title>No link</title></item>
      <item><link>https://example.org/no-title</link></item>
      <item><title>From the guid</title><guid>https://example.org/guid</guid><pubDate>soon</pubDate></item>
      <item><title>Not a permalink</title><guid isPermaLink="false">abc-123</guid></item>
    </channel></rss>`;
    expect(parseFeed(xml, "https://example.org/feed")).toEqual([
      { url: "https://example.org/post/1", title: "Fish & chips", html: "" },
      { url: "https://example.org/guid", title: "From the guid", html: "" },
    ]);
  });

  it("reads an http link to the feed's own host as https, and no other", () => {
    const xml = `<rss><channel>
      <item><title>Own</title><link>http://www.example.org/blog/a/</link></item>
      <item><title>Other</title><link>http://other.example/b</link></item>
    </channel></rss>`;
    expect(parseFeed(xml, "https://example.org/feed").map((i) => i.url)).toEqual([
      "https://www.example.org/blog/a/",
      "http://other.example/b",
    ]);
  });

  it("refuses a document that is not a feed", () => {
    expect(() => parseFeed("<html><body>Blocked</body></html>", "https://example.org/")).toThrow(
      "not a feed",
    );
    expect(parseFeed("<feed></feed>", "https://example.org/")).toEqual([]);
  });
});

describe("the datatracker adapter", () => {
  it("makes one item per document revision", () => {
    const { items, next } = parseDocuments(fixture("datatracker-documents.json"));
    expect(next).toBeNull();
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      url: "https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/17/",
      title: "The OAuth 2.1 Authorization Framework (draft-ietf-oauth-v2-1-17)",
      published: "2026-10-31T04:16:32.000Z",
      complete: true,
    });
    expect(items[0]?.text).toContain("OAuth 2.1 authorization framework");
  });

  it("skips a document whose name could not be part of an address", () => {
    const json = JSON.stringify({
      meta: { next: null },
      objects: [{ name: "../../etc", rev: "01", title: "Bad", time: "2026-11-01T00:00:00Z" }],
    });
    expect(parseDocuments(json).items).toEqual([]);
  });
});

describe("the GitHub releases adapter", () => {
  it("reads releases and leaves pre-releases out", () => {
    const items = parseReleases(fixture("github-releases.json"), "a2aproject/A2A");
    expect(items.map((i) => i.title)).toEqual(["a2aproject/A2A v1.0.1", "a2aproject/A2A v1.0.0"]);
    expect(items[0]).toMatchObject({
      url: "https://github.com/a2aproject/A2A/releases/tag/v1.0.1",
      published: "2026-05-28T11:34:36.000Z",
      complete: true,
    });
  });
});

describe("the arXiv adapter", () => {
  it("reads papers and cuts the version from the address", () => {
    const items = parsePapers(fixture("arxiv-query.xml"), "https://export.arxiv.org/api/query");
    expect(items).toHaveLength(2);
    expect(items[0]?.url).toBe("https://arxiv.org/abs/2611.12386");
    expect(items[0]?.title).toMatch(/^Say Shibboleth/);
    expect(items[0]?.html).toContain("fingerprinting of agentic cyberattacks");
    expect(items[0]?.published).toMatch(/^2026-11-/);
  });
});

describe("the Hacker News adapter", () => {
  const source = (id: string, url: string, tier: Source["tier"] = "core"): Source => ({
    id,
    name: id,
    url,
    kind: "open-source",
    tier,
    topics: ["standards"],
    status: "verified",
  });
  const sources = [
    source("openid", "https://openid.net/"),
    source("a2a", "https://github.com/a2aproject/A2A"),
    source("blog", "https://www.example.org/blog/", "reactions"),
  ];

  it("looks for links to first-level sources only", () => {
    expect(linkTargets(sources)).toEqual(["openid.net", "github.com/a2aproject/a2a"]);
  });

  it("keeps the submissions that link to a source", () => {
    const { items, count, oldest } = parseHits(fixture("hn-search.json"), linkTargets(sources));
    expect(count).toBe(6);
    expect(oldest).toBeTypeOf("number");
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      url: "https://news.ycombinator.com/item?id=50379662",
      title: "FastFed Core 1.0 – draft 03",
      links: ["https://openid.net/specs/fastfed-core-1_0-03.html"],
      complete: true,
      published: "2026-11-05T14:41:21.000Z",
    });
  });

  it("matches a repository and not the whole of GitHub", () => {
    const hit = (id: string, url: string) => ({ objectID: id, title: "t", url, created_at_i: 1 });
    const json = JSON.stringify({
      hits: [
        hit("1", "https://github.com/a2aproject/A2A/releases/tag/v1"),
        hit("2", "https://github.com/a2aproject/A2A-other"),
        hit("3", "https://github.com/someone/else"),
        hit("4", "https://notopenid.net/"),
        hit("5", "https://www.openid.net/specs/"),
      ],
    });
    const { items } = parseHits(json, linkTargets(sources));
    expect(items.map((i) => i.url.split("=")[1])).toEqual(["1", "5"]);
  });
});
