import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startHttp } from "../src/http.js";
import { Renderer } from "../src/renderer.js";

const exec = promisify(execFile);
const renderer = new Renderer();
let fixture: Server;
let origin: string;
let directory: string;

// Decode RGB/RGBA PNG pixels, including Chromium's adaptive scanline filters.
function pixel(image: Buffer, x: number, y: number): number[] {
  const width = image.readUInt32BE(16);
  const channels = image[25] === 6 ? 4 : 3;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < image.length;) {
    const length = image.readUInt32BE(offset);
    if (image.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(image.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  let previous = Buffer.alloc(stride);
  for (let row = 0; row <= y; row += 1) {
    const filter = raw[row * (stride + 1)];
    const current = Buffer.from(
      raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1))
    );
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? current[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const extra = [0, a, b, Math.floor((a + b) / 2), predictor][filter];
      current[i] = (current[i] + extra) & 255;
    }
    previous = current;
  }
  return [...previous.subarray(x * channels, x * channels + 3)];
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "agent-render-test-"));
  fixture = createServer((request, response) => {
    if (request.url === "/style.css") {
      response
        .writeHead(200, { "Content-Type": "text/css" })
        .end("body { margin:0; background:rgb(12,34,56) }");
    } else if (request.url === "/missing") {
      response.writeHead(404).end("missing");
    } else {
      response
        .writeHead(200, { "Content-Type": "text/html" })
        .end(
          '<!doctype html><link rel="stylesheet" href="/style.css"><h1>Website fixture</h1>'
        );
    }
  });
  await new Promise<void>((resolve) => {
    fixture.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
}, 30_000);
afterAll(async () => {
  await renderer.close();
  await new Promise<void>((resolve) => {
    fixture.close(() => resolve());
  });
  await rm(directory, { force: true, recursive: true });
});

describe("real Chromium output", () => {
  it("renders HTML pixels at the requested scale", async () => {
    const result = await renderer.render({
      code: '<body style="margin:0;background:rgb(255,0,0)">',
      height: 80,
      scale: 2,
      width: 120,
    });
    expect([result.width, result.height]).toEqual([240, 160]);
    expect(pixel(result.image, 100, 100)).toEqual([255, 0, 0]);
    expect(result.errors).toEqual([]);
  });
  it("renders a TSX module with hooks and a cropped selector", async () => {
    const result = await renderer.render({
      code: 'import {useState} from "react"; export default function App(){ const [color] = useState<string>("rgb(0,128,0)"); return <div id="card" style={{width:180,height:90,background:color}}/> }',
      format: "tsx",
      selector: "#card",
    });
    expect([result.width, result.height]).toEqual([180, 90]);
    expect(pixel(result.image, 10, 10)).toEqual([0, 128, 0]);
    expect(result.errors).toEqual([]);
  });
  it("supports JSX expressions and React namespace references", async () => {
    const result = await renderer.render({
      code: '<React.Fragment><div style={{height:50,background:"blue"}} /></React.Fragment>',
      format: "jsx",
      height: 50,
      width: 100,
    });
    expect(pixel(result.image, 10, 10)).toEqual([0, 0, 255]);
  });
  it("bundles local TSX and CSS imports", async () => {
    await writeFile(
      join(directory, "child.tsx"),
      'export default () => <div id="local" />'
    );
    await writeFile(
      join(directory, "style.css"),
      "#local { width:70px; height:60px; background:rgb(11,22,33) }"
    );
    const result = await renderer.render({
      code: 'import Child from "./child"; import "./style.css"; export default Child;',
      format: "react",
      resolveDir: directory,
      selector: "#local",
    });
    expect([result.width, result.height]).toEqual([70, 60]);
    expect(pixel(result.image, 10, 10)).toEqual([11, 22, 33]);
  });
  it("renders text literally instead of executing markup", async () => {
    const result = await renderer.render({
      code: '<script>throw new Error("unsafe")</script>',
      format: "text",
      selector: "pre",
    });
    expect(result.errors).toEqual([]);
    expect(result.width).toBeGreaterThan(100);
  });
  it("captures URLs and resolves assets from curl-style HTML", async () => {
    const direct = await renderer.render({
      height: 100,
      url: origin,
      width: 100,
    });
    const source = await (await fetch(origin)).text();
    const piped = await renderer.render({
      baseUrl: origin,
      code: source,
      height: 100,
      width: 100,
    });
    expect(pixel(direct.image, 99, 99)).toEqual([12, 34, 56]);
    expect(pixel(piped.image, 99, 99)).toEqual([12, 34, 56]);
    expect(piped.errors).toEqual([]);
  });
  it("executes scripts only once with baseUrl", async () => {
    const result = await renderer.render({
      baseUrl: origin,
      code: '<body><script>window.count=(window.count||0)+1;document.body.style.background=window.count===1?"red":"blue"</script>',
      height: 50,
      width: 50,
    });
    expect(pixel(result.image, 25, 25)).toEqual([255, 0, 0]);
  });
  it("waits for async readiness and captures full page", async () => {
    const result = await renderer.render({
      code: '<body style="margin:0"><script>setTimeout(()=>document.body.innerHTML=\'<div id="ready" style="height:1100px;background:red"></div>\',80)</script>',
      fullPage: true,
      height: 100,
      waitForSelector: "#ready",
      width: 100,
    });
    expect(result.height).toBe(1100);
  });
  it("reports browser exceptions without hiding the screenshot", async () => {
    const result = await renderer.render({
      code: '<h1>Still visible</h1><script>throw new Error("fixture failure")</script>',
    });
    expect(result.errors.join(" ")).toContain("fixture failure");
    expect(result.image.length).toBeGreaterThan(100);
  });
  it("rejects invalid input, bad code, missing selectors, and HTTP errors", async () => {
    await expect(
      renderer.render({ code: "hello", url: origin })
    ).rejects.toThrow("exactly one");
    await expect(
      renderer.render({ url: "file:///etc/passwd" })
    ).rejects.toThrow("http");
    await expect(renderer.render({ code: "x", width: -1 })).rejects.toThrow();
    await expect(
      renderer.render({ code: "export default () => <", format: "tsx" })
    ).rejects.toThrow();
    await expect(
      renderer.render({
        code: "<p>ok</p>",
        selector: "#missing",
        timeoutMs: 250,
      })
    ).rejects.toThrow();
    await expect(renderer.render({ url: `${origin}/missing` })).rejects.toThrow(
      "404"
    );
    const recovery = await renderer.render({ code: "<h1>Recovered</h1>" });
    expect(recovery.errors).toEqual([]);
  });
});

