import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";

import { Renderer } from "./renderer.js";

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > 2_500_000) {
      throw new Error("Request exceeds 2.5MB limit");
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

export async function startHttp(port: number) {
  const renderer = new Renderer();
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const host = request.headers.host ?? "";
    if (
      !/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/u.test(host) ||
      request.headers.origin
    ) {
      response.writeHead(403).end("Local CLI requests only");
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (
      request.method !== "POST" ||
      !["/render", "/render?json=1"].includes(request.url ?? "")
    ) {
      response.writeHead(404).end("POST /render with JSON; GET /health");
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      response.writeHead(415).end("Content-Type must be application/json");
      return;
    }
    try {
      const input = await readJson(request);
      const { image, ...metadata } = await renderer.render(
        input as Parameters<Renderer["render"]>[0]
      );
      if (request.url === "/render?json=1") {
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({ ...metadata, image: image.toString("base64") })
        );
      } else {
        response.setHeader("Content-Type", "image/png");
        response.setHeader("X-Render-Duration-Ms", metadata.durationMs);
        response.setHeader("X-Render-Errors", metadata.errors.length);
        response.setHeader("X-Render-Warnings", metadata.warnings.length);
        response.end(image);
      }
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });
  server.requestTimeout = 65_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await renderer.close();
    },
    server,
  };
}
