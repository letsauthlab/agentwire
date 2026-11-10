import { describe, expect, it } from "vitest";
import { storySchema } from "@/schema";

const item = {
  url: "https://example.org/post",
  title: "A headline",
  source: "example",
  published: "2026-11-10T09:00:00Z",
  fetched: "2026-11-10T09:30:00Z",
};
const story = {
  id: "k3f9a",
  revision: 1,
  recorded: "2026-11-10T09:31:00Z",
  type: "draft",
  topics: ["standards"],
  primary: item,
  summary: { text: "Two sentences.", model: "model-name", prompt: "summary-v1" },
  reactions: [],
};

describe("storySchema", () => {
  it("accepts a story and defaults hidden to false", () => {
    expect(storySchema.parse(story).hidden).toBe(false);
  });

  it("accepts a story whose text was too short to summarise", () => {
    const parsed = storySchema.parse({ ...story, summary: { ...story.summary, text: null } });
    expect(parsed.summary.text).toBeNull();
  });

  it("rejects an item address that is not https", () => {
    const bad = { ...story, primary: { ...item, url: "http://example.org/post" } };
    expect(storySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a topic outside the list and an unknown field", () => {
    expect(storySchema.safeParse({ ...story, topics: ["gossip"] }).success).toBe(false);
    expect(storySchema.safeParse({ ...story, weight: 2 }).success).toBe(false);
  });
});
