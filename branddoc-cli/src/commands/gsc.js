const readline = require('readline');
const { getAuthenticatedClient } = require('../lib/gsc-auth');
const { listProperties, getTopUrls } = require('../lib/gsc-client');
const { saveUrls } = require('../lib/url-store');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

module.exports = async function gscCommand(options) {
  console.log('Connecting to Google Search Console...\n');

  const auth = await getAuthenticatedClient();
  const properties = await listProperties(auth);

  if (properties.length === 0) {
    console.log('No properties found in your Google Search Console account.');
    return;
  }

  console.log('Available properties:\n');
  properties.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p}`);
  });

  const choice = await prompt(`\nSelect a property (1-${properties.length}): `);
  const index = parseInt(choice, 10) - 1;

  if (isNaN(index) || index < 0 || index >= properties.length) {
    console.log('Invalid selection.');
    return;
  }

  const siteUrl = properties[index];
  console.log(`\nFetching URLs from ${siteUrl} (last ${options.days} days)...\n`);

  const urls = await getTopUrls(auth, siteUrl, { days: options.days });

  if (urls.length === 0) {
    console.log('No URLs with search data found.');
    return;
  }

  console.log(`Found ${urls.length} URLs with search data`);

  // Show top 10
  const preview = urls.slice(0, 10);
  preview.forEach((u) => console.log(`  ${u}`));
  if (urls.length > 10) {
    console.log(`  ... and ${urls.length - 10} more`);
  }

  const filePath = saveUrls(urls, 'gsc', siteUrl);
  console.log(`\nSaved to ${filePath}`);
};
