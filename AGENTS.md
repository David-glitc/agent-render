# agent-render

A local TypeScript CLI, MCP server, and HTTP renderer for agent screenshot iteration.

## Commands

- `npm install` and `npx playwright install chromium`: setup.
- `npm run build`: dual tsdown CLI and typed library builds.
- `npm run typecheck`: TypeScript validation.
- `npm run fix` / `npm run check`: Ultracite formatting/lint.
- `npm test`: real Chromium integration tests; build first.

## Architecture

`schema.ts` validates all transport inputs. `compile.ts` bundles React through esbuild. `renderer.ts` owns browser reuse, fresh contexts, readiness and capture. `cli.ts`, `mcp.ts`, and `http.ts` adapt the shared renderer. MCP stdout is exclusively protocol traffic; CLI stdout is exclusively JSON.

Use ESM and `.js` extensions for relative TypeScript imports. Keep CLI/library tsdown builds separate, and let tsdown inject the CLI shebang. Preserve loopback binding and HTTP Host/Origin validation. Never execute submitted source in the Node process. Test behavior with real renders when changing readiness, bundling, or transports.
