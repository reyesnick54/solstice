/**
 * HELIOS Prediction Market research service (paper + observation only).
 */

import type { Clock } from '@solstice/config';
import { browsePredictionMarkets, findEventBySlug } from './market-browser.ts';
import { resolvePolymarketTokenEntity } from './entity-resolution.ts';
import { extractYesNoPairFeatures } from './features.ts';
import { sealPredictionMarketEvidence } from './evidence.ts';
import { submitExecutionTwinOrder, type TwinSubmitResult } from './execution-twin.ts';
import { fixtureClobBooks, fixturePredictionEvents, FIXTURE_CONDITION_FED_DEC } from './fixtures.ts';
import type { PredictionMarketStore } from './store.ts';
import type {
  CloBookMetrics,
  PredictionMarketBrowserQuery,
  PredictionMarketEvidenceRecord,
} from './types.ts';
import { computeClobBookMetrics } from './clob-metrics.ts';
import type { PredictionOutcomeSide } from './taxonomy.ts';

export type HeliosPredictionMarketServiceOptions = {
  readonly clock: Clock;
  readonly store: PredictionMarketStore;
};

export class HeliosPredictionMarketService {
  readonly #clock: Clock;
  readonly #store: PredictionMarketStore;

  constructor(options: HeliosPredictionMarketServiceOptions) {
    this.#clock = options.clock;
    this.#store = options.store;
  }

  loadSandboxFixtures(): void {
    const now = this.#clock.now();
    const bindings = [
      resolvePolymarketTokenEntity({
        providerNativeConditionId: FIXTURE_CONDITION_FED_DEC,
        providerNativeTokenId: '0xfixture_yes_token',
        side: 'YES',
        resolvedAt: now,
      }),
      resolvePolymarketTokenEntity({
        providerNativeConditionId: FIXTURE_CONDITION_FED_DEC,
        providerNativeTokenId: '0xfixture_no_token',
        side: 'NO',
        resolvedAt: now,
      }),
    ];
    this.#store.replace(
      Object.freeze({
        events: fixturePredictionEvents(),
        books: fixtureClobBooks(),
        positions: Object.freeze([]),
        twinOrders: Object.freeze([]),
        entityBindings: Object.freeze(bindings),
      }),
    );
  }

  browseMarkets(query?: PredictionMarketBrowserQuery) {
    return browsePredictionMarkets(this.#store.snapshot().events, query);
  }

  eventBySlug(slug: string) {
    return findEventBySlug(this.#store.snapshot().events, slug);
  }

  bookMetrics(contractInstrumentId: string): CloBookMetrics | null {
    const book = this.#store.snapshot().books.find((b) => b.contractInstrumentId === contractInstrumentId);
    return book ? computeClobBookMetrics(book) : null;
  }

  featureVectorForCondition(conditionId: string) {
    const books = this.#store.snapshot().books;
    const yesBook = books.find(
      (b) => b.contractInstrumentId.endsWith(':yes') && b.contractInstrumentId.includes(conditionId),
    );
    const noBook = books.find(
      (b) => b.contractInstrumentId.endsWith(':no') && b.contractInstrumentId.includes(conditionId),
    );
    if (!yesBook || !noBook) {
      return null;
    }
    return extractYesNoPairFeatures({
      yesBook,
      noBook,
      asOf: this.#clock.now(),
      hoursToExpiry: 1000,
    });
  }

  submitPaperTwinOrder(input: {
    readonly twinOrderId: string;
    readonly contractInstrumentId: string;
    readonly conditionId: string;
    readonly side: 'BUY' | 'SELL';
    readonly outcomeSide: PredictionOutcomeSide;
    readonly quantityContracts: bigint;
    readonly limitPriceMinor?: bigint | null;
  }): TwinSubmitResult {
    const snap = this.#store.snapshot();
    const book = snap.books.find((b) => b.contractInstrumentId === input.contractInstrumentId);
    if (!book) {
      throw new Error('book not found for contract');
    }
    const result = submitExecutionTwinOrder({
      twinOrderId: input.twinOrderId,
      mode: 'PAPER_SIMULATION',
      contractInstrumentId: input.contractInstrumentId,
      conditionId: input.conditionId,
      side: input.side,
      outcomeSide: input.outcomeSide,
      quantityContracts: input.quantityContracts,
      limitPriceMinor: input.limitPriceMinor ?? null,
      book,
      submittedAt: this.#clock.now(),
      positions: snap.positions,
    });
    this.#store.replace(
      Object.freeze({
        ...snap,
        positions: result.positions,
        twinOrders: Object.freeze([...snap.twinOrders, result.order]),
      }),
    );
    return result;
  }

  sealResearchEvidence(kind: string, payload: unknown): PredictionMarketEvidenceRecord {
    return sealPredictionMarketEvidence({
      kind,
      payload,
      sealedAt: this.#clock.now(),
    });
  }
}

export function createHeliosPredictionMarketService(
  options: HeliosPredictionMarketServiceOptions,
): HeliosPredictionMarketService {
  return new HeliosPredictionMarketService(options);
}
