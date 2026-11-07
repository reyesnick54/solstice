/**
 * HELIOS EXEC14 — broker and custody provider connectivity conformance.
 * Provider-neutral certification; injected/fixture transports only.
 */

export const HELIOS_EXEC14_SCHEMA_VERSION = 'helios.execution-connectivity.exec14.v1' as const;

export const HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED =
  'HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED' as const;

export const HELIOS_EXEC14_PROVIDER_CONFORMANCE_BLOCKED =
  'HELIOS_EXEC14_PROVIDER_CONFORMANCE_BLOCKED' as const;

/** Production-shaped progression — passing conformance alone is never production qualification. */
export const EXEC14_PROVIDER_STATES = Object.freeze([
  'REGISTERED',
  'FIXTURE_QUALIFIED',
  'SANDBOX_QUALIFIED',
  'READ_ONLY_LIVE_QUALIFIED',
  'ORDER_ENTRY_CONFORMANCE_PASSED',
  'EXTERNAL_APPROVAL_REQUIRED',
  'PRODUCTION_DISABLED',
] as const);

export type Exec14ProviderState = (typeof EXEC14_PROVIDER_STATES)[number];

export const EXEC14_CAPABILITY_AVAILABILITY = ['AVAILABLE', 'UNAVAILABLE'] as const;
export type Exec14CapabilityAvailability = (typeof EXEC14_CAPABILITY_AVAILABILITY)[number];

export const EXEC14_BROKER_ORDER_TYPES = Object.freeze([
  'MARKET',
  'LIMIT',
  'STOP',
  'STOP_LIMIT',
  'TRAILING_STOP',
] as const);

export type Exec14BrokerOrderType = (typeof EXEC14_BROKER_ORDER_TYPES)[number];

export const EXEC14_BROKER_TIF = Object.freeze(['DAY', 'GTC', 'IOC', 'FOK', 'OPG', 'CLS'] as const);
export type Exec14BrokerTimeInForce = (typeof EXEC14_BROKER_TIF)[number];

export const EXEC14_BROKER_ASSET_CLASSES = Object.freeze([
  'us_equity',
  'us_etf',
  'us_option',
  'crypto_spot',
  'mutual_fund',
  'fixed_income',
] as const);

export type Exec14BrokerAssetClass = (typeof EXEC14_BROKER_ASSET_CLASSES)[number];

export const EXEC14_CONFORMANCE_OUTCOMES = ['PASS', 'FAIL', 'SKIPPED'] as const;
export type Exec14ConformanceOutcome = (typeof EXEC14_CONFORMANCE_OUTCOMES)[number];

export const EXEC14_BROKER_CONFORMANCE_CASES = Object.freeze([
  'authentication',
  'idempotency',
  'submit',
  'cancel',
  'replace',
  'partial_fill',
  'full_fill',
  'reject',
  'timeout_ambiguity',
  'recovery',
  'statement',
  'position_reconciliation',
  'cash_reconciliation',
  'restart',
] as const);

export type Exec14BrokerConformanceCaseId = (typeof EXEC14_BROKER_CONFORMANCE_CASES)[number];

export const EXEC14_CUSTODY_CONFORMANCE_CASES = Object.freeze([
  'authentication',
  'idempotency',
  'deposit_credit',
  'withdrawal_workflow',
  'partial_settlement',
  'full_settlement',
  'reject',
  'timeout_ambiguity',
  'recovery',
  'statement',
  'position_reconciliation',
  'cash_reconciliation',
  'restart',
] as const);

export type Exec14CustodyConformanceCaseId = (typeof EXEC14_CUSTODY_CONFORMANCE_CASES)[number];

export const EXEC14_CREDENTIAL_ENVIRONMENTS = Object.freeze(['SIMULATION', 'SANDBOX', 'PAPER'] as const);
export type Exec14CredentialEnvironment = (typeof EXEC14_CREDENTIAL_ENVIRONMENTS)[number];
