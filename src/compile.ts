import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import { build } from "esbuild";

import type { RenderOptions } from "./schema.js";

const require = createRequire(import.meta.url);
const reactDir = dirname(require.resolve("react/package.json"));
const reactDomDir = dirname(require.resolve("react-dom/package.json"));

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function compileReact(
  options: RenderOptions
): Promise<{ js: string; css: string }> {
  const source = (options.code ?? "").trim();
  const contents = source.startsWith("<")
    ? `export default function Preview(){ return (${source.replace(/;\s*$/u, "")}); }`
    : source;
  const result = await build({
    alias: { react: reactDir, "react-dom": reactDomDir },
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    format: "iife",
    inject: ["agent:react-shim"],
    jsx: "automatic",
    loader: {
      ".jpeg": "dataurl",
      ".jpg": "dataurl",
      ".png": "dataurl",
      ".svg": "dataurl",
      ".webp": "dataurl",
      ".woff": "dataurl",
      ".woff2": "dataurl",
    },
    logLevel: "silent",
    minify: true,
    outfile: "preview.js",
    platform: "browser",
    plugins: [
      {
        name: "agent-source",
        setup(builder) {
          // esbuild uses Go regex syntax, which rejects JavaScript Unicode flags.
          // oxlint-disable-next-line require-unicode-regexp
          builder.onResolve({ filter: /^agent:/ }, (args) => ({
            path: args.path,
            namespace: "agent",
          }));
          builder.onLoad(
            {
              // oxlint-disable-next-line require-unicode-regexp
              filter: /.*/,
              namespace: "agent",
            },
            (args) => ({
              contents:
                args.path === "agent:react-shim"
                  ? 'export * as React from "react";'
                  : contents,
              loader: "tsx",
              resolveDir: resolve(options.resolveDir ?? process.cwd()),
            })
          );
        },
      },
    ],
    stdin: {
      contents: `import Component from 'agent:component'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom'; import {createElement} from 'react'; flushSync(()=>createRoot(document.getElementById('root')).render(createElement(Component))); window.__agentRenderReady = true;`,
      resolveDir: resolve(options.resolveDir ?? process.cwd()),
    },
    write: false,
  });
  return {
    css:
      result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "",
    js:
      result.outputFiles.find((file) => file.path.endsWith(".js"))?.text ?? "",
  };
}
