import { defineConfig } from "tsdown";

export default defineConfig([
  {
    banner: { js: "#!/usr/bin/env node" },
    clean: true,
    dts: false,
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    fixedExtension: false,
    sourcemap: true,
    target: "node22",
  },
  {
    dts: true,
    entry: { index: "src/index.ts" },
    format: ["esm"],
    fixedExtension: false,
    sourcemap: true,
    target: "node22",
  },
]);
