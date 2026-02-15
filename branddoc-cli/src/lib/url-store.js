const fs = require('fs');
const path = require('path');
const config = require('../config');

function domainSlug(urls) {
  try {
    const hostname = new URL(urls[0]).hostname;
    return hostname.replace(/\./g, '-');
  } catch {
    return 'unknown';
  }
}

function saveUrls(urls, source, sourceIdentifier) {
  config.ensureDir(config.OUTPUT_DIR);

  const slug = domainSlug(urls);
  const filename = `urls-${slug}-${source}.json`;
  const filePath = path.join(config.OUTPUT_DIR, filename);

  const data = {
    source,
    sourceUrl: sourceIdentifier,
    extractedAt: new Date().toISOString(),
    count: urls.length,
    urls,
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

function loadUrls(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  const content = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return content.urls || content;
}

module.exports = { saveUrls, loadUrls };
