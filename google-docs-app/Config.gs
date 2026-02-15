/**
 * Delorme Content Optimization — Configuration
 *
 * Centralized config for all API keys and settings.
 * API keys are stored in Script Properties for security.
 * Use setApiKeys() once to store them, then they persist.
 */

var CONFIG = {
  // App metadata
  APP_NAME: 'Delorme Content Optimization',
  VERSION: '1.0.0',

  // API endpoints
  TEXTFOCUS_ENDPOINT: 'https://www.textfocus.net/apis/tf_seo/',
  DATAFORSEO_SERP_ENDPOINT: 'https://api.dataforseo.com/v3/serp/google/organic/task_post',
  DATAFORSEO_SERP_RESULT_ENDPOINT: 'https://api.dataforseo.com/v3/serp/google/organic/task_get/advanced/',
  DATAFORSEO_SCREENSHOT_ENDPOINT: 'https://api.dataforseo.com/v3/on_page/page_screenshot',
  GOOGLE_NLP_ENDPOINT: 'https://language.googleapis.com/v1/documents:analyzeEntities',

  // Script property keys (where secrets are stored)
  PROP_TEXTFOCUS_KEY: 'TEXTFOCUS_API_KEY',
  PROP_DATAFORSEO_USER: 'DATAFORSEO_USERNAME',
  PROP_DATAFORSEO_PASS: 'DATAFORSEO_PASSWORD',
  PROP_GOOGLE_NLP_KEY: 'GOOGLE_NLP_API_KEY'
};

// ============================================================
// API KEY MANAGEMENT
// ============================================================

/**
 * Stores API keys securely in Script Properties.
 * Run this once from the Apps Script editor (Run > setApiKeys).
 *
 * After running, keys are persisted and available to all functions.
 */
function setApiKeys() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'TEXTFOCUS_API_KEY': '038a6ca637b53e646c9cdd77e77e',
    'DATAFORSEO_USERNAME': 'tommy@delormeseo.com',
    'DATAFORSEO_PASSWORD': '47b8e96735b5f9fe',
    'GOOGLE_NLP_API_KEY': ''  // Add your Google NLP API key here
  });
  Logger.log('API keys stored successfully.');
}

/**
 * Retrieves an API key from Script Properties.
 * @param {string} propKey - The property key name
 * @return {string} The stored value, or empty string if not set
 */
function getApiKey(propKey) {
  return PropertiesService.getScriptProperties().getProperty(propKey) || '';
}

/**
 * Checks which API keys are configured.
 * Returns status without exposing actual keys.
 * @return {Object} Key configuration status
 */
function checkApiKeyStatus() {
  var props = PropertiesService.getScriptProperties();
  return {
    textfocus: !!props.getProperty(CONFIG.PROP_TEXTFOCUS_KEY),
    dataforseo: !!props.getProperty(CONFIG.PROP_DATAFORSEO_USER) && !!props.getProperty(CONFIG.PROP_DATAFORSEO_PASS),
    google_nlp: !!props.getProperty(CONFIG.PROP_GOOGLE_NLP_KEY)
  };
}

/**
 * Returns DataForSEO auth header (Base64 encoded).
 * @return {string} Base64 encoded "username:password"
 */
function getDataForSeoAuth() {
  var user = getApiKey(CONFIG.PROP_DATAFORSEO_USER);
  var pass = getApiKey(CONFIG.PROP_DATAFORSEO_PASS);
  return Utilities.base64Encode(user + ':' + pass);
}
