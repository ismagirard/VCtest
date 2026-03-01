const { extractContent } = require('./content-extractor');
const { DEFAULTS } = require('../config');

// Max time a single URL extraction can take before we abort and move on.
// This prevents one stuck URL from blocking the entire build.
const URL_TIMEOUT = 90_000; // 90 seconds

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processWithConcurrency(items, fn, concurrency = 3) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      try {
        results[current] = await fn(items[current], current);
      } catch (err) {
        // One URL crashing must never kill the entire build
        console.error(`  Worker error on item ${current}:`, err.message);
        results[current] = { url: items[current], title: null, markdown: null, error: err.message };
      }
    }
  }

  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

async function buildBrandKnowledge(urls, { concurrency = DEFAULTS.concurrency, customDocs = [], onProgress } = {}) {
  const total = urls.length;
  let completed = 0;

  const results = await processWithConcurrency(
    urls,
    async (url, index) => {
      console.log(`  [${index + 1}/${total}] ${url}`);

      // Per-URL timeout — abort after URL_TIMEOUT ms and record as failed
      let timer;
      const timeoutP = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Extraction timed out after ${URL_TIMEOUT / 1000}s`)), URL_TIMEOUT);
      });

      let result;
      const actual = extractContent(url);
      actual.catch(() => {}); // prevent unhandled rejection if timeout wins the race
      try {
        result = await Promise.race([actual, timeoutP]);
      } catch (err) {
        result = { url, title: null, markdown: null, error: err.message };
      } finally {
        clearTimeout(timer);
      }

      completed++;
      if (result.error) {
        console.log(`    ⚠ Failed: ${result.error}`);
      } else {
        console.log(`    ✓ ${result.title}`);
      }
      // Report progress
      if (typeof onProgress === 'function') {
        onProgress({
          current: completed,
          total,
          url,
          ok: !result.error,
          title: result.title || null,
          error: result.error || null,
        });
      }
      await delay(DEFAULTS.requestDelay);
      return result;
    },
    concurrency
  );

  const succeeded = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);

  // Build markdown
  const lines = [];
  lines.push('# Brand Knowledge\n');
  lines.push(`> Extracted on ${new Date().toISOString()}`);
  lines.push(`> ${succeeded.length} pages extracted, ${failed.length} failed`);
  if (customDocs.length > 0) {
    lines.push(`> ${customDocs.length} custom document${customDocs.length !== 1 ? 's' : ''} included`);
  }
  lines.push('');

  // Table of contents
  lines.push('## Table of Contents\n');
  let tocIndex = 1;
  succeeded.forEach((r) => {
    lines.push(`${tocIndex}. [${r.title}](#page-${tocIndex})`);
    tocIndex++;
  });
  customDocs.forEach((doc) => {
    lines.push(`${tocIndex}. [${doc.title}](#custom-${tocIndex})`);
    tocIndex++;
  });
  lines.push('');

  // Page sections
  let sectionIndex = 1;
  succeeded.forEach((r) => {
    lines.push(`---\n`);
    lines.push(`<a id="page-${sectionIndex}"></a>\n`);
    lines.push(`## ${r.title}\n`);
    lines.push(`**Source:** ${r.url}\n`);
    // Strip any leftover image/media markdown references
    var cleanMd = r.markdown
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')  // ![alt](src)
      .replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '') // ![alt][ref]
      .replace(/\n{3,}/g, '\n\n');             // collapse excessive blank lines
    lines.push(cleanMd);
    lines.push('');
    sectionIndex++;
  });

  // Custom document sections
  if (customDocs.length > 0) {
    customDocs.forEach((doc) => {
      lines.push(`---\n`);
      lines.push(`<a id="custom-${sectionIndex}"></a>\n`);
      lines.push(`## ${doc.title}\n`);
      lines.push(`**Source:** Custom document\n`);
      lines.push(doc.content);
      lines.push('');
      sectionIndex++;
    });
  }

  // Failed section
  if (failed.length > 0) {
    lines.push('---\n');
    lines.push('## Failed Extractions\n');
    failed.forEach((r) => {
      lines.push(`- ${r.url} — ${r.error}`);
    });
    lines.push('');
  }

  const markdown = lines.join('\n');
  return { markdown, results };
}

/**
 * Build a Brand Guidelines document from uploaded custom documents only (no URL crawling).
 * Returns { markdown } — no `results` array since there are no URL extractions.
 */
async function buildBrandGuidelines(customDocs = []) {
  if (!customDocs.length) {
    return { markdown: '# Brand Guidelines\n\n> No documents provided.\n' };
  }

  const lines = [];
  lines.push('# Brand Guidelines\n');
  lines.push(`> Compiled on ${new Date().toISOString()}`);
  lines.push(`> ${customDocs.length} document${customDocs.length !== 1 ? 's' : ''} included`);
  lines.push('');

  // Table of contents
  lines.push('## Table of Contents\n');
  customDocs.forEach((doc, i) => {
    lines.push(`${i + 1}. [${doc.title}](#guideline-${i + 1})`);
  });
  lines.push('');

  // Document sections
  customDocs.forEach((doc, i) => {
    lines.push(`---\n`);
    lines.push(`<a id="guideline-${i + 1}"></a>\n`);
    lines.push(`## ${doc.title}\n`);
    lines.push(doc.content);
    lines.push('');
  });

  const markdown = lines.join('\n');
  return { markdown };
}

module.exports = { buildBrandKnowledge, buildBrandGuidelines };
