# agent-render

[Website](https://agent-render.kierkegaard.space/) · [Launch video](https://agent-render.kierkegaard.space/launch.mp4)

Code in. Screenshot out. Give an agent React, TSX, JSX, HTML, plain text, or a URL and get a PNG without writing browser automation.

## Local setup

Requires Node 22+. This package is local and has not been published to npm.

```sh
npm install
npx playwright install chromium
npm run build
npm link
```

On a minimal Linux machine, use `npx playwright install --with-deps chromium` to install browser system dependencies too.

## CLI

```sh
agent-render render examples/card.tsx -o card.png
agent-render render --format jsx --code '<h1>Hello agent</h1>' -o hello.png
agent-render render https://example.com --full-page -o website.png
printf 'Hello world' | agent-render render - --format text -o text.png
curl -fsSL https://example.com | agent-render render - --base-url https://example.com -o fetched.png
```

File extensions select the format. Piped input defaults to HTML; specify `--format tsx`, `jsx`, `react`, or `text` when needed. React input can be a JSX expression or a module that default-exports a component. React and ReactDOM are bundled locally; hooks and `React.*` work. Relative imports, CSS imports, and imported image/font assets resolve from the input file's directory or `--resolve-dir`. Other npm dependencies must already be installed in that project. No dev server or CDN is needed for React.

CLI stdout is one JSON object with the absolute PNG path, actual pixel dimensions, byte size, render duration, and browser errors/warnings. Failures return JSON on stderr and exit 1. Runtime errors may still produce a useful screenshot; inspect `errors` before accepting it.

```sh
agent-render render component.tsx --width 390 --height 844 --scale 2 -o mobile.png
agent-render render page.html --selector '#card' --css styles.css -o card.png
agent-render render http://localhost:3000 --wait-for '[data-ready]' --timeout 30000 -o app.png
```

Other options: `--dark`, `--transparent`, `--full-page`, `--wait <ms>`. Run `agent-render render --help` for all options. Text is displayed literally, not interpreted as HTML or Markdown.

## MCP: return the image directly to the agent

Add this server to your MCP client's configuration (adjust the path if moved):

```json
{
  "mcpServers": {
    "agent-render": {
      "command": "node",
      "args": ["/home/david/agent-render/dist/cli.js", "mcp"]
    }
  }
}
```

The `render` tool accepts:

```json
{
  "format": "tsx",
  "code": "export default function Card() { return <div style={{padding:40,background:'#e7f2cf'}}>Hello agent</div> }",
  "width": 600,
  "height": 300
}
```

It returns an MCP image content block plus JSON metadata. The host can pass that image directly to a vision-capable agent. Edit the snippet and call `render` again. Use `{"url":"https://example.com"}` for a website. For components in a project, pass its absolute `resolveDir`. MCP stays running and reuses Chromium, with fresh storage/cookies per call.

## HTTP and curl

Start a persistent local renderer:

```sh
agent-render serve --port 4783
```

In another terminal:

```sh
curl --fail-with-body http://127.0.0.1:4783/render \
  -H 'Content-Type: application/json' \
  -d '{"format":"jsx","code":"<h1>Hello agent</h1>","width":600,"height":300}' \
  -o screenshot.png

agent-render render examples/card.tsx --server http://127.0.0.1:4783 -o card.png
```

`POST /render` returns PNG bytes. `POST /render?json=1` returns metadata and base64 `image`. `GET /health` checks the process. The raw PNG response includes `X-Render-Duration-Ms`, `X-Render-Errors`, and `X-Render-Warnings` headers; use JSON to inspect diagnostics.

All transports share the same schema. Additional JSON fields are `css`, `baseUrl`, `resolveDir`, `selector`, `waitForSelector`, `waitMs`, `timeoutMs`, `scale`, `fullPage`, `transparent`, and `colorScheme` (`light` or `dark`). Supply exactly one of `code` or `url`.

## Library

```ts
import { Renderer } from "agent-render";
import { writeFile } from "node:fs/promises";

const renderer = new Renderer();
try {
  const result = await renderer.render({
    code: "<h1>Hello</h1>",
    format: "html",
  });
  await writeFile("screenshot.png", result.image);
} finally {
  await renderer.close();
}
```

## Behavior and limits

- Captures wait for page load, fonts, image decoding, and two animation frames. Use `waitForSelector` for asynchronously loaded content. No mandatory network-idle delay.
- CSS animations are disabled during capture. Arbitrary JavaScript animation is not frozen.
- Default viewport is 1280×800 at 1×; default render deadline is 15 seconds. Up to four simultaneous renders; excess calls get a retryable busy error.
- HTML relative web assets need `baseUrl`. Local HTML filesystem assets are not automatically served; use a local web server or inline assets. React imported assets are bundled.
- Tailwind utilities require compiled CSS supplied through `css`/`--css` or a CSS import. Next.js server components and framework-specific runtime features need the app's URL.
- This is a trusted local development tool, not a multi-tenant sandbox. Code executes in Chromium, can make network requests, and React imports can read local project files at build time. HTTP binds to loopback and rejects browser Origin headers; don't expose it publicly. Browser contexts isolate cookies/storage but are not an OS security boundary.

## Development

```sh
npm run build
npm run typecheck
npm run check
npm test
```

Integration tests use real Chromium and cover pixels, React/CSS imports, URLs, base URLs, timeouts, HTTP, CLI, and MCP image responses. Build before running tests. The bundled agent workflow is in `skills/agent-render/SKILL.md`.

[MIT](LICENSE.md)
