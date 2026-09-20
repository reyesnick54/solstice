/**
 * Governed historical bar ingestion with request budget, idempotent storage,
 * gap detection, duplicate detection, provenance, and quality reporting.
 *
 * Never fabricates historical bars from repeated quote values.
 */

import type { UtcInstant } from '@solstice/domain';
import type { CapitalMarketProvider } from './provider.ts';
import {
  barsInRange,
  createCapitalMarketBarStore,
  sortBarsByPeriodStart,
  type CapitalMarketBarStore,
} from './bar-store.ts';
import {
  timeframeDurationSeconds,
  validateHistoricalRange,
  type CapitalMarketHistoricalRange,
  type CapitalMarketTimeframe,
} from './timeframes.ts';
import type { CapitalMarketBar, CapitalMarketIngestQualityReport, CapitalMarketResult } from './types.ts';

export type CapitalMarketHistoricalIngestRequest = {
  readonly instrumentId: string;
  readonly timeframe: CapitalMarketTimeframe;
  readonly range: CapitalMarketHistoricalRange;
  readonly requestBudget?: number;
  readonly nowUtc: UtcInstant;
};

export type CapitalMarketHistoricalIngestResult =
  | {
      readonly ok: true;
      readonly bars: readonly CapitalMarketBar[];
      readonly qualityReport: CapitalMarketIngestQualityReport;
      readonly fromCache: boolean;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly providerId: string;
      readonly qualityReport: CapitalMarketIngestQualityReport | null;
    };

export type CapitalMarketHistoricalIngestorOptions = {
  readonly provider: CapitalMarketProvider;
  readonly store?: CapitalMarketBarStore;
};

export class CapitalMarketHistoricalIngestor {
  readonly #provider: CapitalMarketProvider;
  readonly #store: CapitalMarketBarStore;
  #requestBudgetUsed = 0;

  constructor(options: CapitalMarketHistoricalIngestorOptions) {
    this.#provider = options.provider;
    this.#store = options.store ?? createCapitalMarketBarStore();
  }

  get store(): CapitalMarketBarStore {
    return this.#store;
  }

  get requestBudgetUsed(): number {
    return this.#requestBudgetUsed;
  }

  async ingest(request: CapitalMarketHistoricalIngestRequest): Promise<CapitalMarketHistoricalIngestResult> {
    const budgetLimit = request.requestBudget ?? 1;
    const emptyReport = this.#baseReport(request, budgetLimit);

    if (!validateHistoricalRange(request.range)) {
      return Object.freeze({
        ok: false,
        code: 'INVALID_RANGE',
        message: 'historical range from must be <= to',
        providerId: this.#provider.providerId,
        qualityReport: emptyReport,
      });
    }

    if (this.#requestBudgetUsed >= budgetLimit) {
      return Object.freeze({
        ok: false,
        code: 'REQUEST_BUDGET_EXCEEDED',
        message: 'historical ingestion request budget exceeded',
        providerId: this.#provider.providerId,
        qualityReport: emptyReport,
      });
    }

    const cached = sortBarsByPeriodStart(
      barsInRange(
        this.#store.listByInstrumentTimeframe(request.instrumentId, request.timeframe),
        request.range,
      ),
    );
    const expectedBars = estimateExpectedBars(request.range, request.timeframe);
    if (cached.length >= expectedBars && expectedBars > 0) {
      const qualityReport = this.#qualityReport(request, budgetLimit, cached, cached, {
        stored: 0,
        duplicates: 0,
        fromProvider: false,
      });
      return Object.freeze({
        ok: true,
        bars: cached,
        qualityReport,
        fromCache: true,
      });
    }

    this.#requestBudgetUsed += 1;
    const providerResult = await this.#provider.getHistoricalBars(
      request.instrumentId,
      request.timeframe,
      request.range,
      request.nowUtc,
    );

    if (!providerResult.ok) {
      return Object.freeze({
        ok: false,
        code: providerResult.code,
        message: providerResult.message,
        providerId: providerResult.providerId,
        qualityReport: this.#qualityReport(request, budgetLimit, [], [], {
          stored: 0,
          duplicates: 0,
          fromProvider: true,
        }),
      });
    }

    const received = sortBarsByPeriodStart(providerResult.value);
    const putResult = this.#store.putMany(received);
    const storedBars = sortBarsByPeriodStart(
      barsInRange(
        this.#store.listByInstrumentTimeframe(request.instrumentId, request.timeframe),
        request.range,
      ),
    );

    const qualityReport = this.#qualityReport(request, budgetLimit, received, storedBars, {
      stored: putResult.stored,
      duplicates: putResult.duplicates,
      fromProvider: true,
    });

    return Object.freeze({
      ok: true,
      bars: storedBars,
      qualityReport,
      fromCache: false,
    });
  }

  #baseReport(
    request: CapitalMarketHistoricalIngestRequest,
    budgetLimit: number,
  ): CapitalMarketIngestQualityReport {
    return Object.freeze({
      instrumentId: request.instrumentId,
      timeframe: request.timeframe,
      range: request.range,
      barsRequested: estimateExpectedBars(request.range, request.timeframe),
      barsReceived: 0,
      barsStored: 0,
      duplicatesDetected: 0,
      gapsDetected: 0,
      gapPeriods: Object.freeze([]),
      requestBudgetUsed: this.#requestBudgetUsed,
      requestBudgetLimit: budgetLimit,
      providerId: this.#provider.providerId,
    });
  }

  #qualityReport(
    request: CapitalMarketHistoricalIngestRequest,
    budgetLimit: number,
    received: readonly CapitalMarketBar[],
    storedBars: readonly CapitalMarketBar[],
    counters: { readonly stored: number; readonly duplicates: number; readonly fromProvider: boolean },
  ): CapitalMarketIngestQualityReport {
    const gapAnalysis = detectGaps(storedBars, request.range, request.timeframe);
    return Object.freeze({
      instrumentId: request.instrumentId,
      timeframe: request.timeframe,
      range: request.range,
      barsRequested: estimateExpectedBars(request.range, request.timeframe),
      barsReceived: received.length,
      barsStored: counters.fromProvider ? counters.stored : storedBars.length,
      duplicatesDetected: counters.duplicates,
      gapsDetected: gapAnalysis.gapsDetected,
      gapPeriods: gapAnalysis.gapPeriods,
      requestBudgetUsed: this.#requestBudgetUsed,
      requestBudgetLimit: budgetLimit,
      providerId: this.#provider.providerId,
    });
  }
}

