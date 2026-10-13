import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { Renderer } from "./renderer.js";
import { renderSchema } from "./schema.js";

export async function startMcp(): Promise<void> {
  const renderer = new Renderer();
  const server = new McpServer({ name: "agent-render", version: "0.0.1" });
  server.registerTool(
    "render",
    {
      description:
        "Turn React/TSX/JSX, HTML, plain text, or a URL into a PNG returned directly to your vision context. Supply code + format, or url. React accepts a JSX expression or default-exported component. Local imports resolve from resolveDir.",
      inputSchema: renderSchema,
    },
    async (input) => {
      try {
        const { image, ...metadata } = await renderer.render(input);
        return {
          content: [
            {
              data: image.toString("base64"),
              mimeType: "image/png",
              type: "image",
            },
            { text: JSON.stringify(metadata), type: "text" },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
      }
    }
  );
  const close = async () => {
    await renderer.close();
    await server.close();
  };
  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });
  process.stdin.once("end", () => {
    void renderer.close();
  });
  await server.connect(new StdioServerTransport());
}
