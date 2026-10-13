---
name: agent-render
description: Render React, TSX, JSX, HTML, plain text, or websites into screenshot images for visual agent iteration. Use to inspect a component or page without writing browser automation.
---

# Code → screenshot → inspect → revise

Prefer the `agent-render` MCP `render` tool when available: it returns an image directly. Supply `code` and `format`, or `url`. React input should be a JSX expression or default-exported component. Supply `resolveDir` for local imports and already-installed npm packages.

Otherwise use the CLI:

```sh
agent-render render component.tsx -o /tmp/component.png
agent-render render https://example.com --full-page -o /tmp/site.png
curl -fsSL https://example.com | agent-render render - --base-url https://example.com -o /tmp/fetched.png
```

Read the JSON result and inspect the saved image with the host's image-viewing tool. Check errors/warnings, revise the source, then render again. Do not claim visual verification from the output path alone.

For repeated CLI calls, start `agent-render serve` and pass `--server http://127.0.0.1:4783` to reuse Chromium. MCP already reuses it. Use the target viewport (`--width 390 --height 844` for a mobile example), `--selector` for a component crop, and `--wait-for` for asynchronous readiness.

Text is literal. Tailwind needs compiled CSS. Use an existing app URL for server components or framework-specific runtime features. For local HTML assets, use a local web server; for fetched HTML, supply the original base URL. This tool runs trusted local code with network access.
