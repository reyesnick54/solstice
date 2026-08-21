/**
 * Provider-neutral digital-asset risk analysis (blockchain analytics).
 *
 * Normalizes vendor results into compliance findings. The analytics
 * provider cannot approve or deny a withdrawal independently of
 * Kernel / compliance policy.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ScreeningOutcome } from '../types.ts';
import type { ProviderScreenResponse } from '../ports.ts';

export const BLOCKCHAIN_ANALYTICS_CONTRACT_VERSION = 'sunrey-blockchain-analytics-contract/1' as const;

export const BLOCKCHAIN_ANALYTICS_OPERATIONS = [
  'screenAddress',
  'screenTransaction',
  'getExposure',
  'getRiskSignals',
] as const;
export type BlockchainAnalyticsOperation = (typeof BLOCKCHAIN_ANALYTICS_OPERATIONS)[number];

export type BlockchainRiskSignal = {
  readonly code: string;
  readonly severity: 'INFO' | 'REVIEW' | 'HIGH';
  readonly isKernelDecision: false;
};

export type BlockchainExposure = {
  readonly category: string;
  readonly quantityShareBps: bigint;
  readonly isGuilt: false;
};

export type BlockchainAnalyticsFinding = {
  readonly operation: BlockchainAnalyticsOperation;
  readonly subjectRef: string;
  readonly outcome: ScreeningOutcome;
  readonly signals: readonly BlockchainRiskSignal[];
  readonly exposure: readonly BlockchainExposure[];
  readonly providerId: string;
  readonly providerRef: string;
  readonly evidenceRefs: readonly string[];
  readonly observedAt: UtcInstant;
  readonly isKernelDecision: false;
  readonly authorizesWithdrawal: false;
  readonly deniesWithdrawal: false;
};

export type BlockchainAnalyticsProvider = {
  readonly providerId: string;
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  screenAddress(address: string, now: UtcInstant): BlockchainAnalyticsFinding;
  screenTransaction(txRef: string, now: UtcInstant): BlockchainAnalyticsFinding;
  getExposure(address: string, now: UtcInstant): BlockchainAnalyticsFinding;
  getRiskSignals(address: string, now: UtcInstant): BlockchainAnalyticsFinding;
};

export function findingToCompliance(finding: BlockchainAnalyticsFinding): ProviderScreenResponse {
  return Object.freeze({
    available: finding.outcome !== 'UNAVAILABLE',
    outcome: finding.outcome,
    reasonCodes: Object.freeze(finding.signals.map((row) => row.code)),
    providerRef: finding.providerRef,
    providerModel: 'blockchain-analytics-fixture',
    providerHash: sha256Hex(finding.providerRef),
    confidence: null,
    score: null,
    evidenceRefs: finding.evidenceRefs,
  });
}

export function analyticsCannotDecideWithdrawal(finding: BlockchainAnalyticsFinding): boolean {
  return finding.authorizesWithdrawal === false && finding.deniesWithdrawal === false && finding.isKernelDecision === false;
}

function finding(input: {
  readonly providerId: string;
  readonly operation: BlockchainAnalyticsOperation;
  readonly subjectRef: string;
  readonly outcome: ScreeningOutcome;
  readonly signals: readonly BlockchainRiskSignal[];
  readonly exposure: readonly BlockchainExposure[];
  readonly now: UtcInstant;
}): BlockchainAnalyticsFinding {
  return Object.freeze({
    operation: input.operation,
    subjectRef: input.subjectRef,
    outcome: input.outcome,
    signals: Object.freeze([...input.signals]),
    exposure: Object.freeze([...input.exposure]),
    providerId: input.providerId,
    providerRef: `${input.providerId}:${input.operation}:${input.subjectRef}`,
    evidenceRefs: Object.freeze([`ba-ev:${input.providerId}:${input.subjectRef}`]),
    observedAt: input.now,
    isKernelDecision: false,
    authorizesWithdrawal: false,
    deniesWithdrawal: false,
  });
}

export class FixtureBlockchainAnalyticsProvider implements BlockchainAnalyticsProvider {
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;
  #unavailable = false;

  readonly providerId: string;

  constructor(providerId: string) {
    this.providerId = providerId;
  }

  setUnavailable(value: boolean): void {
    this.#unavailable = value;
  }

  screenAddress(address: string, now: UtcInstant): BlockchainAnalyticsFinding {
    return this.#screen('screenAddress', address, now);
  }

  screenTransaction(txRef: string, now: UtcInstant): BlockchainAnalyticsFinding {
    return this.#screen('screenTransaction', txRef, now);
  }

  getExposure(address: string, now: UtcInstant): BlockchainAnalyticsFinding {
    return this.#screen('getExposure', address, now);
  }

  getRiskSignals(address: string, now: UtcInstant): BlockchainAnalyticsFinding {
    return this.#screen('getRiskSignals', address, now);
  }

  #screen(operation: BlockchainAnalyticsOperation, subjectRef: string, now: UtcInstant): BlockchainAnalyticsFinding {
    if (this.#unavailable) {
      return finding({
        providerId: this.providerId,
        operation,
        subjectRef,
        outcome: 'UNAVAILABLE',
        signals: Object.freeze([{ code: 'ANALYTICS_UNAVAILABLE', severity: 'HIGH', isKernelDecision: false }]),
        exposure: Object.freeze([]),
        now,
      });
    }
    const risky = subjectRef.toLowerCase().includes('mix') || subjectRef.toLowerCase().includes('sanction');
    return finding({
      providerId: this.providerId,
      operation,
      subjectRef,
      outcome: risky ? 'REVIEW' : 'CLEAR',
      signals: risky
        ? Object.freeze([{ code: 'EXPOSURE_REVIEW', severity: 'REVIEW', isKernelDecision: false }])
        : Object.freeze([{ code: 'NO_MATERIAL_EXPOSURE', severity: 'INFO', isKernelDecision: false }]),
      exposure: risky
        ? Object.freeze([{ category: 'UNKNOWN_SERVICE', quantityShareBps: 2500n, isGuilt: false }])
        : Object.freeze([]),
      now,
    });
  }
}

export function createBlockchainAnalyticsA(): FixtureBlockchainAnalyticsProvider {
  return new FixtureBlockchainAnalyticsProvider('fixture-analytics-a');
}

export function createBlockchainAnalyticsB(): FixtureBlockchainAnalyticsProvider {
  return new FixtureBlockchainAnalyticsProvider('fixture-analytics-b');
}

export function runBlockchainAnalyticsContractSuite(
  provider: BlockchainAnalyticsProvider = createBlockchainAnalyticsA(),
): {
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly cases: readonly string[];
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
} {
  const now = '2026-08-21T00:00:00.000Z' as UtcInstant;
  const address = provider.screenAddress('addr_ok', now);
  const tx = provider.screenTransaction('tx_ok', now);
  const exposure = provider.getExposure('addr_mix', now);
  const signals = provider.getRiskSignals('addr_ok', now);
  const compliance = findingToCompliance(address);
  const passed =
    analyticsCannotDecideWithdrawal(address) &&
    address.outcome === 'CLEAR' &&
    tx.outcome === 'CLEAR' &&
    exposure.outcome === 'REVIEW' &&
    signals.signals.length > 0 &&
    compliance.isKernelDecision !== true &&
    compliance.outcome === 'CLEAR';
  return Object.freeze({
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    cases: Object.freeze(['screenAddress', 'screenTransaction', 'getExposure', 'getRiskSignals', 'not_kernel_decision']),
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
  });
}