it("serves PNG/JSON over loopback HTTP and validates requests", async () => {
  const app = await startHttp(0);
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  try {
    const response = await fetch(`${base}/render`, {
      body: JSON.stringify({ code: "<h1>HTTP</h1>", width: 100, height: 80 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.headers.get("content-type")).toBe("image/png");
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(100);
    const json = await (
      await fetch(`${base}/render?json=1`, {
        body: JSON.stringify({ code: "Hi", format: "text" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    ).json();
    expect(json.mimeType).toBe("image/png");
    expect(Buffer.from(json.image, "base64").readUInt32BE(20)).toBe(800);
    expect(
      (await fetch(`${base}/render`, { body: "{}", method: "POST" })).status
    ).toBe(415);
    expect(
      (
        await fetch(`${base}/health`, {
          headers: { Origin: "https://evil.example" },
        })
      ).status
    ).toBe(403);
    expect(
      (
        await fetch(`${base}/render`, {
          body: "{bad",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      ).status
    ).toBe(400);
  } finally {
    await app.close();
  }
}, 30_000);

it("CLI writes PNG and machine-readable JSON", async () => {
  const path = join(directory, "cli.png");
  const { stdout } = await exec(process.execPath, [
    "dist/cli.js",
    "render",
    "--format",
    "jsx",
    "--code",
    "<h1>CLI</h1>",
    "--width",
    "200",
    "--height",
    "100",
    "-o",
    path,
  ]);
  const metadata = JSON.parse(stdout);
  expect(metadata.path).toBe(path);
  expect(metadata.width).toBe(200);
  expect((await readFile(path)).readUInt32BE(20)).toBe(100);
}, 30_000);

it("MCP exposes render and returns image content to a real client", async () => {
  const transport = new StdioClientTransport({
    args: ["dist/cli.js", "mcp"],
    command: process.execPath,
    stderr: "pipe",
  });
  const client = new Client({ name: "agent-render-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
      "render"
    );
    const result = await client.callTool({
      arguments: {
        code: "<h1>MCP image</h1>",
        format: "jsx",
        height: 90,
        width: 160,
      },
      name: "render",
    });
    expect(result.isError).not.toBe(true);
    const blocks = result.content as {
      type: string;
      data?: string;
      mimeType?: string;
    }[];
    const image = blocks.find((block) => block.type === "image")!;
    expect(image.mimeType).toBe("image/png");
    expect(Buffer.from(image.data!, "base64").readUInt32BE(16)).toBe(160);
    const invalid = await client.callTool({
      arguments: { code: "export default () => <", format: "tsx" },
      name: "render",
    });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
  }
}, 30_000);
