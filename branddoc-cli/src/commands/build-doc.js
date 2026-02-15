const fs = require('fs');
const path = require('path');
const { loadUrls } = require('../lib/url-store');
const { buildBrandDoc } = require('../lib/doc-builder');
const { deriveDocSlug } = require('../lib/output-filename');
const config = require('../config');

module.exports = async function buildDocCommand(urlsFile, options) {
  const urls = loadUrls(urlsFile);
  console.log(`Building brand documentation from ${urls.length} URLs\n`);

  const { markdown, results } = await buildBrandDoc(urls, {
    concurrency: options.concurrency,
  });

  // Derive filename from inputs. Falls back to unique slug when no valid URL exists.
  const slug = deriveDocSlug({ urls });

  config.ensureDir(config.OUTPUT_DIR);
  const outPath = path.join(config.OUTPUT_DIR, `brand-doc-${slug}.md`);
  fs.writeFileSync(outPath, markdown);

  const succeeded = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;
  console.log(`\nBrand documentation saved to ${outPath}`);
  console.log(`${succeeded} pages extracted, ${failed} failed`);
};
