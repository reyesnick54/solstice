import type { MarketSurveillanceService } from '../service.ts';
import type { MarketSnapshot } from '../types.ts';
import {
  FIXTURE_SURVEILLANCE_PROVIDER_ID,
  type ExternalSurveillanceSignal,
  type SurveillanceIngestResult,
  type SurveillanceProviderCandidateProfile,
} from './types.ts';

export function fixtureSurveillanceProfile(): SurveillanceProviderCandidateProfile {
  return Object.freeze({
    providerId: FIXTURE_SURVEILLANCE_PROVIDER_ID,
    version: '1.0.0-candidate',
    credentialDescriptorRef: 'cred-desc:fixture-surveillance:surveillance_worker',
    endpointProfileRef: 'endpoint:fixture-surveillance:sandbox',
    productionAuthorized: false,
    liveVendorConnected: false,
    isEnforcementAuthority: false,
  });
}

export function adaptExternalSignal(signal: ExternalSurveillanceSignal): MarketSnapshot {
  return Object.freeze({
    marketId: signal.marketId,
    orders: Object.freeze([]),
    trades: Object.freeze([
      Object.freeze({
        tradeId: `ext-${signal.signalId}`,
        marketId: signal.marketId,
        makerOrderId: `mk-${signal.signalId}`,
        takerOrderId: `tk-${signal.signalId}`,
        makerAccountId: signal.accountId,
        takerAccountId: signal.accountId,
        makerParticipantId: signal.participantId,
        takerParticipantId: signal.participantId,
        quantity: 1n,
        priceUnits: 100n,
        matchedAt: signal.observedAt,
      }),
    ]),
  });
}

export class FixtureSurveillanceProvider {
  readonly #seen = new Set<string>();

  ingest(service: MarketSurveillanceService, signal: ExternalSurveillanceSignal): SurveillanceIngestResult {
    if (this.#seen.has(signal.signalId)) {
      return Object.freeze({
        signalId: signal.signalId,
        duplicate: true,
        alertCount: 0,
        cancelsOrder: false,
        freezesWallet: false,
        seizesBalance: false,
        blocksAccount: false,
      });
    }
    this.#seen.add(signal.signalId);
    const alerts = service.observe(adaptExternalSignal(signal));
    return Object.freeze({
      signalId: signal.signalId,
      duplicate: false,
      alertCount: alerts.length,
      cancelsOrder: false,
      freezesWallet: false,
      seizesBalance: false,
      blocksAccount: false,
    });
  }

  isEnforcementAuthority(): false {
    return false;
  }
}
