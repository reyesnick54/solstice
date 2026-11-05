import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ResourceSample } from './types.ts';
import { analyzeMemoryTrend, theilSenSlope } from './memory-trend-analysis.ts';

function sample(atMs: number, rss: number, heap: number, extra: Partial<ResourceSample> = {}): ResourceSample {
  return Object.freeze({
    atMs,
    rssBytes: rss,
    heapUsedBytes: heap,
    cpuUserMs: 0,
    cpuSystemMs: 0,
    ...extra,
  });
}

describe('memory trend analysis (HEALTH07)', () => {
  it('computes Theil-Sen slope robust to a single GC dip', () => {
    const series = [
      { atMs: 0, value: 100 },
      { atMs: 1000, value: 110 },
      { atMs: 2000, value: 50 },
      { atMs: 3000, value: 120 },
      { atMs: 4000, value: 130 },
    ];
    const slope = theilSenSlope(series);
    assert.ok(slope > 0 && slope < 0.05);
  });

  it('passes bounded steady heap with large startup RSS delta', () => {
    const rows: ResourceSample[] = [];
    for (let t = 0; t <= 120_000; t += 5_000) {
      const rss = t < 30_000 ? 100_000_000 + t * 2_000 : 160_000_000 + (t % 10_000);
      const heap = 40_000_000 + (t % 15_000);
      rows.push(
        sample(t, rss, heap, {
          feeReceiptsInMemory: 8192,
          productiveObjects: 128,
          productiveClaims: 0,
          productiveFacts: 384,
        }),
      );
    }
    const trend = analyzeMemoryTrend(rows, 120_000);
    assert.equal(trend.ok, true, trend.detail);
    assert.ok(trend.classification === 'RSS_RETENTION' || trend.classification === 'STABLE');
  });

  it('fails monotonic retained-object growth in steady state', () => {
    const rows: ResourceSample[] = [];
    for (let t = 0; t <= 60_000; t += 5_000) {
      rows.push(
        sample(t, 120_000_000, 40_000_000 + t, {
          feeReceiptsInMemory: 1000 + t,
        }),
      );
    }
    const trend = analyzeMemoryTrend(rows, 60_000);
    assert.equal(trend.ok, false);
    assert.equal(trend.classification, 'OBJECT_RETENTION');
  });
});
