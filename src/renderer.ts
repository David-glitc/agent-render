import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

import { compileReact, escapeHtml } from "./compile.js";
import { renderSchema } from "./schema.js";
import type { RenderInput, RenderOptions } from "./schema.js";

export interface RenderMetadata {
  mimeType: "image/png";
  width: number;
  height: number;
  bytes: number;
  durationMs: number;
  errors: string[];
  warnings: string[];
}
export interface RenderResult extends RenderMetadata {
  image: Buffer;
}

function record(list: string[], message: string): void {
  if (list.length < 30) {
    list.push(message.slice(0, 2000));
  }
}

async function populate(page: Page, options: RenderOptions) {
  if (options.url) {
    const response = await page.goto(options.url, { waitUntil: "load" });
    if (response && !response.ok()) {
      throw new Error(
        `Navigation failed: HTTP ${response.status()} at ${options.url}`
      );
    }
    return;
  }
  const base = options.baseUrl
    ? `<base href="${escapeHtml(options.baseUrl)}">`
    : "";
  if (options.format === "html") {
    if (options.baseUrl) {
      const html = await page.evaluate(
        ({ href, source }) => {
          const parsed = new DOMParser().parseFromString(source, "text/html");
          for (const element of parsed.querySelectorAll("base")) {
            element.remove();
          }
          const element = parsed.createElement("base");
          element.href = href;
          parsed.head.prepend(element);
          return `<!doctype html>${parsed.documentElement.outerHTML}`;
        },
        { href: options.baseUrl, source: options.code ?? "" }
      );
      await page.setContent(html, { waitUntil: "load" });
    } else {
      await page.setContent(options.code ?? "", { waitUntil: "load" });
    }
  } else if (options.format === "text") {
    await page.setContent(
      `<!doctype html><html><head>${base}</head><body><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:18px/1.6 ui-monospace,monospace;margin:32px">${escapeHtml(options.code ?? "")}</pre></body></html>`
    );
  } else {
    const bundle = await compileReact(options);
    await page.setContent(
      `<!doctype html><html><head>${base}</head><body style="margin:0"><div id="root"></div></body></html>`
    );
    if (bundle.css) {
      await page.addStyleTag({ content: bundle.css });
    }
    await page.addScriptTag({ content: bundle.js });
    await page.waitForFunction("window.__agentRenderReady === true");
  }
}

export class Renderer {
  private browserPromise?: Promise<Browser>;
  private active = 0;

  private browser(): Promise<Browser> {
    this.browserPromise ??= chromium
      .launch({ headless: true })
      .then((browser) => {
        browser.on("disconnected", () => {
          this.browserPromise = undefined;
        });
        return browser;
      })
      .catch((error: unknown) => {
        this.browserPromise = undefined;
        throw error;
      });
    return this.browserPromise;
  }

  async close(): Promise<void> {
    await (await this.browserPromise)?.close();
    this.browserPromise = undefined;
  }

  async render(input: RenderInput): Promise<RenderResult> {
    const options = renderSchema.parse(input);
    if (this.active >= 4) {
      throw new Error(
        "Renderer busy: at most four simultaneous renders are supported. Retry shortly."
      );
    }
    this.active += 1;
    const started = performance.now();
    let context: BrowserContext | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    try {
      const work = async () => {
        const browser = await this.browser();
        if (expired) {
          throw new Error("Render timed out");
        }
        context = await browser.newContext({
          acceptDownloads: false,
          colorScheme: options.colorScheme,
          deviceScaleFactor: options.scale,
          reducedMotion: "reduce",
          serviceWorkers: "block",
          viewport: { height: options.height, width: options.width },
        });
        if (expired) {
          await context.close();
          throw new Error("Render timed out");
        }
        context.setDefaultTimeout(options.timeoutMs);
        const page = await context.newPage();
        const errors: string[] = [];
        const warnings: string[] = [];
        page.on("pageerror", (error) => record(errors, error.message));
        page.on("console", (message) => {
          if (message.type() === "error") {
            record(errors, message.text());
          }
        });
        page.on("requestfailed", (request) =>
          record(warnings, `${request.url()}: ${request.failure()?.errorText}`)
        );
        await populate(page, options);
        if (options.css) {
          await page.addStyleTag({ content: options.css });
        }
        if (options.waitForSelector) {
          await page
            .locator(options.waitForSelector)
            .first()
            .waitFor({ state: "visible" });
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            [...document.images].map(async (img) => {
              if (!img.complete) {
                await img.decode().catch(() => {
                  /* Failed images are reported below. */
                });
              }
            })
          );
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        });
        if (options.waitMs) {
          await page.waitForTimeout(options.waitMs);
        }
        const broken = await page.evaluate(() =>
          [...document.images]
            .filter((img) => img.currentSrc && img.naturalWidth === 0)
            .map((img) => img.currentSrc)
        );
        for (const url of broken) {
          record(warnings, `Image failed to load: ${url}`);
        }
        const screenshotOptions = {
          animations: "disabled" as const,
          omitBackground: options.transparent,
          timeout: options.timeoutMs,
          type: "png" as const,
        };
        const image = options.selector
          ? await page
              .locator(options.selector)
              .first()
              .screenshot(screenshotOptions)
          : await page.screenshot({
              ...screenshotOptions,
              fullPage: options.fullPage,
            });
        return {
          bytes: image.length,
          durationMs: Math.round(performance.now() - started),
          errors,
          height: image.readUInt32BE(20),
          image,
          mimeType: "image/png" as const,
          warnings,
          width: image.readUInt32BE(16),
        };
      };
      return await Promise.race([
        work(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            expired = true;
            reject(new Error(`Render timed out after ${options.timeoutMs}ms`));
          }, options.timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      await context?.close().catch(() => {
        /* Context may already be closed after a browser crash. */
      });
      this.active -= 1;
    }
  }
}
