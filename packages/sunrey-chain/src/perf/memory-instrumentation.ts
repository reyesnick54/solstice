import { getActiveResourcesInfo } from 'node:process';

import type { FeeEngine } from '../fees/engine.ts';
import type { ProductiveEconomyEngine } from '../productive/engine.ts';
import type { ResourceSample } from './types.ts';

export type IntegratedMemoryCounts = {
  readonly heliosObservations?: number;
  readonly heliosTwinOrders?: number;
  readonly heliosAgentSessions?: number;
  readonly heliosResearchMonitors?: number;
  readonly heliosEvidenceStagingBytes?: number;
  readonly heliosStrategyEvaluations?: number;
  readonly providerReconnectCycles?: number;
};

export type MemoryDiagnostics = {
  readonly atMs: number;
  readonly phase?: 'WARMUP' | 'STEADY_STATE' | 'COOLDOWN';
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
  readonly arrayBufferBytes: number;
  readonly eventListenerCount: number;
  readonly timerCount: number;
  readonly activeHandleCount: number;
  readonly activeRequestCount: number;
  readonly activeResourceCount: number;
  readonly activeResourceTypes: Readonly<Record<string, number>>;
  readonly feeReceiptsInMemory: number;
  readonly feeReceiptsSealed: number;
  readonly productiveObjects: number;
  readonly productiveClaims: number;
  readonly productiveFacts: number;
  readonly productiveReceipts: number;
  readonly heliosObservations: number;
  readonly heliosTwinOrders: number;
  readonly heliosAgentSessions: number;
  readonly heliosResearchMonitors: number;
  readonly heliosEvidenceStagingBytes: number;
  readonly heliosStrategyEvaluations: number;
  readonly providerReconnectCycles: number;
};

function countActiveResources(): { readonly total: number; readonly byType: Record<string, number> } {
  const rows = getActiveResourcesInfo() as ReadonlyArray<{ readonly type: string } | string>;
  const byType: Record<string, number> = {};
  for (const row of rows) {
    const type = typeof row === 'string' ? row : row.type;
    byType[type] = (byType[type] ?? 0) + 1;
  }
  return { total: rows.length, byType };
}

function totalEventListeners(): number {
  return process.eventNames().reduce((sum, name) => sum + process.listenerCount(name), 0);
}

export function captureMemoryDiagnostics(
  atMs: number,
  engines?: {
    readonly fees?: FeeEngine;
    readonly productive?: ProductiveEconomyEngine;
    readonly integrated?: IntegratedMemoryCounts;
    readonly phase?: 'WARMUP' | 'STEADY_STATE' | 'COOLDOWN';
  },
): MemoryDiagnostics {
  const memory = process.memoryUsage();
  const resources = countActiveResources();
  const feeStats = engines?.fees?.feeReceiptRetentionStats();
  const productive = engines?.productive;
  const integrated = engines?.integrated;
  return Object.freeze({
    atMs,
    phase: engines?.phase,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBufferBytes: memory.arrayBuffers,
    eventListenerCount: totalEventListeners(),
    timerCount: resources.byType['Timeout'] ?? 0,
    activeHandleCount: resources.total,
    activeRequestCount:
      (resources.byType['Immediate'] ?? 0) +
      (resources.byType['TickObject'] ?? 0) +
      (resources.byType['CloseReq'] ?? 0),
    activeResourceCount: resources.total,
    activeResourceTypes: Object.freeze({ ...resources.byType }),
    feeReceiptsInMemory: feeStats?.inMemoryReceipts ?? 0,
    feeReceiptsSealed: feeStats?.sealedReceipts ?? 0,
    productiveObjects: productive?.currentMetrics().productive_objects ?? 0,
    productiveClaims: productive?.currentMetrics().productive_claims ?? 0,
    productiveFacts: productive?.listFacts().length ?? 0,
    productiveReceipts: productive?.listReceipts().length ?? 0,
    heliosObservations: integrated?.heliosObservations ?? 0,
    heliosTwinOrders: integrated?.heliosTwinOrders ?? 0,
    heliosAgentSessions: integrated?.heliosAgentSessions ?? 0,
    heliosResearchMonitors: integrated?.heliosResearchMonitors ?? 0,
    heliosEvidenceStagingBytes: integrated?.heliosEvidenceStagingBytes ?? 0,
    heliosStrategyEvaluations: integrated?.heliosStrategyEvaluations ?? 0,
    providerReconnectCycles: integrated?.providerReconnectCycles ?? 0,
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
    heliosObservations: row.heliosObservations,
    heliosTwinOrders: row.heliosTwinOrders,
    heliosAgentSessions: row.heliosAgentSessions,
    heliosResearchMonitors: row.heliosResearchMonitors,
    heliosEvidenceStagingBytes: row.heliosEvidenceStagingBytes,
    heliosStrategyEvaluations: row.heliosStrategyEvaluations,
    providerReconnectCycles: row.providerReconnectCycles,
    memoryPhase: row.phase,
    eventListenerCount: row.eventListenerCount,
    timerCount: row.timerCount,
    activeHandleCount: row.activeHandleCount,
    activeRequestCount: row.activeRequestCount,
  });
}
