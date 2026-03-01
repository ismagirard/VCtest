import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { log } from "./logger.js";

/**
 * A single browser tab that can fetch Metro pages.
 * Multiple tabs share the same BrowserContext (and Cloudflare cookies).
 */
export class MetroTab {
  constructor(private page: Page, readonly tabId: number) {}

  /**
   * Navigate to a URL and return the page HTML after content loads.
   * Waits for product tiles to appear (up to 15s).
   */
  async fetchPage(url: string): Promise<string> {
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for product tiles to render
    try {
      await this.page.waitForSelector("[data-product-code]", { timeout: 15000 });
    } catch {
      // No products on this page — might be an empty category or last page
      return this.page.content();
    }

    // Small extra wait for any lazy-loaded content
    await this.page.waitForTimeout(1000);

    return this.page.content();
  }

  /**
   * Get the max page number from pagination on the current page.
   * Call after fetchPage().
   */
  async getMaxPage(): Promise<number> {
    return this.page.evaluate(() => {
      const links = document.querySelectorAll("[class*='pagination'] a[href]");
      let max = 1;
      links.forEach((a) => {
        const num = parseInt(a.textContent?.trim() ?? "");
        if (!isNaN(num) && num > max) max = num;
      });
      return max;
    });
  }

  async close(): Promise<void> {
    try {
      await this.page.close();
    } catch {}
  }
}

/**
 * Manages a Playwright browser session for scraping Metro Inc store pages.
 * Supports multiple concurrent tabs sharing the same Cloudflare session.
 *
 * Usage:
 *   const browser = new MetroBrowser();
 *   await browser.launch();
 *   const tab = browser.getDefaultTab();
 *   const html = await tab.fetchPage(url);
 *   // Or for parallel:
 *   const tabs = await browser.createTabs(4);
 *   await browser.close();
 */
export class MetroBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private defaultTab: MetroTab | null = null;

  async launch(): Promise<void> {
    if (this.browser) return;

    log.info("MetroBrowser: launching headless Chromium...");
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "fr-CA",
    });
    const page = await this.context.newPage();
    this.defaultTab = new MetroTab(page, 0);
    log.info("MetroBrowser: browser ready");
  }

  /** Get the default (first) tab. Used for single-tab mode. */
  getDefaultTab(): MetroTab {
    if (!this.defaultTab) throw new Error("MetroBrowser not launched. Call launch() first.");
    return this.defaultTab;
  }

  /**
   * Create N tabs (including the default one) for parallel scraping.
   * All tabs share the same BrowserContext → same Cloudflare cookies.
   * After the first tab passes Cloudflare, the others sail through.
   */
  async createTabs(count: number): Promise<MetroTab[]> {
    if (!this.context || !this.defaultTab) {
      throw new Error("MetroBrowser not launched. Call launch() first.");
    }

    const tabs: MetroTab[] = [this.defaultTab];

    for (let i = 1; i < count; i++) {
      const page = await this.context.newPage();
      tabs.push(new MetroTab(page, i));
    }

    log.info(`MetroBrowser: ${tabs.length} tabs ready`);
    return tabs;
  }

  // ── Legacy single-tab API (backward compat) ──

  async fetchPage(url: string): Promise<string> {
    return this.getDefaultTab().fetchPage(url);
  }

  async getMaxPage(): Promise<number> {
    return this.getDefaultTab().getMaxPage();
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
      this.context = null;
      this.defaultTab = null;
      log.info("MetroBrowser: closed");
    }
  }
}
