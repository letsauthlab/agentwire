import { describe, expect, it } from "vitest";
import { canonicalUrl, contentHash, urlKey } from "@/wire/dedupe/canonical";
import { cleanText, extractArticle, htmlToText, linksInText } from "@/wire/extract/text";
import { fixture } from "./helpers";

describe("canonicalUrl", () => {
  it("removes the fragment and tracking parameters and keeps the rest", () => {
    expect(
      canonicalUrl("https://Example.org/post?utm_source=feed&id=7&fbclid=abc&utm_medium=rss#top"),
    ).toBe("https://example.org/post?id=7");
    expect(canonicalUrl("https://example.org/post?utm_campaign=x")).toBe(
      "https://example.org/post",
    );
  });

  it("resolves a relative address against a base", () => {
    expect(canonicalUrl("/a/b", "https://example.org/feed")).toBe("https://example.org/a/b");
  });

  it("gives the same key for two spellings of one address", () => {
    const a = canonicalUrl("https://example.org/post?utm_source=a");
    const b = canonicalUrl("https://EXAMPLE.org/post#comments");
    expect(a).toBe(b);
    expect(urlKey(a ?? "")).toBe(urlKey(b ?? ""));
  });

  it("refuses what is not a plain https address", () => {
    for (const bad of [
      "http://example.org/",
      "javascript:alert(1)",
      "https://user:pw@example.org/",
      "mailto:a@example.org",
      "not an address",
    ]) {
      expect(canonicalUrl(bad), bad).toBeUndefined();
    }
  });
});

describe("contentHash", () => {
  it("ignores case and white space and notices a different text", () => {
    expect(contentHash("A  Title", "Some\n text")).toBe(contentHash("a title", "some text"));
    expect(contentHash("A title", "Some text")).not.toBe(contentHash("A title", "Other text"));
  });
});

describe("text extraction", () => {
  it("takes the article and leaves navigation, scripts and styles out", () => {
    const { text, links } = extractArticle(fixture("article.html"), {
      baseUrl: "https://example.org/posts/draft",
    });
    expect(text).toContain("A new draft for agent identity");
    expect(text).toContain("Implementers are asked to send feedback");
    for (const noise of ["do not read me", "color: red", "All posts", "Copyright", "newsletter"]) {
      expect(text).not.toContain(noise);
    }
    expect(links).toEqual([
      "https://datatracker.ietf.org/doc/draft-example-agent/01/",
      "https://example.org/notes/background?utm_source=feed",
    ]);
  });

  it("caps the length of the text", () => {
    const html = `<article>${"<p>word word word</p>".repeat(500)}</article>`;
    expect(extractArticle(html, { maxChars: 100 }).text.length).toBeLessThanOrEqual(100);
  });

  it("reads the content a feed carries and decodes entities", () => {
    const { text, links } = htmlToText(
      '<p>Draft&nbsp;06 &amp; more</p><p>See <a href="https://example.org/a">this</a>.</p>',
    );
    expect(text).toBe("Draft 06 & more\nSee this.");
    expect(links).toEqual(["https://example.org/a"]);
  });

  it("removes control and invisible characters", () => {
    expect(cleanText("a\u0000b\u200bc\u001b[31m \u202ed\ufeff")).toBe("abc[31m d");
  });

  it("finds the https addresses written in Markdown", () => {
    expect(
      linksInText(
        "See [the notes](https://example.org/notes). Also http://x.example and https://example.org/b, twice https://example.org/b",
      ),
    ).toEqual(["https://example.org/notes", "https://example.org/b"]);
  });
});
