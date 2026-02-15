const axios = require('axios');
const { SCRAPEOWL_API_KEY } = require('../config');

/**
 * Fetch a URL via ScrapeOWL API.
 *
 * Uses a tiered approach:
 *  - Attempt 1: basic datacenter proxy (1 credit)
 *  - Attempt 2: premium residential proxy + JS rendering (10-25 credits)
 *
 * This handles sites with Cloudflare, Akamai, or other anti-bot protection.
 */
async function fetchViaScrapeOwl(url, options = {}) {
  if (!SCRAPEOWL_API_KEY) {
    throw new Error('SCRAPEOWL_API_KEY is not set');
  }

  const { premiumFirst = false, renderJs = false } = options;

  // Build attempts: basic first, then premium
  const attempts = [];

  if (premiumFirst) {
    // Go straight to premium (for known tough sites)
    attempts.push({ premium_proxies: true, render_js: true, label: 'premium+js' });
  } else {
    // Try basic first (cheaper), then escalate
    attempts.push({ premium_proxies: false, render_js: renderJs, label: 'basic' });
    attempts.push({ premium_proxies: true, render_js: true, label: 'premium+js' });
  }

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const params = {
        api_key: SCRAPEOWL_API_KEY,
        url: url,
        json_response: true,
      };

      if (attempt.premium_proxies) {
        params.premium_proxies = true;
        params.country = 'us';
      }

      if (attempt.render_js) {
        params.render_js = true;
        params.wait_for = '2000'; // Wait 2s for JS to load
      }

      const response = await axios.get('https://api.scrapeowl.com/v1/scrape', {
        params,
        timeout: attempt.render_js ? 60000 : 30000, // Longer timeout for JS rendering
      });

      const data = response.data;

      // ScrapeOWL returns JSON: { html: "...", status: 200, credits: {...} }
      if (data && typeof data === 'object') {
        // Check if the target site returned an error status
        if (data.status && data.status >= 400) {
          throw new Error(`Target returned HTTP ${data.status}`);
        }
        if (data.html) {
          return data.html;
        }
      }

      // Fallback: return raw data if it's a string (shouldn't happen with json_response=true)
      if (typeof data === 'string') {
        return data;
      }

      throw new Error('Empty response from ScrapeOWL');
    } catch (err) {
      lastError = err;
      const status = err.response?.status || err.message;
      console.warn(`  ScrapeOWL [${attempt.label}] failed for ${url}: ${status}`);

      // If it's a 401/403 from the target site, try next attempt
      // If it's a ScrapeOWL auth error (our API key is bad), don't retry
      if (err.response?.status === 401 && !attempt.premium_proxies) {
        continue; // Try premium
      }
      if (err.response?.status === 403 || (err.message && err.message.includes('HTTP 4'))) {
        continue; // Try premium
      }
      // For other errors on basic attempt, also try premium
      if (!attempt.premium_proxies) {
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} via ScrapeOWL`);
}

module.exports = { fetchViaScrapeOwl };
