import type { UtcInstant } from '../../../domain/src/time.ts';
import type { FxReferenceHistoryPoint, FxReferenceRate, FxReferenceServiceResult } from './types.ts';

export type FxReferenceFetchContext = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly nowUtc: UtcInstant;
};

export type FxReferenceProvider = {
  readonly providerId: string;
  readonly precedence: number;
  readonly blocked: boolean;

  getRate(
    base: string,
    quote: string,
    context: FxReferenceFetchContext,
  ): FxReferenceServiceResult<FxReferenceRate> | Promise<FxReferenceServiceResult<FxReferenceRate>>;

  getRates?(
    base: string,
    quotes: readonly string[],
    context: FxReferenceFetchContext,
  ): FxReferenceServiceResult<readonly FxReferenceRate[]> | Promise<FxReferenceServiceResult<readonly FxReferenceRate[]>>;

  getHistoricalRate?(
    base: string,
    quote: string,
    date: string,
    context: FxReferenceFetchContext,
  ): FxReferenceServiceResult<FxReferenceRate> | Promise<FxReferenceServiceResult<FxReferenceRate>>;

  getTimeSeries?(
    base: string,
    quote: string,
    from: string,
    to: string,
    context: FxReferenceFetchContext,
  ): FxReferenceServiceResult<readonly FxReferenceHistoryPoint[]> | Promise<FxReferenceServiceResult<readonly FxReferenceHistoryPoint[]>>;

  getAvailableCurrencies?(
    context: FxReferenceFetchContext,
  ): FxReferenceServiceResult<readonly string[]> | Promise<FxReferenceServiceResult<readonly string[]>>;
};

export type FxReferenceProviderPort = FxReferenceProvider;