export function estimateExpectedBars(range: CapitalMarketHistoricalRange, timeframe: CapitalMarketTimeframe): number {
  const spanSeconds = Math.max(0, (Date.parse(range.to) - Date.parse(range.from)) / 1000);
  const bucket = timeframeDurationSeconds(timeframe);
  if (bucket <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(spanSeconds / bucket) + 1);
}

export function detectGaps(
  bars: readonly CapitalMarketBar[],
  range: CapitalMarketHistoricalRange,
  timeframe: CapitalMarketTimeframe,
): {
  readonly gapsDetected: number;
  readonly gapPeriods: readonly { readonly expectedStart: string; readonly expectedEnd: string }[];
} {
  const sorted = sortBarsByPeriodStart(bars);
  const bucketMs = timeframeDurationSeconds(timeframe) * 1000;
  const gapPeriods: { expectedStart: string; expectedEnd: string }[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const prior = sorted[index - 1]!;
    const current = sorted[index]!;
    const delta = Date.parse(current.periodStart) - Date.parse(prior.periodStart);
    if (delta > bucketMs * 1.5) {
      const missingStart = new Date(Date.parse(prior.periodStart) + bucketMs).toISOString();
      const missingEnd = new Date(Date.parse(current.periodStart) - 1).toISOString();
      gapPeriods.push({ expectedStart: missingStart, expectedEnd: missingEnd });
    }
  }

  if (sorted.length > 0) {
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    if (Date.parse(first.periodStart) - Date.parse(range.from) > bucketMs * 1.5) {
      gapPeriods.push({
        expectedStart: range.from,
        expectedEnd: new Date(Date.parse(first.periodStart) - 1).toISOString(),
      });
    }
    if (Date.parse(range.to) - Date.parse(last.periodStart) > bucketMs * 1.5) {
      gapPeriods.push({
        expectedStart: new Date(Date.parse(last.periodStart) + bucketMs).toISOString(),
        expectedEnd: range.to,
      });
    }
  }

  return Object.freeze({
    gapsDetected: gapPeriods.length,
    gapPeriods: Object.freeze(gapPeriods.map((row) => Object.freeze(row))),
  });
}

export function createCapitalMarketHistoricalIngestor(
  options: CapitalMarketHistoricalIngestorOptions,
): CapitalMarketHistoricalIngestor {
  return new CapitalMarketHistoricalIngestor(options);
}

export type { CapitalMarketResult };
