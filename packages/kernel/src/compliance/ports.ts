import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AdverseMediaReference, ScreeningResult } from './result.ts';
import type { ScreeningOutcome, SubjectKind } from './types.ts';

export type ScreeningRequest = {
  readonly subjectKind: SubjectKind;
  readonly subjectRef: string;
  readonly jurisdiction: string;
  readonly now: UtcInstant;
};

/**
 * Normalized provider response. Raw vendor schemas stop at the adapter.
 */
export type ProviderScreenResponse = {
  readonly available: boolean;
  readonly outcome: ScreeningOutcome;
  readonly reasonCodes: readonly string[];
  readonly providerRef: string;
  readonly providerModel: string | null;
  readonly providerHash: string;
  readonly confidence: number | null;
  readonly score: number | null;
  readonly evidenceRefs: readonly string[];
};

export type SanctionsProvider = {
  screen(request: ScreeningRequest): ProviderScreenResponse;
};

export type PepProvider = {
  screen(request: ScreeningRequest): ProviderScreenResponse;
};

export type AdverseMediaProvider = {
  screen(request: ScreeningRequest): ProviderScreenResponse & {
    readonly references: readonly AdverseMediaReference[];
    readonly copyrightedCopyStored: false;
    readonly treatedAsGuilt: false;
  };
};

export type TransactionMonitoringProvider = {
  evaluate(request: ScreeningRequest & { readonly journalId?: string }): ProviderScreenResponse;
};

export type FraudRiskProvider = {
  evaluate(request: ScreeningRequest): ProviderScreenResponse & {
    readonly freezesFunds: false;
    readonly deletesAccount: false;
    readonly reversesSettlement: false;
  };
};

export type DeviceRiskProvider = {
  screen(request: ScreeningRequest): ProviderScreenResponse;
};

export type ComplianceProviderPorts = {
  readonly sanctions: SanctionsProvider;
  readonly pep: PepProvider;
  readonly adverseMedia: AdverseMediaProvider;
  readonly transactionMonitoring: TransactionMonitoringProvider;
  readonly fraud: FraudRiskProvider;
  readonly deviceRisk: DeviceRiskProvider;
};

export type ProviderHealth = {
  readonly providerId: string;
  readonly available: boolean;
  readonly lastCheckedAt: UtcInstant;
  readonly lastErrorCode: string | null;
};

export function toUnavailable(providerRef: string, now: UtcInstant): ProviderScreenResponse {
  return Object.freeze({
    available: false,
    outcome: 'UNAVAILABLE',
    reasonCodes: Object.freeze(['PROVIDER_UNAVAILABLE']),
    providerRef,
    providerModel: null,
    providerHash: `unavailable:${providerRef}:${now}`,
    confidence: null,
    score: null,
    evidenceRefs: Object.freeze([]),
  });
}

export function assertNormalizedResult(result: ScreeningResult): void {
  if (result.outcome === 'UNAVAILABLE' && result.reasonCodes.includes('IMPLICIT_CLEAR')) {
    throw new Error('provider unavailable must not be rewritten to CLEAR');
  }
}
