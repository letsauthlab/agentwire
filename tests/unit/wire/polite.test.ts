import { describe, expect, it } from "vitest";
import { FetchRefused } from "@/wire/http/client";
import { isAllowed, parseRobots } from "@/wire/http/robots";
import { fakeNet } from "./helpers";

describe("robots.txt", () => {
  const rules = (text: string) => parseRobots(text, "agentwire");

  it("allows everything when the file has no rule for the client", () => {
    expect(isAllowed(rules(""), "/any")).toBe(true);
    expect(isAllowed(rules("User-agent: other\nDisallow: /"), "/any")).toBe(true);
    expect(isAllowed(rules("User-agent: *\nDisallow:"), "/any")).toBe(true);
  });

  it("obeys the rules for every client", () => {
    const r = rules("User-agent: *\nDisallow: /doc/pdf/ # no files\nAllow: /doc/pdf/open/");
    expect(isAllowed(r, "/doc/draft-x/")).toBe(true);
    expect(isAllowed(r, "/doc/pdf/draft-x")).toBe(false);
    expect(isAllowed(r, "/doc/pdf/open/draft-x")).toBe(true);
  });

  it("prefers the group that names the client", () => {
    const r = rules(
      "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nUser-agent: Agentwire\nDisallow: /private",
    );
    expect(isAllowed(r, "/feed")).toBe(true);
    expect(isAllowed(r, "/private/x")).toBe(false);
  });

  it("understands * and $ in a path", () => {
    const r = rules("User-agent: *\nDisallow: /*.atom$\nDisallow: /*/commits/");
    expect(isAllowed(r, "/owner/repo/releases.atom")).toBe(false);
    expect(isAllowed(r, "/owner/repo/releases.atom.html")).toBe(true);
    expect(isAllowed(r, "/owner/commits/main")).toBe(false);
  });
});

describe("the polite fetcher", () => {
  it("reads robots.txt once per host and refuses a forbidden path", async () => {
    const net = fakeNet({
      "https://example.org/robots.txt": { body: "User-agent: *\nDisallow: /private/" },
      "https://example.org/feed": { body: "feed" },
    });
    await net.fetcher.get("https://example.org/feed");
    await net.fetcher.get("https://example.org/feed");
    const refused = await net.fetcher.get("https://example.org/private/x").catch((e) => e);
    expect(refused).toBeInstanceOf(FetchRefused);
    expect((refused as FetchRefused).reason).toBe("robots");
    expect(net.requests.map((r) => r.url)).toEqual([
      "https://example.org/robots.txt",
      "https://example.org/feed",
      "https://example.org/feed",
    ]);
  });

  it("stays away when robots.txt fails with a server error", async () => {
    const net = fakeNet({
      "https://example.org/robots.txt": { status: 503 },
      "https://example.org/feed": { body: "feed" },
    });
    const refused = await net.fetcher.get("https://example.org/feed").catch((e) => e);
    expect((refused as FetchRefused).reason).toBe("robots");
  });

  it("skips robots.txt only when the caller says the use is allowed", async () => {
    const net = fakeNet({
      "https://example.org/robots.txt": { body: "User-agent: *\nDisallow: /" },
      "https://example.org/api": { body: "{}" },
    });
    const response = await net.fetcher.get("https://example.org/api", { robotsExempt: true });
    expect(response.status).toBe(200);
    expect(net.requests.map((r) => r.url)).toEqual(["https://example.org/api"]);
  });

  it("spaces requests to one host and not to another", async () => {
    const net = fakeNet({
      "https://a.example/1": { body: "1" },
      "https://a.example/2": { body: "2" },
      "https://b.example/1": { body: "1" },
    });
    await net.fetcher.get("https://a.example/1", { robotsExempt: true });
    await net.fetcher.get("https://b.example/1", { robotsExempt: true });
    expect(net.sleeps).toEqual([]);
    await net.fetcher.get("https://a.example/2", { robotsExempt: true });
    expect(net.sleeps).toEqual([1000]);
    await net.fetcher.get("https://a.example/1", { robotsExempt: true, minIntervalMs: 3000 });
    expect(net.sleeps).toEqual([1000, 3000]);
  });

  it("sends validators and passes a 304 answer on", async () => {
    const net = fakeNet({
      "https://example.org/feed": (headers) =>
        headers["if-none-match"] === '"v1"' ? { status: 304 } : { body: "feed" },
    });
    const response = await net.fetcher.get("https://example.org/feed", {
      validators: { etag: '"v1"', lastModified: "Wed, 11 Nov 2026 10:00:00 GMT" },
    });
    expect(response.status).toBe(304);
    expect(net.requests.at(-1)?.headers["if-modified-since"]).toBe("Wed, 11 Nov 2026 10:00:00 GMT");
  });
});
