/**
 * Delorme Content Optimization — Google Docs Add-on
 * Main entry point
 */

// ============================================================
// TRIGGERS
// ============================================================

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Open Delorme', 'showSidebar')
    .addSeparator()
    .addItem('About', 'showAbout')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

// ============================================================
// SIDEBAR
// ============================================================

function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('Delorme')
    .setWidth(300);
  DocumentApp.getUi().showSidebar(html);
}

function showAbout() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family: Google Sans, Arial, sans-serif; padding: 16px;">' +
    '<h3 style="margin-top:0;">Delorme Content Optimization</h3>' +
    '<p>Version 1.0.0</p>' +
    '<p><a href="https://delorme.ca" target="_blank">delorme.ca</a></p>' +
    '</div>'
  )
    .setWidth(300)
    .setHeight(160);
  DocumentApp.getUi().showModalDialog(html, 'About Delorme');
}

// ============================================================
// HTML INCLUDE HELPER
// ============================================================

/**
 * Includes an HTML file inside another.
 * Usage in template: <?!= include('Sidebar.css') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// DOCUMENT UTILITIES
// ============================================================

function getDocumentInfo() {
  var doc = DocumentApp.getActiveDocument();
  return {
    id: doc.getId(),
    name: doc.getName(),
    url: doc.getUrl()
  };
}

function setDocumentTitle(title) {
  try {
    var doc = DocumentApp.getActiveDocument();
    doc.setName(title);
    return { success: true, title: title };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// TEMPLATES
// ============================================================

/**
 * Returns available template types for the sidebar.
 * Country/language options are populated dynamically from APIs.
 */
function getTemplates() {
  return [
    {
      id: 'content_optimization',
      name: 'Content Optimization',
      description: 'SEO content optimization report with before/after comparison',
      fields: [
        { id: 'client_name', label: 'Client Name', type: 'text', required: true, placeholder: 'e.g. LCI Melbourne' },
        { id: 'target_keyword', label: 'Target Keyword', type: 'text', required: true, placeholder: 'e.g. bachelor of visual arts' },
        { id: 'page_url', label: 'Page URL', type: 'url', required: true, placeholder: 'https://example.com/page' },
        { id: 'page_type', label: 'Page Type', type: 'select', required: true, options: [
          { value: '', label: 'Select page type...' },
          { value: 'homepage', label: 'Homepage' },
          { value: 'landing_page', label: 'Landing Page' },
          { value: 'service_page', label: 'Service Page' },
          { value: 'product_page', label: 'Product Page' },
          { value: 'blog_post', label: 'Blog Post' },
          { value: 'category_page', label: 'Category Page' },
          { value: 'about_page', label: 'About Page' },
          { value: 'contact_page', label: 'Contact Page' },
          { value: 'other', label: 'Other' }
        ]},
        { id: 'country', label: 'Country', type: 'select', required: true, options: [] },
        { id: 'language', label: 'Language', type: 'select', required: true, options: [] }
      ]
    }
  ];
}
