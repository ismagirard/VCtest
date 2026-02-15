function slugify(input, fallback = 'custom-docs') {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

function uniqueSuffix() {
  return Date.now().toString(36);
}

function hostSlug(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  try {
    const hostname = new URL(urls[0]).hostname;
    return hostname.replace(/\./g, '-');
  } catch {
    return null;
  }
}

function deriveDocSlug({ urls = [], customDocs = [] } = {}) {
  const host = hostSlug(urls);
  if (host) return host;

  if (Array.isArray(customDocs) && customDocs.length > 0) {
    const title = customDocs[0] && customDocs[0].title;
    return `${slugify(title)}-${uniqueSuffix()}`;
  }

  return `manual-${uniqueSuffix()}`;
}

module.exports = { deriveDocSlug };
