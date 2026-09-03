/**
 * ACCESS-16 — Access Capacity Reserve and Solvency types.
 *
 * Money is integer minor units. Reserve state is reference/aggregation only;
 * authoritative balances remain on the canonical Ledger, Treasury, Custody,
 * Payments, and Exchange owners.
 */

import type {
  CapacityTrancheKind,
  ConsumerAvailabilityPosture,
  ReservePositionState,
  RiskHaircutKind,
  SettlementLiabilityState,
} from './taxonomy.ts';

export type { SettlementLiabilityState } from './taxonomy.ts';

export type ProviderRef = string;
export type ReservationRef = string;
export type JurisdictionRef = string;
export type EpochRef = string;
export type EvidenceRef = string;
export type PolicyVersionRef = string;

/** One backing tranche for an AccessCapacityPool. */
export type AccessCapacityTranche = {
  readonly trancheId: string;
  readonly poolId: string;
  readonly kind: CapacityTrancheKind;
  readonly providerRef: ProviderRef | null;
  readonly currency: string;
  readonly allocatableUnits: bigint;
  readonly settlementTermsRef: string | null;
  readonly fundingReserveRef: string | null;
  readonly providerAgreementRef: string | null;
  readonly deliveryEvidenceRef: string | null;
  readonly expiresAt: string;
  readonly evidenceRefs: readonly EvidenceRef[];
};

/** Extended pool with explicit tranche backing. */
export type AccessCapacityPoolWithTranches = {
  readonly poolId: string;
  readonly category: string;
  readonly jurisdiction: JurisdictionRef;
  readonly providerRef: ProviderRef | null;
  readonly tranches: readonly AccessCapacityTranche[];
  readonly publishedUnits: bigint;
  readonly allocatableUnits: bigint;
};

/** External provider settlement obligation. */
export type ProviderSettlementLiability = {
  readonly liabilityId: string;
  readonly providerRef: ProviderRef;
  readonly reservationId: ReservationRef;
  readonly currency: string;
  readonly quotedAmountMinorUnits: bigint;
  readonly reservedAmountMinorUnits: bigint;
  readonly maximumExposureMinorUnits: bigint;
  readonly jurisdiction: JurisdictionRef;
  readonly category: string;
  readonly epoch: EpochRef;
  readonly expiration: string;
  readonly settlementState: SettlementLiabilityState;
  readonly evidenceRefs: readonly EvidenceRef[];
};

/** Reference reserve position — not an authoritative balance. */
export type SettlementReservePosition = {
  readonly positionId: string;
  readonly currency: string;
  readonly jurisdiction: JurisdictionRef;
  readonly providerRef: ProviderRef | null;
  readonly category: string | null;
  readonly epoch: EpochRef;
  readonly state: ReservePositionState;
  readonly amountMinorUnits: bigint;
  readonly canonicalOwnerRef:
    | 'packages/ledger'
    | 'packages/treasury'
    | 'packages/custody'
    | 'packages/payments'
    | 'packages/sunrey-exchange';
  readonly evidenceRef: EvidenceRef;
};

/** Solvency slice for one denomination d at a given dimension tuple. */
export type SolvencySlice = {
  readonly currency: string;
  readonly jurisdiction: JurisdictionRef;
  readonly providerRef: ProviderRef | null;
  readonly category: string | null;
  readonly epoch: EpochRef;
  readonly availableSettlementReserveMinorUnits: bigint;
  readonly committedExternalLiabilityMinorUnits: bigint;
  readonly solvencyRatioBps: bigint | null;
  readonly targetSolvencyRatioBps: bigint | null;
  readonly solvent: boolean;
};

/** Versioned simulation-only risk haircut policy. */
export type RiskHaircutPolicy = {
  readonly policyVersion: PolicyVersionRef;
  readonly kind: RiskHaircutKind;
  readonly haircutBps: bigint;
  readonly simulationOnly: true;
};

export type EffectiveCapacityInput = {
  readonly fundedCapacityMinorUnits: bigint;
  readonly haircuts: readonly RiskHaircutPolicy[];
};

export type EffectiveCapacityResult = {
  readonly grossCapacityMinorUnits: bigint;
  readonly effectiveAllocatableMinorUnits: bigint;
  readonly appliedHaircuts: readonly { readonly kind: RiskHaircutKind; readonly haircutBps: bigint }[];
};

export type PoolAdmissionInput = {
  readonly tranche: AccessCapacityTranche;
  readonly poolId: string;
  readonly providerCapabilityPermitsBooking: boolean;
  readonly jurisdictionPermitted: boolean;
  readonly reserveAvailable: boolean;
  readonly settlementTermsPresent: boolean;
  readonly evidenceCurrent: boolean;
  readonly now: string;
};

export type PoolAdmissionResult = {
  readonly admitted: boolean;
  readonly refusalCode: string | null;
  readonly refusalMessage: string | null;
};

export type ConsumerAvailabilityInput = {
  readonly poolSolvent: boolean;
  readonly allocatableUnits: bigint;
  readonly publishedUnits: bigint;
  readonly providerAvailable: boolean;
};

export type ConsumerAvailabilityView = {
  readonly posture: ConsumerAvailabilityPosture;
  readonly message: string;
};

export type SolvencyEngineSnapshot = {
  readonly slices: readonly SolvencySlice[];
  readonly liabilities: readonly ProviderSettlementLiability[];
  readonly reservePositions: readonly SettlementReservePosition[];
  readonly pools: readonly AccessCapacityPoolWithTranches[];
};
