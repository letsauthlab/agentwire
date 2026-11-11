import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSources } from "@/lib/sources";

function file(yaml: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "agentwire-")), "sources.yaml");
  writeFileSync(path, yaml);
  return path;
}

const entry = (id: string, extra = "") =>
  `- id: ${id}\n  name: ${id}\n  url: https://example.org/\n  kind: open-source\n  tier: core\n  topics: [standards]\n  status: proposed\n${extra}`;

describe("readSources", () => {
  it("accepts the repository's source list", () => {
    const { sources, errors } = readSources("data/sources.yaml");
    expect(errors).toEqual([]);
    expect(sources.length).toBeGreaterThan(0);
  });

  it("reports a duplicate id", () => {
    const { errors } = readSources(file(entry("a") + entry("a")));
    expect(errors).toContain("a: id is used more than once");
  });

  it("reports entries that are out of alphabetical order", () => {
    const { errors } = readSources(file(entry("b") + entry("a")));
    expect(errors).toContain("a: out of order, it sorts before b");
  });

  it("rejects a plain http address and an unknown field", () => {
    const yaml = entry("a").replace("https://", "http://") + entry("b", "  weight: 3\n");
    const { errors } = readSources(file(yaml));
    expect(errors.some((e) => e.startsWith("a: url"))).toBe(true);
    expect(errors.some((e) => e.startsWith("b:"))).toBe(true);
  });

  it("accepts the press kind and rejects an adapter outside the list", () => {
    const press = entry("a").replace("open-source", "press");
    expect(readSources(file(press)).errors).toEqual([]);
    const { errors } = readSources(file(entry("a", "  adapter: lobsters\n")));
    expect(errors.some((e) => e.startsWith("a: adapter"))).toBe(true);
  });

  it("requires an adapter and a fetch target on a verified source", () => {
    const { errors } = readSources(file(entry("a").replace("proposed", "verified")));
    expect(errors).toEqual(["a: (entry): a verified source needs an adapter and a fetch target"]);
  });
});
