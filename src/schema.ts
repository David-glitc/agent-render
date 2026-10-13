import { z } from "zod";

export const renderSchema = z
  .object({
    baseUrl: z
      .url()
      .refine(
        (value) => /^https?:\/\//u.test(value),
        "baseUrl must use http or https"
      )
      .optional()
      .describe(
        "Resolve relative links in pasted HTML, such as HTML piped from curl."
      ),
    code: z
      .string()
      .max(2_000_000)
      .optional()
      .describe(
        "Source code or plain text. React modules must default-export a component; JSX expressions also work."
      ),
    colorScheme: z.enum(["light", "dark"]).default("light"),
    css: z.string().max(500_000).optional(),
    format: z.enum(["html", "react", "tsx", "jsx", "text"]).default("html"),
    fullPage: z.boolean().default(false),
    height: z.number().int().min(1).max(4096).default(800),
    resolveDir: z
      .string()
      .optional()
      .describe(
        "Absolute project directory for local React imports. Defaults to the server working directory."
      ),
    scale: z.number().min(0.5).max(3).default(1),
    selector: z
      .string()
      .optional()
      .describe("Capture only the first matching element."),
    timeoutMs: z.number().int().min(100).max(60_000).default(15_000),
    transparent: z.boolean().default(false),
    url: z
      .url()
      .refine(
        (value) => /^https?:\/\//u.test(value),
        "URL must use http or https"
      )
      .optional(),
    waitForSelector: z
      .string()
      .optional()
      .describe("Wait for this element to become visible before capture."),
    waitMs: z.number().int().min(0).max(10_000).default(0),
    width: z.number().int().min(1).max(4096).default(1280),
  })
  .strict()
  .refine(
    (input) => (input.code !== undefined) !== (input.url !== undefined),
    "Provide exactly one of code or url"
  );

export type RenderInput = z.input<typeof renderSchema>;
export type RenderOptions = z.output<typeof renderSchema>;
