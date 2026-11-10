import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

// Byte budgets over the built site (docs/DECISIONS.md, "Budgets are release gates"). HTML, CSS and JavaScript are measured gzip level 6; woff2 fonts
// are already compressed and count as stored. Every limit fails the run.

const KB = 1024;
const LIMITS = {
  html: { max: 35 * KB, label: "HTML per page" },
  css: { max: 15 * KB, label: "CSS per page" },
  js: { max: 8 * KB, label: "JavaScript per page" },
  fonts: { max: 35 * KB, label: "Preloaded fonts per page" },
};

const dist = resolve(process.argv[2] ?? "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error(`No build at ${dist}. Run pnpm build first.`);
  process.exit(1);
}

const gz = (data: string | Buffer) => (data.length ? gzipSync(data, { level: 6 }).length : 0);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

/** The values of one attribute on every tag that matches, in document order. */
function attrs(html: string, tag: RegExp, attr: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(tag)) {
    const value = new RegExp(`\\s${attr}=["']([^"']+)["']`).exec(match[0])?.[1];
    if (value) out.push(value);
  }
  return out;
}

const isExternal = (url: string) => /^(https?:)?\/\//.test(url);
const local = (url: string) => join(dist, url.split(/[?#]/)[0] ?? "");
const size = (url: string, compress: boolean) => {
  const path = local(url);
  if (!existsSync(path)) return 0;
  const data = readFileSync(path);
  return compress ? gz(data) : data.length;
};
const sum = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0);
const inline = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}(?![^>]*\\ssrc=)[^>]*>([\\s\\S]*?)</${tag}>`, "g"))]
    .map((m) => m[1] ?? "")
    .join("\n");

const failures: string[] = [];
const worst = { html: 0, css: 0, js: 0, fonts: 0 };

for (const file of pages(dist)) {
  const route = `/${relative(dist, file).split(sep).join("/")}`;
  const html = readFileSync(file, "utf8");

  const stylesheets = attrs(html, /<link\b[^>]*rel=["']stylesheet["'][^>]*>/g, "href");
  const scripts = attrs(html, /<script\b[^>]*>/g, "src");
  const preloads = attrs(
    html,
    /<link\b[^>]*rel=["']preload["'][^>]*as=["']font["'][^>]*>/g,
    "href",
  );
  const media = attrs(html, /<(?:img|source|video|audio|iframe)\b[^>]*>/g, "src");

  // A page loads nothing from another host.
  for (const url of [...stylesheets, ...scripts, ...preloads, ...media].filter(isExternal)) {
    failures.push(`${route}: third-party request to ${url}`);
  }

  const measured = {
    html: gz(html),
    css: sum(stylesheets.map((u) => size(u, true))) + gz(inline(html, "style")),
    js: sum(scripts.map((u) => size(u, true))) + gz(inline(html, "script")),
    fonts: sum(preloads.map((u) => size(u, false))),
  };
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    worst[key] = Math.max(worst[key], measured[key]);
    if (measured[key] > LIMITS[key].max) {
      failures.push(
        `${route}: ${LIMITS[key].label} is ${(measured[key] / KB).toFixed(1)} kB, over ${LIMITS[key].max / KB} kB`,
      );
    }
  }
}

for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
  console.log(
    `${LIMITS[key].label}: largest ${(worst[key] / KB).toFixed(1)} kB of ${LIMITS[key].max / KB} kB`,
  );
}
if (failures.length > 0) {
  console.error(`\n${failures.length} budget failure(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("All budgets met, no third-party requests.");
