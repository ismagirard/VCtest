const LANGUAGE_CODES = [
  'en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'ja', 'zh', 'ko',
  'ru', 'ar', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'hu', 'ro',
  'bg', 'hr', 'sk', 'sl', 'el', 'tr', 'th', 'vi', 'id', 'ms',
  'uk', 'he',
];

function detectLanguage(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  for (const seg of segments) {
    const langCode = seg.toLowerCase().split('-')[0];
    if (LANGUAGE_CODES.includes(langCode) && seg.length <= 5) {
      return seg.toLowerCase();
    }
  }
  return null;
}

function getFirstSlug(pathname, language) {
  const segments = pathname.split('/').filter(Boolean);
  // Skip the language segment if present
  for (const seg of segments) {
    if (language && seg.toLowerCase() === language) continue;
    return seg;
  }
  return null;
}

function categorizeUrls(urls) {
  // First pass: extract first slug for each URL and count occurrences
  const slugCounts = {};
  const urlData = urls.map((url) => {
    let pathname = '/';
    try { pathname = new URL(url).pathname || '/'; } catch {}

    const language = detectLanguage(pathname);
    const firstSlug = getFirstSlug(pathname, language);

    if (firstSlug) {
      slugCounts[firstSlug] = (slugCounts[firstSlug] || 0) + 1;
    }

    return { url, language, firstSlug, pathname };
  });

  // Second pass: assign pageType — only slugs with 2+ URLs become categories
  return urlData.map(({ url, language, firstSlug, pathname }) => {
    let pageType;
    if (pathname === '/' || pathname === '') {
      pageType = 'Homepage';
    } else if (firstSlug && slugCounts[firstSlug] >= 2) {
      // Format slug as category: "integration-tools" → "integration-tools"
      pageType = firstSlug;
    } else {
      pageType = 'Other';
    }

    return { url, language, pageType };
  });
}

/**
 * Categorize a single URL (language + pageType).
 * Used by ai-categorizer to get reliable language detection for individual URLs.
 */
function categorizeUrl(url) {
  const result = categorizeUrls([url]);
  return result[0] || { url, language: null, pageType: 'Other' };
}

module.exports = { categorizeUrls, categorizeUrl };
