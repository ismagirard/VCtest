const { loadUrls } = require('../lib/url-store');
const { extractContent } = require('../lib/content-extractor');
const { DEFAULTS } = require('../config');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processWithConcurrency(items, fn, concurrency = 3) {
  const results = [];
  const executing = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const promise = fn(item, i).then((result) => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

module.exports = async function extractCommand(urlsFile, options) {
  const urls = loadUrls(urlsFile);
  const concurrency = options.concurrency || DEFAULTS.concurrency;
  const total = urls.length;

  console.log(`Extracting content from ${total} URLs (concurrency: ${concurrency})\n`);

  const results = await processWithConcurrency(
    urls,
    async (url, i) => {
      console.log(`[${i + 1}/${total}] ${url}`);
      const result = await extractContent(url);
      if (result.error) {
        console.log(`  ⚠ Failed: ${result.error}`);
      } else {
        console.log(`  ✓ ${result.title} (${result.markdown.length} chars)`);
      }
      await delay(DEFAULTS.requestDelay);
      return result;
    },
    concurrency
  );

  const succeeded = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
};
