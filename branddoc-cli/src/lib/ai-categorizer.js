const axios = require('axios');
const { ANTHROPIC_API_KEY } = require('../config');
const { categorizeUrl } = require('./url-categorizer');

const PROMPT_TEMPLATE = `You are analyzing URL paths from a single website. Categorize each URL path into a descriptive page type based on what the page is likely about.

Rules:
- Group similar paths under the same category name
- Use short, clear category names (2-3 words max, e.g., "Industry Products", "Software", "Blog", "About", "Legal", "Case Studies")
- The homepage (/) should be categorized as "Homepage"
- Be specific to this site's structure, not generic
- URLs with similar first-level slugs should usually share a category

URL paths:
PATHS_PLACEHOLDER

Respond with ONLY a valid JSON array, no markdown fences, no explanation:
[{"path":"/","pageType":"Homepage"},{"path":"/about","pageType":"About"}]`;

async function aiCategorizeUrls(urls) {
  if (!ANTHROPIC_API_KEY) {
    return null; // Signal to fall back to regex
  }

  // Extract unique paths to minimize tokens
  const pathMap = {};
  for (const url of urls) {
    try {
      const pathname = new URL(url).pathname || '/';
      if (!pathMap[pathname]) {
        pathMap[pathname] = [];
      }
      pathMap[pathname].push(url);
    } catch {
      // Skip invalid URLs
    }
  }

  const uniquePaths = Object.keys(pathMap);
  const pathList = uniquePaths.join('\n');
  const prompt = PROMPT_TEMPLATE.replace('PATHS_PLACEHOLDER', pathList);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // Extract text from response
    const text = response.data.content[0].text.trim();

    // Parse JSON — handle potential markdown fences
    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const categories = JSON.parse(jsonStr);

    // Build a path → pageType lookup
    const pathToType = {};
    for (const item of categories) {
      if (item.path && item.pageType) {
        pathToType[item.path] = item.pageType;
      }
    }

    // Map back to full URLs, keeping language detection from regex categorizer
    return urls.map((url) => {
      let pathname = '/';
      try { pathname = new URL(url).pathname || '/'; } catch {}

      // Language from regex (reliable)
      const { language } = categorizeUrl(url);
      // Page type from AI, fallback to "Other"
      const pageType = pathToType[pathname] || 'Other';

      return { url, language, pageType };
    });
  } catch (err) {
    console.warn(`  AI categorization failed: ${err.message}`);
    return null; // Signal to fall back to regex
  }
}

module.exports = { aiCategorizeUrls };
