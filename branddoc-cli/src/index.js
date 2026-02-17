const { program } = require('commander');
const config = require('./config');

// Ensure output directory exists
config.ensureDir(config.OUTPUT_DIR);

program
  .name('branddoc')
  .version('0.1.0')
  .description('CLI tool for extracting brand knowledge from websites');

program
  .command('sitemap <url>')
  .description('Extract URLs from a sitemap')
  .option('--max-depth <n>', 'Max sitemap index recursion depth', parseInt, config.DEFAULTS.sitemapMaxDepth)
  .action(require('./commands/sitemap'));

program
  .command('gsc')
  .description('Extract URLs from Google Search Console')
  .option('--days <n>', 'Lookback period in days', parseInt, config.DEFAULTS.gscLookbackDays)
  .action(require('./commands/gsc'));

program
  .command('extract <urls-file>')
  .description('Extract content from URLs listed in a JSON file')
  .option('--concurrency <n>', 'Number of parallel requests', parseInt, config.DEFAULTS.concurrency)
  .action(require('./commands/extract'));

program
  .command('build-knowledge <urls-file>')
  .description('Build brand knowledge from URLs listed in a JSON file')
  .option('--concurrency <n>', 'Number of parallel requests', parseInt, config.DEFAULTS.concurrency)
  .action(require('./commands/build-knowledge'));

program
  .command('serve')
  .description('Start the web UI')
  .option('--port <n>', 'Port number', parseInt, 3000)
  .action((options) => {
    const { createServer } = require('./server');
    createServer(options.port);
  });

program.parse();
