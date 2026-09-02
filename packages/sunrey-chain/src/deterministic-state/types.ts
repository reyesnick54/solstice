/**
 * Wave 2 — canonical protocol state types.
 *
 * Plain frozen data only. No Map, Set, or mutable class fields.
 * Consensus-critical monetary state for the sovereign SunRey chain.
 */

import type { BurnClass } from '../economics/types.ts';
import type {
  MonetaryIssuanceAuthority,
  MonetaryPolicyState,
  NativeMonetaryAssetId,
} from '../economics/types.ts';
import type { SupplyActor } from '../native-assets/economic-controls.ts';

export const CANONICAL_STATE_SCHEMA_VERSION = 1 as const;

export const NATIVE_MONETARY_OPERATIONS = ['TRANSFER', 'ISSUE', 'BURN'] as const;
export type NativeMonetaryOperation = (typeof NATIVE_MONETARY_OPERATIONS)[number];

export type CanonicalAccountPosition = {
  readonly account: string;
  readonly assetId: NativeMonetaryAssetId;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
};

export type CanonicalSupplyBook = {
  readonly assetId: NativeMonetaryAssetId;
  readonly policyVersion: string;
  readonly genesisAllocated: bigint;
  readonly issuedPostGenesis: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
  readonly positions: readonly CanonicalAccountPosition[];
  readonly usedReplayIds: readonly string[];
};

export type CanonicalAccountNonce = {
  readonly account: string;
  readonly nonce: bigint;
};

export type CanonicalProtocolState = {
  readonly schemaVersion: typeof CANONICAL_STATE_SCHEMA_VERSION;
  readonly protocolVersion: number;
  readonly networkId: string;
  readonly chainId: string;
  readonly height: bigint;
  readonly finalizedBlockId: string | null;
  readonly policyState: MonetaryPolicyState;
  readonly supplies: readonly [CanonicalSupplyBook, CanonicalSupplyBook];
  readonly accountNonces: readonly CanonicalAccountNonce[];
  readonly executedTransactionIds: readonly string[];
  readonly executedIssuanceAuthorizationIds: readonly string[];
  readonly governanceAuthorizationRefs: readonly string[];
};

export type ValidatedNativeTransaction = {
  readonly transactionId: string;
  readonly account: string;
  readonly nonce: bigint;
  readonly operation: NativeMonetaryOperation;
  readonly assetId: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly counterparty?: string;
  readonly issuanceAuthority?: MonetaryIssuanceAuthority;
  readonly actor?: SupplyActor;
  readonly burnClass?: BurnClass;
  readonly replayIdentifier?: string;
  readonly authorizedSource?: 'VOLUNTARY_USER' | 'FEE_MARKET' | 'PROTOCOL_PENALTY';
  readonly network?: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
};

export type StateTransitionRejection =
  | 'REPLAY_TRANSACTION'
  | 'REPLAY_ISSUANCE'
  | 'INVALID_NONCE'
  | 'INVALID_OPERATION'
  | 'ASSET_MISMATCH'
  | 'SELF_TRANSFER'
  | 'INSUFFICIENT_BALANCE'
  | 'UNAUTHORIZED_ACTOR'
  | 'ISSUANCE_REJECTED'
  | 'BURN_REJECTED'
  | 'RECONCILIATION_FAILED'
  | 'WRONG_NETWORK'
  | 'WRONG_CHAIN'
  | 'NEGATIVE_QUANTITY'
  | 'MISSING_COUNTERPARTY'
  | 'MISSING_ISSUANCE_AUTHORITY'
  | 'MISSING_BURN_CLASS';

export type StateTransitionResult =
  | { readonly ok: true; readonly next: CanonicalProtocolState }
  | { readonly ok: false; readonly code: StateTransitionRejection; readonly detail?: string };

export type SupplyReconciliationFailure =
  | 'NEGATIVE_SUPPLY'
  | 'CIRCULATING_EXCEEDS_TOTAL'
  | 'POSITION_MISMATCH'
  | 'ASSET_CROSS_CONTAMINATION'
  | 'REPLAY_ID_COLLISION'
  | 'NONCE_REGRESSION';

export type SupplyReconciliationReport = {
  readonly ok: boolean;
  readonly failures: readonly SupplyReconciliationFailure[];
};
