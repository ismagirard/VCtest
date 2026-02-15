const { parseSitemap } = require('../lib/sitemap-parser');
const { saveUrls } = require('../lib/url-store');

module.exports = async function sitemapCommand(url, options) {
  console.log(`Fetching sitemap: ${url}\n`);

  const urls = await parseSitemap(url, { maxDepth: options.maxDepth });

  if (urls.length === 0) {
    console.log('No URLs found in the sitemap.');
    return;
  }

  console.log(`\nFound ${urls.length} URLs`);

  // Show preview
  const preview = urls.slice(0, 20);
  preview.forEach((u) => console.log(`  ${u}`));
  if (urls.length > 20) {
    console.log(`  ... and ${urls.length - 20} more`);
  }

  const filePath = saveUrls(urls, 'sitemap', url);
  console.log(`\nSaved to ${filePath}`);
};
