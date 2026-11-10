// @ts-check

import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://agentwire.eu",
  trailingSlash: "always",
  // Bunny Storage serves <folder>/index.html for "/folder/" but has nothing to match "/folder"
  // or an extensionless page, so pages are folders and every internal link ends in a slash.
  // Bundled scripts, styles and fonts go to /assets/ instead of Astro's default /_astro/.
  build: { format: "directory", assets: "assets" },
});
