import { readFileSync } from "node:fs";

// Compares the design tokens with letsauth's (docs/DECISIONS.md, "Design tokens come from letsauth").
// Agentwire takes its tokens from letsauthlab/letsauth so the lab's sites read as one family. This
// check reports every token defined here whose value differs there, or that letsauth no longer
// defines. It needs the network, so it runs as its own CI job and is not part of `pnpm check`.
//
// Usage: pnpm check:tokens [path-or-url-of-letsauth-tokens.css]

const LETSAUTH =
  "https://raw.githubusercontent.com/letsauthlab/letsauth/main/src/styles/tokens.css";
const source = process.argv[2] ?? LETSAUTH;

/** The custom properties declared in the first `:root` block of a stylesheet. */
export function rootTokens(css: string): Map<string, string> {
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const tokens = new Map<string, string>();
  for (const match of block
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value.replace(/\s+/g, " ").trim());
  }
  return tokens;
}

async function read(from: string): Promise<string> {
  if (!/^https?:/.test(from)) return readFileSync(from, "utf8");
  const response = await fetch(from);
  if (!response.ok) throw new Error(`${from} answered ${response.status}`);
  return response.text();
}

const ours = rootTokens(readFileSync("src/styles/tokens.css", "utf8"));
const theirs = rootTokens(await read(source));

const drift: string[] = [];
for (const [name, value] of ours) {
  const other = theirs.get(name);
  if (other === undefined) drift.push(`${name}: letsauth no longer defines it`);
  else if (other !== value) drift.push(`${name}: here ${value} / letsauth ${other}`);
}

if (drift.length > 0) {
  console.error(`${drift.length} token(s) differ from letsauth:`);
  for (const d of drift) console.error(`  ${d}`);
  console.error("Take letsauth's value, or record the difference in docs/DECISIONS.md.");
  process.exit(1);
}
console.log(`${ours.size} tokens match letsauth.`);
