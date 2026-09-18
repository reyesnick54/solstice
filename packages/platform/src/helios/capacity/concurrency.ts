/** Local concurrency helper — avoids platform → performance dependency. */

export async function runConcurrent<T>(
  concurrency: number,
  total: number,
  worker: (index: number) => Promise<T>,
): Promise<readonly T[]> {
  const results: T[] = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= total) return;
      results.push(await worker(index));
    }
  });
  await Promise.all(runners);
  return results;
}
