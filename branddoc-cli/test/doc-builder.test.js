// Test the concurrency logic in doc-builder without network calls.
// We mock extractContent to return fake results instantly.

jest.mock('../src/lib/content-extractor', () => ({
  extractContent: jest.fn(),
}));

const { extractContent } = require('../src/lib/content-extractor');
const { buildBrandDoc } = require('../src/lib/doc-builder');

beforeEach(() => {
  extractContent.mockReset();
});

describe('buildBrandDoc', () => {
  test('builds markdown from successful extractions', async () => {
    extractContent.mockImplementation(async (url) => ({
      url,
      title: 'Page ' + url,
      markdown: 'Content for ' + url,
      error: null,
    }));

    const { markdown, results } = await buildBrandDoc(
      ['https://a.com/', 'https://b.com/'],
      { concurrency: 2 }
    );

    expect(results).toHaveLength(2);
    expect(results[0].error).toBeNull();
    expect(results[1].error).toBeNull();
    expect(markdown).toContain('# Brand Documentation');
    expect(markdown).toContain('Page https://a.com/');
    expect(markdown).toContain('Content for https://b.com/');
  });

  test('handles mixed success and failure', async () => {
    extractContent.mockImplementation(async (url) => {
      if (url.includes('bad')) {
        return { url, title: null, markdown: null, error: 'Fetch failed' };
      }
      return { url, title: 'Good', markdown: 'OK', error: null };
    });

    const { markdown, results } = await buildBrandDoc(
      ['https://good.com/', 'https://bad.com/'],
      { concurrency: 2 }
    );

    const succeeded = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(markdown).toContain('Failed Extractions');
    expect(markdown).toContain('https://bad.com/');
  });

  test('handles empty URL list', async () => {
    const { markdown, results } = await buildBrandDoc([], { concurrency: 2 });
    expect(results).toHaveLength(0);
    expect(markdown).toContain('# Brand Documentation');
    expect(markdown).toContain('0 pages extracted');
  });

  test('includes custom documents in output', async () => {
    const { markdown } = await buildBrandDoc([], {
      concurrency: 2,
      customDocs: [{ title: 'My Brief', content: 'Custom content here' }],
    });

    expect(markdown).toContain('My Brief');
    expect(markdown).toContain('Custom content here');
    expect(markdown).toContain('1 custom document included');
  });

  test('calls onProgress for each URL', async () => {
    extractContent.mockImplementation(async (url) => ({
      url, title: 'T', markdown: 'M', error: null,
    }));

    const progress = [];
    await buildBrandDoc(
      ['https://a.com/', 'https://b.com/', 'https://c.com/'],
      {
        concurrency: 1,
        onProgress: (p) => progress.push(p),
      }
    );

    expect(progress).toHaveLength(3);
    expect(progress[0].current).toBe(1);
    expect(progress[0].total).toBe(3);
    expect(progress[2].current).toBe(3);
  });

  test('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    extractContent.mockImplementation(async (url) => {
      concurrent++;
      if (concurrent > maxConcurrent) maxConcurrent = concurrent;
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
      return { url, title: 'T', markdown: 'M', error: null };
    });

    await buildBrandDoc(
      ['https://1.com/', 'https://2.com/', 'https://3.com/', 'https://4.com/'],
      { concurrency: 2 }
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
