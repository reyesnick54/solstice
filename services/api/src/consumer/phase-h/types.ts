/**
 * Client-safe Phase H vocabulary. Orchestration only.
 * Not a second vault, consent ledger, HIN engine, or mint.
 */

export const DATA_SOURCE_STATUSES = [
  'LIVE',
  'DELAYED',
  'SANDBOX',
  'STALE',
  'UNAVAILABLE',
  'UNVERIFIED',
] as const;
export type DataSourceStatus = (typeof DATA_SOURCE_STATUSES)[number];

export const RIGHTS_REQUEST_KINDS = [
  'ACCESS',
  'EXPORT',
  'CORRECTION',
  'DELETION',
  'RESTRICTION',
  'CONSENT_WITHDRAWAL',
] as const;
export type RightsRequestKind = (typeof RIGHTS_REQUEST_KINDS)[number];

export const RIGHTS_REQUEST_STATES = [
  'SUBMITTED',
  'IN_PROGRESS',
  'COMPLETED',
  'DENIED',
  'HELD',
] as const;
export type RightsRequestState = (typeof RIGHTS_REQUEST_STATES)[number];

export const PHASE_H_POSTURE = Object.freeze({
  schema: 'sunrey.consumer.phase-h.posture.v1',
  environment: 'simulation',
  productionActive: false,
  liveDataMarketplaceEnabled: false,
  liveDataMonetizationEnabled: false,
  liveHinBasedIssuanceEnabled: false,
  liveMoonreyProductiveIssuanceEnabled: false,
  hinCannotModifySupply: true,
  productiveValueIsNotMarketPrice: true,
  hinValueIsNotMarketPrice: true,
  sandboxDataIsNotReal: true,
});

export type PhaseHFailure = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
};

export type PhaseHOk<T> = {
  readonly ok: true;
  readonly value: T;
};

export type PhaseHResult<T> = PhaseHOk<T> | PhaseHFailure;
