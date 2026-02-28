const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function rateLimitedFetch(
  url: string,
  options: RequestInit = {},
  config: { delayMs?: number; maxRetries?: number } = {}
): Promise<Response> {
  const { delayMs = 500, maxRetries = 3 } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = delayMs * Math.pow(2, attempt);
      console.log(`  Retry ${attempt}/${maxRetries} after ${backoff}ms...`);
      await sleep(backoff);
    } else if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      const res = await fetch(url, options);

      if (res.status === 429) {
        lastError = new Error(`Rate limited (429) on ${url}`);
        continue;
      }

      if (res.status >= 500) {
        lastError = new Error(`Server error (${res.status}) on ${url}`);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`Failed after ${maxRetries} retries: ${url}`);
}
