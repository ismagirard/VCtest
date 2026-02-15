const { google } = require('googleapis');

async function listProperties(auth) {
  const webmasters = google.webmasters({ version: 'v3', auth });
  const res = await webmasters.sites.list();
  return (res.data.siteEntry || []).map((entry) => entry.siteUrl);
}

async function getTopUrls(auth, siteUrl, { days = 90 } = {}) {
  const webmasters = google.webmasters({ version: 'v3', auth });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d) => d.toISOString().split('T')[0];

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['page'],
      rowLimit: 25000,
    },
  });

  if (!res.data.rows) {
    return [];
  }

  // Sort by clicks descending, return URLs
  return res.data.rows
    .sort((a, b) => b.clicks - a.clicks)
    .map((row) => row.keys[0]);
}

module.exports = { listProperties, getTopUrls };
