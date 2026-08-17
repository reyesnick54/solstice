import type { PublicAssetId } from './ids.ts';

export const SUBMISSION_STATUSES = ['ACCEPTED', 'REJECTED', 'KNOWN', 'SUBMISSION_UNKNOWN'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const TRANSACTION_STATUSES = [
  'LOCAL_ONLY',
  'SUBMITTED',
  'MEMPOOL',
  'INCLUDED',
  'FINALIZED',
  'REJECTED',
  'EXPIRED',
  'UNKNOWN',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const CONSISTENCY_LEVELS = ['FINALIZED', 'INDEXED_FINALIZED', 'PENDING_LOCAL'] as const;
export type ConsistencyLevel = (typeof CONSISTENCY_LEVELS)[number];

export const API_NAMESPACES = [
  'CHAIN',
  'ACCOUNTS',
  'ASSETS',
  'FEES',
  'VALIDATORS',
  'GOVERNANCE',
  'ORACLES',
  'PRODUCTIVE_ECONOMY',
  'MACHINE_ECONOMY',
  'INTEROPERABILITY',
  'EXCHANGE',
] as const;
export type ApiNamespace = (typeof API_NAMESPACES)[number];

export const API_SURFACES = ['PUBLIC_API', 'OPERATOR_API'] as const;
export type ApiSurface = (typeof API_SURFACES)[number];

export const EVENT_TYPES = [
  'newFinalizedBlock',
  'transactionStatus',
  'accountActivity',
  'assetTransfer',
  'governanceProposal',
  'governanceActivation',
  'oracleFact',
  'productiveContribution',
  'moonreyIssuance',
  'machineSettlement',
  'exchangeTrade',
  'exchangeSettlement',
  'interopPacket',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const MARKET_FAMILIES = [
  'DIGITAL_ASSET',
  'HUMAN_INFORMATION_RIGHT',
  'INTELLIGENCE_COMPUTE',
  'PRODUCTIVE_CAPACITY',
] as const;
export type MarketFamily = (typeof MARKET_FAMILIES)[number];

export const ACCOUNT_POLICY_KINDS = [
  'SINGLE_SIGNATURE',
  'M_OF_N',
  'ROLE_BASED',
  'OWNER_PLUS_RECOVERY',
  'INSTITUTIONAL_POLICY',
  'MACHINE_MANDATE',
] as const;
export type AccountPolicyKind = (typeof ACCOUNT_POLICY_KINDS)[number];

export type FeeDeclaration = {
  readonly estimatedFee: string;
  readonly maximumAuthorizedFee: string;
  readonly actualFinalizedFee: string | null;
  readonly feeAsset: PublicAssetId;
  readonly scheduleHash: string;
};

export type SubmissionResponse = {
  readonly transaction_id: string;
  readonly submission_status: SubmissionStatus;
  readonly network_id: string;
  readonly received_at: string;
  readonly mempool_status: 'QUEUED' | 'ABSENT' | 'UNKNOWN';
};

export type TransactionReceipt = {
  readonly transaction_id: string;
  readonly status: TransactionStatus;
  readonly network_id: string;
  readonly height: string | null;
  readonly block_id: string | null;
  readonly finalized: boolean;
  readonly consistency: ConsistencyLevel;
  readonly fee: FeeDeclaration | null;
};

export type ChainStatus = {
  readonly network_id: string;
  readonly chain_id: string;
  readonly protocol_version: string;
  readonly api_version: 'v1';
  readonly finalized_height: string;
  readonly latest_block_id: string;
  readonly state_root: string;
  readonly environment: 'simulation';
  readonly ticker_status: 'NOT_ASSIGNED';
  readonly consistency: ConsistencyLevel;
};

export type PublicAccount = {
  readonly account_id: string;
  readonly address: string;
  readonly nonce: string;
  readonly authorization_policy: AccountPolicyKind;
  readonly account_status: string;
  readonly approved_crypto_suites: readonly string[];
  readonly consistency: ConsistencyLevel;
};

export type AssetHolding = {
  readonly account_id: string;
  readonly asset_id: PublicAssetId;
  readonly available: string;
  readonly locked: string;
  readonly ticker_status: 'NOT_ASSIGNED';
  readonly consistency: ConsistencyLevel;
};

export type SignedEnvelopeSubmission = {
  readonly signed_envelope_hex: string;
  readonly network_id: string;
  readonly idempotency_key?: string;
};

export type PublicStreamEvent = {
  readonly event_version: 'v1';
  readonly event_type: EventType;
  readonly event_id: string;
  readonly cursor: string;
  readonly finalized_height: string;
  readonly occurred_at: string;
  readonly authority: 'PROJECTION';
  readonly canonical_ref: {
    readonly transaction_id?: string;
    readonly block_id?: string;
  };
  readonly payload: Readonly<Record<string, string>>;
};
