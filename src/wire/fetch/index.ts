import type { Source } from "../../schema/source";
import type { Adapter } from "./adapter";
import { arxivAdapter } from "./arxiv";
import { datatrackerAdapter } from "./datatracker";
import { feedAdapter } from "./feed";
import { githubReleasesAdapter } from "./github-releases";
import { hnSearchAdapter } from "./hn-search";

/** One adapter per kind of source, behind one interface. */
export const ADAPTERS: Record<NonNullable<Source["adapter"]>, Adapter> = {
  feed: feedAdapter,
  datatracker: datatrackerAdapter,
  "github-releases": githubReleasesAdapter,
  arxiv: arxivAdapter,
  "hn-search": hnSearchAdapter,
};
