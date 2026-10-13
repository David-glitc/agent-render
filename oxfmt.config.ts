import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // The separately validated HyperFrames project owns its composition formatting.
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), "videos/**"],
});
