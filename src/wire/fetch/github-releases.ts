import { z } from "zod";
import { type Adapter, type RawItem, targetOf, toInstant } from "./adapter";

const releaseSchema = z.object({
  html_url: z.string(),
  tag_name: z.string().min(1),
  name: z.string().nullable(),
  body: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  published_at: z.string().nullable(),
});

/**
 * Reads a list of releases from the GitHub REST API. Drafts and pre-releases are left out. The
 * headline is the repository and the release's own name, because "v1.2.0" alone says nothing.
 */
export function parseReleases(json: string, repository: string): RawItem[] {
  const list = z.array(z.unknown()).parse(JSON.parse(json));
  const items: RawItem[] = [];
  for (const entry of list) {
    const parsed = releaseSchema.safeParse(entry);
    if (!parsed.success) continue;
    const release = parsed.data;
    if (release.draft || release.prerelease) continue;
    const name = release.name?.trim() || release.tag_name;
    const published = toInstant(release.published_at ?? undefined);
    items.push({
      url: release.html_url,
      title: `${repository} ${name}`,
      text: release.body ?? "",
      complete: true,
      ...(published ? { published } : {}),
    });
  }
  return items;
}

/**
 * The releases of one repository. The fetch target is `owner/repository`. GitHub forbids its
 * `.atom` pages to robots, so this reads the REST API, which allows 60 requests an hour without
 * a token and answers conditional requests (docs/briefs/02-wire-fetch.md).
 */
export const githubReleasesAdapter: Adapter = {
  async fetch(source, context) {
    const repository = targetOf(source);
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/.test(repository)) {
      throw new Error(`${source.id}: not a repository`);
    }
    const response = await context.get(
      `https://api.github.com/repos/${repository}/releases?per_page=30`,
      {
        conditional: true,
        headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      },
    );
    return response.status === 304 ? [] : parseReleases(response.body, repository);
  },
};
