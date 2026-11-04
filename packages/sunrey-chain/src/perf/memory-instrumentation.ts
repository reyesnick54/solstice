import { getActiveResourcesInfo } from 'node:process';
import { performance } from 'node:perf_hooks';

import type { FeeEngine } from '../fees/engine.ts';
import type { ProductiveEconomyEngine } from '../productive/engine.ts';
import type { ResourceSample } from './types.ts';

export type MemoryDiagnostics = {
  readonly atMs: number;
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
  readonly arrayBufferBytes: number;
  readonly eventListenerCount: number;
  readonly timerCount: number;
  readonly activeResourceCount: number;
  readonly activeResourceTypes: Readonly<Record<string, number>>;
  readonly feeReceiptsInMemory: number;
  readonly feeReceiptsSealed: number;
  readonly productiveObjects: number;
  readonly productiveClaims: number;
  readonly productiveFacts: number;
  readonly productiveReceipts: number;
};

function countActiveResources(): { readonly total: number; readonly byType: Record<string, number> } {
  const rows = getActiveResourcesInfo();
  const byType: Record<string, number> = {};
  for (const row of rows) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
  }
  return { total: rows.length, byType };
}

export function captureMemoryDiagnostics(
  atMs: number,
  engines?: { readonly fees?: FeeEngine; readonly productive?: ProductiveEconomyEngine },
): MemoryDiagnostics {
  const memory = process.memoryUsage();
  const resources = countActiveResources();
  const feeStats = engines?.fees?.feeReceiptRetentionStats();
  const productive = engines?.productive;
  return Object.freeze({
    atMs,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBufferBytes: memory.arrayBuffers,
    eventListenerCount: performance.eventLoopUtilization ? 0 : 0,
    timerCount: resources.byType['Timeout'] ?? 0,
    activeResourceCount: resources.total,
    activeResourceTypes: Object.freeze({ ...resources.byType }),
    feeReceiptsInMemory: feeStats?.inMemoryReceipts ?? 0,
    feeReceiptsSealed: feeStats?.sealedReceipts ?? 0,
    productiveObjects: productive?.currentMetrics().productive_objects ?? 0,
    productiveClaims: productive?.currentMetrics().productive_claims ?? 0,
    productiveFacts: productive?.listFacts().length ?? 0,
    productiveReceipts: productive?.listReceipts().length ?? 0,
  });
}

export function diagnosticsToResourceSample(row: MemoryDiagnostics): ResourceSample {
  return Object.freeze({
    atMs: row.atMs,
    rssBytes: row.rssBytes,
    heapUsedBytes: row.heapUsedBytes,
    cpuUserMs: 0,
    cpuSystemMs: 0,
    heapTotalBytes: row.heapTotalBytes,
    externalBytes: row.externalBytes,
    arrayBufferBytes: row.arrayBufferBytes,
    activeResourceCount: row.activeResourceCount,
    feeReceiptsInMemory: row.feeReceiptsInMemory,
    feeReceiptsSealed: row.feeReceiptsSealed,
    productiveObjects: row.productiveObjects,
    productiveClaims: row.productiveClaims,
    productiveFacts: row.productiveFacts,
    productiveReceipts: row.productiveReceipts,
  });
}
