import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import { Command } from "commander";

import { startHttp } from "./http.js";
import { startMcp } from "./mcp.js";
import { Renderer } from "./renderer.js";
import type { RenderInput } from "./schema.js";

const program = new Command()
  .name("agent-render")
  .description(
    "Code in. Screenshot out. Render React, TSX, JSX, HTML, text, or URLs."
  )
  .version("0.0.1");

async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readSource(input: string | undefined, flags: { code?: string }) {
  if (input && flags.code !== undefined) {
    throw new Error("Use a file/URL/stdin or --code, not both");
  }
  const url = input && /^https?:\/\//u.test(input) ? input : undefined;
  const file = input && input !== "-" && !url ? resolve(input) : undefined;
  if (!input && flags.code === undefined && process.stdin.isTTY) {
    throw new Error(
      "Provide a file, URL, --code, or pipe source through stdin"
    );
  }
  const code = url
    ? undefined
    : (flags.code ?? (file ? await readFile(file, "utf-8") : await stdin()));
  return { code, file, url };
}

program
  .command("render [input]")
  .description(
    "Render a file, URL, or stdin (-). Prints JSON metadata; writes a PNG."
  )
  .option("-f, --format <format>", "html, react, tsx, jsx, or text")
  .option("-c, --code <source>", "Inline source")
  .option("-o, --output <path>", "Output PNG", "screenshot.png")
  .option("--width <pixels>", "Viewport width", Number, 1280)
  .option("--height <pixels>", "Viewport height", Number, 800)
  .option("--scale <factor>", "Device pixel ratio", Number, 1)
  .option("--full-page", "Capture the whole scrollable page")
  .option("--selector <selector>", "Capture a single element")
  .option("--wait-for <selector>", "Wait for a visible element")
  .option("--wait <ms>", "Additional settling time", Number, 0)
  .option("--timeout <ms>", "Render deadline", Number, 15_000)
  .option("--css <file>", "Inject a CSS file")
  .option("--base-url <url>", "Base URL for relative assets in piped HTML")
  .option("--resolve-dir <directory>", "Project directory for React imports")
  .option("--dark", "Dark color scheme")
  .option("--transparent", "Transparent background")
  .option("--server <url>", "Use a warm agent-render HTTP server")
  .action(async (input: string | undefined, flags) => {
    const { file, code, url } = await readSource(input, flags);
    const extension = file ? extname(file).slice(1).toLowerCase() : "";
    const formats: Record<string, string> = {
      js: "jsx",
      jsx: "jsx",
      tsx: "tsx",
      txt: "text",
    };
    const format = flags.format ?? formats[extension] ?? "html";
    const options: RenderInput = {
      ...(url ? { url } : { code }),
      baseUrl: flags.baseUrl,
      colorScheme: flags.dark ? "dark" : "light",
      css: flags.css ? await readFile(flags.css, "utf-8") : undefined,
      format,
      fullPage: flags.fullPage,
      height: flags.height,
      resolveDir: resolve(
        flags.resolveDir ?? (file ? dirname(file) : process.cwd())
      ),
      scale: flags.scale,
      selector: flags.selector,
      timeoutMs: flags.timeout,
      transparent: flags.transparent,
      waitForSelector: flags.waitFor,
      waitMs: flags.wait,
      width: flags.width,
    };
    const renderer = new Renderer();
    try {
      let result;
      if (flags.server) {
        const response = await fetch(new URL("/render?json=1", flags.server), {
          body: JSON.stringify(options),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout((options.timeoutMs ?? 15_000) + 5000),
        });
        const body = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(String(body.error));
        }
        result = {
          ...body,
          image: Buffer.from(body.image as string, "base64"),
        };
      } else {
        result = await renderer.render(options);
      }
      const { image, ...metadata } = result;
      const path = resolve(flags.output);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, image);
      process.stdout.write(`${JSON.stringify({ path, ...metadata })}\n`);
    } finally {
      await renderer.close();
    }
  });

program
  .command("mcp")
  .description(
    "Start an MCP stdio server; tool results include the image directly"
  )
  .action(startMcp);
program
  .command("serve")
  .description("Start a warm local HTTP renderer for curl and CLI calls")
  .option("--port <port>", "Loopback HTTP port", Number, 4783)
  .action(async ({ port }: { port: number }) => {
    const { close } = await startHttp(port);
    process.stderr.write(
      `agent-render listening on http://127.0.0.1:${port}\n`
    );
    process.once("SIGINT", () => {
      void close();
    });
    process.once("SIGTERM", () => {
      void close();
    });
  });

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
});
