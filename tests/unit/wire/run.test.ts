import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Source } from "@/schema/source";
import { runFetch } from "@/wire/fetch/run";
import { wireItemSchema } from "@/wire/item";
import { emptyState, readState, writeState } from "@/wire/state";
import { fakeNet, fixture } from "./helpers";

const NOW = new Date("2026-11-11T12:00:00Z");

const source = (id: string, extra: Partial<Source>): Source => ({
  id,
  name: id,
  url: "https://example.org/",
  kind: "open-source",
  tier: "core",
  topics: ["standards"],
  status: "verified",
  ...extra,
});

const openid = source("openid", {
  url: "https://openid.net/",
  adapter: "feed",
  fetch: "https://openid.net/feed/",
});
const openidTag = source("openid-tag", {
  url: "https://openid.net/",
  adapter: "feed",
  fetch: "https://openid.net/tag/ai/feed/",
});

const feedOf = (...items: string[]) =>
  `<rss><channel>${items.map((i) => `<item>${i}</item>`).join("")}</channel></rss>`;
const long = "A sentence that carries meaning for the reader. ".repeat(12);

describe("runFetch", () => {
  it("writes valid items and reports no new items on a second run", async () => {
    const net = fakeNet({
      "https://openid.net/feed/": { headers: { etag: '"v1"' }, body: fixture("feed-rss.xml") },
    });
    const state = emptyState();
    const run = () => runFetch({ sources: [openid], state, fetcher: net.fetcher, now: () => NOW });

    const first = await run();
    expect(first.reports).toEqual([
      { id: "openid", fetched: 2, fresh: 2, seen: 0, old: 0, failed: 0 },
    ]);
    for (const item of first.items) expect(wireItemSchema.safeParse(item).success).toBe(true);
    expect(first.items[0]).toMatchObject({
      url: "https://openid.net/closing-the-assurance-gap/",
      source: "openid",
      published: "2026-11-05T10:31:22.000Z",
      fetched: NOW.toISOString(),
    });
    expect(first.items[0]?.text.length).toBeGreaterThan(200);

    const second = await run();
    expect(second.items).toEqual([]);
    expect(second.reports[0]).toMatchObject({ fetched: 2, fresh: 0, seen: 2 });
  });

  it("makes the next request conditional and reads nothing on a 304 answer", async () => {
    const net = fakeNet({
      "https://openid.net/feed/": (headers) =>
        headers["if-none-match"] === '"v1"'
          ? { status: 304 }
          : { headers: { etag: '"v1"' }, body: fixture("feed-rss.xml") },
    });
    const state = emptyState();
    const run = () => runFetch({ sources: [openid], state, fetcher: net.fetcher, now: () => NOW });
    await run();
    expect(state.sources.openid?.validators["https://openid.net/feed/"]).toEqual({ etag: '"v1"' });
    const second = await run();
    expect(second.reports[0]).toMatchObject({ fetched: 0, fresh: 0, seen: 0 });
  });

  it("drops an item that a second source carries too", async () => {
    const net = fakeNet({
      "https://openid.net/feed/": { body: fixture("feed-rss.xml") },
      "https://openid.net/tag/ai/feed/": { body: fixture("feed-rss.xml") },
    });
    const { items, reports } = await runFetch({
      sources: [openidTag, openid],
      state: emptyState(),
      fetcher: net.fetcher,
      now: () => NOW,
    });
    expect(items.map((i) => i.source)).toEqual(["openid", "openid"]);
    expect(reports.map((r) => [r.id, r.fresh, r.seen])).toEqual([
      ["openid", 2, 0],
      ["openid-tag", 0, 2],
    ]);
  });

  it("drops the same text at a second address, and an address with tracking added", async () => {
    const body = `<description>${long}</description><pubDate>Tue, 10 Nov 2026 09:00:00 GMT</pubDate>`;
    const net = fakeNet({
      "https://openid.net/feed/": {
        body: feedOf(
          `<title>One</title><link>https://example.org/a</link>${body}`,
          `<title>One</title><link>https://example.org/a?utm_source=feed#top</link>${body}`,
          `<title>One</title><link>https://example.org/moved</link>${body}`,
        ),
      },
    });
    const { items, reports } = await runFetch({
      sources: [openid],
      state: emptyState(),
      fetcher: net.fetcher,
      now: () => NOW,
    });
    expect(items.map((i) => i.url)).toEqual(["https://example.org/a"]);
    expect(reports[0]).toMatchObject({ fetched: 3, fresh: 1, seen: 2 });
  });

  it("drops old items and items without a usable address", async () => {
    const net = fakeNet({
      "https://openid.net/feed/": {
        body: feedOf(
          `<title>Old</title><link>https://example.org/old</link><pubDate>Mon, 05 Jan 2026 09:00:00 GMT</pubDate><description>${long}</description>`,
          `<title>Plain</title><link>http://example.org/plain</link><description>${long}</description>`,
          `<title>No date</title><link>https://example.org/undated</link><description>${long} More.</description>`,
        ),
      },
    });
    const { items, reports } = await runFetch({
      sources: [openid],
      state: emptyState(),
      fetcher: net.fetcher,
      now: () => NOW,
    });
    expect(reports[0]).toMatchObject({ fetched: 3, fresh: 1, old: 1, failed: 1 });
    expect(items[0]).toMatchObject({ title: "No date", published: NOW.toISOString() });
  });

  it("fetches the page when the feed carries only a teaser", async () => {
    const net = fakeNet({
      "https://openid.net/feed/": {
        body: feedOf(
          "<title>Teaser</title><link>https://example.org/posts/draft</link><description>Read more.</description>",
        ),
      },
      "https://example.org/posts/draft": {
        headers: { "content-type": "text/html; charset=utf-8" },
        body: fixture("article.html"),
      },
    });
    const { items } = await runFetch({
      sources: [openid],
      state: emptyState(),
      fetcher: net.fetcher,
      now: () => NOW,
    });
    expect(items[0]?.text).toContain("Implementers are asked to send feedback");
    expect(items[0]?.text).not.toContain("All posts");
    expect(items[0]?.links).toEqual([
      "https://datatracker.ietf.org/doc/draft-example-agent/01/",
      "https://example.org/notes/background",
    ]);
  });

  it("keeps the teaser when robots.txt forbids the page", async () => {
    const net = fakeNet({
      "https://openid.net/feed/": {
        body: feedOf(
          "<title>Teaser</title><link>https://example.org/posts/draft</link><description>Read more.</description>",
        ),
      },
      "https://example.org/robots.txt": { body: "User-agent: *\nDisallow: /posts/" },
      "https://example.org/posts/draft": { body: fixture("article.html") },
    });
    const { items } = await runFetch({
      sources: [openid],
      state: emptyState(),
      fetcher: net.fetcher,
      now: () => NOW,
    });
    expect(items[0]?.text).toBe("Read more.");
    expect(net.requests.map((r) => r.url)).not.toContain("https://example.org/posts/draft");
  });

  it("reports a source that fails, goes on, and leaves its position alone", async () => {
    const broken = source("broken", { adapter: "feed", fetch: "https://broken.example/feed" });
    const inside = source("inside", { adapter: "feed", fetch: "https://10.0.0.1/feed" });
    const page = source("page", { adapter: "feed", fetch: "https://page.example/feed" });
    const net = fakeNet({
      "https://broken.example/feed": { status: 403 },
      "https://page.example/feed": { body: "<html>\u001b[31mnot a feed</html>" },
      "https://openid.net/feed/": { body: fixture("feed-rss.xml") },
    });
    const state = emptyState();
    const { reports } = await runFetch({
      sources: [broken, inside, openid, page],
      state,
      fetcher: net.fetcher,
      now: () => NOW,
    });
    expect(reports.map((r) => [r.id, r.fresh, r.error])).toEqual([
      ["broken", 0, "broken: status 403"],
      ["inside", 0, "private-address: 10.0.0.1"],
      ["openid", 2, undefined],
      ["page", 0, "not a feed"],
    ]);
    expect(Object.keys(state.sources)).toEqual(["openid"]);
  });

  it("fetches verified sources only, unless it is the verifying run", async () => {
    const proposed = { ...openid, id: "proposed", status: "proposed" as const };
    const disabled = { ...openid, id: "disabled", status: "disabled" as const };
    const noTarget = source("no-target", { status: "proposed" });
    const sources = [disabled, noTarget, openid, proposed];
    const net = fakeNet({ "https://openid.net/feed/": { body: fixture("feed-rss.xml") } });
    const ids = async (options: { includeProposed?: boolean; only?: string[] }) =>
      (
        await runFetch({
          sources,
          state: emptyState(),
          fetcher: net.fetcher,
          now: () => NOW,
          ...options,
        })
      ).reports.map((r) => r.id);
    expect(await ids({})).toEqual(["openid"]);
    expect(await ids({ includeProposed: true })).toEqual(["openid", "proposed"]);
    expect(await ids({ includeProposed: true, only: ["proposed"] })).toEqual(["proposed"]);
  });

  it("reads every adapter's fixture through the run", async () => {
    const sources = [
      source("a2a", {
        url: "https://github.com/a2aproject/A2A",
        adapter: "github-releases",
        fetch: "a2aproject/A2A",
      }),
      source("arxiv", {
        adapter: "arxiv",
        fetch: 'cat:cs.CR AND abs:"prompt injection"',
        tier: "broad",
      }),
      source("hn", {
        tier: "reactions",
        adapter: "hn-search",
        fetch: "https://hn.algolia.com/api/v1/search_by_date",
      }),
      source("ietf-oauth", { adapter: "datatracker", fetch: "oauth" }),
      openid,
    ];
    const net = fakeNet({});
    const answer = (prefix: string, name: string) => (url: string) =>
      url.startsWith(prefix) ? { body: fixture(name) } : undefined;
    const answers = [
      answer("https://api.github.com/repos/a2aproject/A2A/releases", "github-releases.json"),
      answer("https://export.arxiv.org/api/query?", "arxiv-query.xml"),
      answer("https://hn.algolia.com/api/v1/search_by_date?", "hn-search.json"),
      answer("https://datatracker.ietf.org/api/v1/doc/document/?", "datatracker-documents.json"),
      answer("https://openid.net/feed/", "feed-rss.xml"),
    ];
    // Query strings vary, so the table is filled as the requests come in.
    const routes = new Proxy(net.routes, {
      get: (_target, url: string) => answers.map((a) => a(url)).find(Boolean),
    });
    const proxied = fakeNet(routes);
    const state = emptyState();
    const { items, reports } = await runFetch({
      sources,
      state,
      fetcher: proxied.fetcher,
      now: () => NOW,
      maxAgeDays: 400,
    });
    expect(reports.map((r) => [r.id, r.fetched, r.fresh, r.error])).toEqual([
      ["a2a", 2, 2, undefined],
      ["arxiv", 2, 2, undefined],
      ["hn", 3, 3, undefined],
      ["ietf-oauth", 3, 3, undefined],
      ["openid", 2, 2, undefined],
    ]);
    for (const item of items) expect(wireItemSchema.safeParse(item).success).toBe(true);
    const hn = items.find((i) => i.source === "hn");
    expect(hn?.links).toEqual(["https://openid.net/specs/fastfed-core-1_0-03.html"]);
    expect(state.sources.hn?.since).toBe(NOW.toISOString());
    const arxiv = proxied.requests.find((r) => r.url.startsWith("https://export.arxiv.org/api/"));
    expect(arxiv?.url).toContain("search_query=cat%3Acs.CR+AND+abs%3A%22prompt+injection%22");
    expect(proxied.requests.map((r) => r.url)).not.toContain("https://export.arxiv.org/robots.txt");
  });
});

describe("the state file", () => {
  it("starts empty, and reads back what was written", () => {
    const path = join(mkdtempSync(join(tmpdir(), "agentwire-")), "var", "state.json");
    expect(readState(path)).toEqual(emptyState());
    const state = emptyState();
    state.seen["u:abc"] = NOW.toISOString();
    state.sources.openid = { validators: { "https://openid.net/feed/": { etag: '"v1"' } } };
    writeState(path, state);
    expect(readState(path)).toEqual(state);
  });

  it("refuses a broken state file instead of starting over", () => {
    const path = join(mkdtempSync(join(tmpdir(), "agentwire-")), "state.json");
    writeFileSync(path, '{"version":2}');
    expect(() => readState(path)).toThrow();
  });
});
