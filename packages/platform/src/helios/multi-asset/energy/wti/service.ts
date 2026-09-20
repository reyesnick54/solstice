/**
 * M08 — WTI energy market intelligence service.
 */

import type { UtcInstant } from '../../../../../../domain/src/time.ts';
import { resolveForExecution } from '../../futures/executability.ts';
import { evaluateRollState, resolveExecutableContract } from '../../futures/roll.ts';
import { assessFirstNotice } from '../../futures/first-notice.ts';
import type { BarInterval, OhlcvBar } from '../../types.ts';
import {
  WTI_COMMODITY_REFERENCE_ID,
  WTI_CONTINUOUS_SERIES,
  WTI_FUTURES_FAMILY,
  WTI_OIL_ETF_PROXY_ID,
  WTI_REGISTERED_CONTRACTS,
  resolveWtiIdentity,
} from './identities.ts';
import { composeWtiMarketState } from './market-state.ts';
import { assess4hTrendReadiness, filterBarsByInterval } from './bars.ts';
import { createWtiSandboxProvider, type WtiSandboxProvider } from './sandbox-provider.ts';
import type { WtiMarketStore } from './store.ts';
import { createWtiMarketStore } from './store.ts';
import type {
  WtiBarsRequest,
  WtiDataResult,
  WtiMarketObservation,
  WtiMarketState,
  WtiTrendReadiness,
} from './types.ts';

export type WtiEnergyServiceOptions = {
  readonly provider?: WtiSandboxProvider;
  readonly store?: WtiMarketStore;
};

export class WtiEnergyMarketService {
  readonly #provider: WtiSandboxProvider;
  readonly #store: WtiMarketStore;

  constructor(options: WtiEnergyServiceOptions = {}) {
    this.#provider = options.provider ?? createWtiSandboxProvider();
    this.#store = options.store ?? createWtiMarketStore();
  }

  get store(): WtiMarketStore {
    return this.#store;
  }

  get provider(): WtiSandboxProvider {
    return this.#provider;
  }

  async getQuote(instrumentId: string, nowUtc: UtcInstant): Promise<WtiDataResult<WtiMarketObservation>> {
    const identity = resolveWtiIdentity(instrumentId);
    if (!identity) {
      return Object.freeze({
        ok: false,
        code: 'UNKNOWN_INSTRUMENT',
        message: `unknown WTI/oil instrument: ${instrumentId}`,
        routeStatus: 'UNAVAILABLE',
      });
    }
    const result = await this.#provider.getObservation(instrumentId, nowUtc);
    if (result.ok) {
      this.#store.putObservation(result.value);
    }
    return result;
  }

  async getBars(request: WtiBarsRequest, nowUtc: UtcInstant): Promise<WtiDataResult<readonly OhlcvBar[]>> {
    return this.#provider.getBars(request, nowUtc);
  }

  async get4hBars(instrumentId: string, nowUtc: UtcInstant, limit = 20): Promise<WtiDataResult<readonly OhlcvBar[]>> {
    return this.getBars({ instrumentId, interval: '4h', limit }, nowUtc);
  }

  assess4hTrendReadiness(instrumentId: string): WtiTrendReadiness {
    const observation = this.#store.getObservation(instrumentId);
    if (!observation) {
      return Object.freeze({
        interval: '4h',
        qualified: false,
        barCount: 0,
        minimumBarsRequired: 10,
        latestBarCloseTime: null,
        message: 'no observation available for trend assessment',
      });
    }
    return assess4hTrendReadiness(observation.bars);
  }

  async buildMarketState(nowUtc: UtcInstant): Promise<WtiMarketState> {
    const rollContext = evaluateRollState({
      familyId: WTI_FUTURES_FAMILY.familyId,
      contracts: WTI_REGISTERED_CONTRACTS,
      nowUtc,
    });

    const [commodity, etf, continuous] = await Promise.all([
      this.getQuote(WTI_COMMODITY_REFERENCE_ID, nowUtc),
      this.getQuote(WTI_OIL_ETF_PROXY_ID, nowUtc),
      this.getQuote(WTI_CONTINUOUS_SERIES.continuousId, nowUtc),
    ]);

    let frontContract: WtiMarketObservation | null = null;
    if (rollContext.frontContractId) {
      const front = await this.getQuote(rollContext.frontContractId, nowUtc);
      frontContract = front.ok ? front.value : null;
    }

    const routeStatuses = [commodity, etf, continuous].map((r) => r.routeStatus);
    const routeStatus = routeStatuses.includes('UNAVAILABLE')
      ? 'UNAVAILABLE'
      : routeStatuses.includes('STALE')
        ? 'STALE'
        : routeStatuses.includes('DEGRADED')
          ? 'DEGRADED'
          : 'QUALIFIED';

    const state = composeWtiMarketState({
      evaluatedAt: nowUtc,
      commodityReference: commodity.ok ? commodity.value : null,
      oilEtfProxy: etf.ok ? etf.value : null,
      frontContract,
      continuousSeries: continuous.ok ? continuous.value : null,
      routeStatus,
    });

    this.#store.putMarketState(state);
    return state;
  }

  resolveExecutionContract(instrumentId: string, nowUtc: UtcInstant):
    | { readonly ok: true; readonly contractId: string }
    | { readonly ok: false; readonly code: string; readonly message: string } {
    const executionCheck = resolveForExecution(instrumentId);
    if (!executionCheck.ok) {
      return executionCheck;
    }
    const rollContext = evaluateRollState({
      familyId: WTI_FUTURES_FAMILY.familyId,
      contracts: WTI_REGISTERED_CONTRACTS,
      nowUtc,
    });
    return resolveExecutableContract(rollContext, executionCheck.contractId);
  }

  firstNoticeAssessment(contractId: string, nowUtc: UtcInstant) {
    const contract = WTI_REGISTERED_CONTRACTS.find((c) => c.contractId === contractId);
    if (!contract) {
      return null;
    }
    return assessFirstNotice({ contract, nowUtc });
  }

  supportedIntervals(): readonly BarInterval[] {
    return Object.freeze(['1h', '4h', '1d']);
  }

  filterBars(observation: WtiMarketObservation, interval: BarInterval) {
    return filterBarsByInterval(observation.bars, interval);
  }
}

export function createWtiEnergyMarketService(options?: WtiEnergyServiceOptions): WtiEnergyMarketService {
  return new WtiEnergyMarketService(options);
}
