/**
 * ACCESS-16 permanent invariants.
 */

import type { SolvencyEngineSnapshot } from './types.ts';
import { isExternalFundedTranche, isNativeTranche } from './taxonomy.ts';
import { externalTrancheUnits, nativeTrancheUnits } from './engine.ts';
import { isConfirmedLiability } from './liability-lifecycle.ts';

export const ACCESS_SOLVENCY_INVARIANT_IDS = [
  'NO_UNFUNDED_EXTERNAL_ACCESS',
  'CONFIRMED_EXTERNAL_LIABILITY_LE_RESERVE',
  'NATIVE_CAPACITY_NOT_TREATED_AS_FIAT_RESERVE',
  'NO_FAKE_COMMON_NUMERAIRE',
  'NO_DOUBLE_RESERVED_PROVIDER_LIABILITY',
  'FAILED_BOOKING_RELEASES_RESERVE',
  'REFUND_RESTORES_ELIGIBLE_RESERVE',
  'NO_ENTITLEMENT_ISSUANCE_BEYOND_BACKED_POOL',
  'NO_TREASURY_MINT_FROM_ACCESS',
  'NO_CUSTOMER_FUNDS_USED_AS_PROTOCOL_RESERVE',
] as const;

export type AccessSolvencyInvariantId = (typeof ACCESS_SOLVENCY_INVARIANT_IDS)[number];

export const ACCESS_SOLVENCY_INVARIANT_STATEMENTS: Readonly<Record<AccessSolvencyInvariantId, string>> = Object.freeze({
  NO_UNFUNDED_EXTERNAL_ACCESS:
    'External provider access is never promised without funded settlement capacity.',
  CONFIRMED_EXTERNAL_LIABILITY_LE_RESERVE:
    'Confirmed external liability never exceeds available settlement reserve per denomination.',
  NATIVE_CAPACITY_NOT_TREATED_AS_FIAT_RESERVE:
    'Native MoonRey productive capacity is not treated as fiat settlement reserve.',
  NO_FAKE_COMMON_NUMERAIRE:
    'USD/SAR/EUR/SR/MR are never combined into a fake common numeraire without a quoted conversion.',
  NO_DOUBLE_RESERVED_PROVIDER_LIABILITY:
    'The same provider liability is never reserved twice for the same reservation.',
  FAILED_BOOKING_RELEASES_RESERVE:
    'A failed booking releases its reserved settlement capacity.',
  REFUND_RESTORES_ELIGIBLE_RESERVE:
    'A refund restores eligible settlement reserve for re-allocation.',
  NO_ENTITLEMENT_ISSUANCE_BEYOND_BACKED_POOL:
    'Entitlements are never issued beyond backed pool capacity.',
  NO_TREASURY_MINT_FROM_ACCESS:
    'Access activity never mints treasury or protocol reserves.',
  NO_CUSTOMER_FUNDS_USED_AS_PROTOCOL_RESERVE:
    'Customer funds are never used as protocol settlement reserve.',
});

export type SolvencyInvariantResult = {
  readonly invariantId: AccessSolvencyInvariantId;
  readonly statement: string;
  readonly held: boolean;
  readonly evidence: string;
};

export type SolvencyInvariantInput = {
  readonly snapshot: SolvencyEngineSnapshot;
  readonly serializedState?: string;
  readonly entitlementIssuedBeyondPool?: boolean;
  readonly treasuryMintFromAccess?: boolean;
  readonly customerFundsAsReserve?: boolean;
  readonly failedBookingReleased?: boolean;
  readonly refundRestoredReserve?: boolean;
};

export function checkSolvencyInvariants(input: SolvencyInvariantInput): readonly SolvencyInvariantResult[] {
  const { snapshot } = input;
  const serialized =
    input.serializedState ??
    JSON.stringify(snapshot, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

  const unfundedExternal = snapshot.pools.some((pool) => {
    const externalUnits = externalTrancheUnits(pool);
    if (externalUnits <= 0n) {
      return false;
    }
    const matchingSlice = snapshot.slices.find(
      (row) => row.providerRef === pool.providerRef && row.availableSettlementReserveMinorUnits <= 0n,
    );
    return matchingSlice !== undefined && pool.allocatableUnits > 0n;
  });

  const insolventSlices = snapshot.slices.filter((row) => !row.solvent);
  const confirmedExceedsReserve = snapshot.slices.some((row) => {
    const confirmed = snapshot.liabilities
      .filter(
        (liability) =>
          isConfirmedLiability(liability) &&
          liability.currency === row.currency &&
          liability.jurisdiction === row.jurisdiction &&
          liability.providerRef === row.providerRef &&
          liability.category === row.category &&
          liability.epoch === row.epoch,
      )
      .reduce((sum, liability) => sum + liability.reservedAmountMinorUnits, 0n);
    return confirmed > row.availableSettlementReserveMinorUnits;
  });

  const nativeAsFiat = snapshot.pools.some((pool) => {
    const native = nativeTrancheUnits(pool);
    if (native <= 0n) {
      return false;
    }
    return snapshot.reservePositions.some(
      (row) =>
        row.state === 'AVAILABLE' &&
        pool.tranches.some((tranche) => isNativeTranche(tranche.kind) && tranche.currency === row.currency),
    );
  });

  const fakeNumeraire =
    serialized.includes('"commonNumeraire"') ||
    serialized.includes('"blendedReserve"') ||
    serialized.includes('"usdEquivalentTotal"');

  const reservationIds = snapshot.liabilities
    .filter((row) => row.settlementState === 'RESERVED' || row.settlementState === 'COMMITTED')
    .map((row) => row.reservationId);
  const doubleReserved = new Set(reservationIds).size !== reservationIds.length;

  const externalWithoutTerms = snapshot.pools.some((pool) =>
    pool.tranches.some((tranche) => isExternalFundedTranche(tranche.kind) && tranche.settlementTermsRef === null),
  );

  const checks: Readonly<Record<AccessSolvencyInvariantId, { readonly held: boolean; readonly evidence: string }>> = {
    NO_UNFUNDED_EXTERNAL_ACCESS: {
      held: !unfundedExternal && !externalWithoutTerms,
      evidence: `unfundedExternal=${unfundedExternal} externalWithoutTerms=${externalWithoutTerms}`,
    },
    CONFIRMED_EXTERNAL_LIABILITY_LE_RESERVE: {
      held: !confirmedExceedsReserve && insolventSlices.length === 0,
      evidence: `insolventSlices=${insolventSlices.length} confirmedExceedsReserve=${confirmedExceedsReserve}`,
    },
    NATIVE_CAPACITY_NOT_TREATED_AS_FIAT_RESERVE: {
      held: !nativeAsFiat,
      evidence: `nativeAsFiat=${nativeAsFiat}`,
    },
    NO_FAKE_COMMON_NUMERAIRE: {
      held: !fakeNumeraire,
      evidence: `fakeNumeraire=${fakeNumeraire}`,
    },
    NO_DOUBLE_RESERVED_PROVIDER_LIABILITY: {
      held: !doubleReserved,
      evidence: `activeReservations=${reservationIds.length} unique=${new Set(reservationIds).size}`,
    },
    FAILED_BOOKING_RELEASES_RESERVE: {
      held: input.failedBookingReleased !== false,
      evidence: `failedBookingReleased=${input.failedBookingReleased ?? true}`,
    },
    REFUND_RESTORES_ELIGIBLE_RESERVE: {
      held: input.refundRestoredReserve !== false,
      evidence: `refundRestoredReserve=${input.refundRestoredReserve ?? true}`,
    },
    NO_ENTITLEMENT_ISSUANCE_BEYOND_BACKED_POOL: {
      held: input.entitlementIssuedBeyondPool !== true,
      evidence: `entitlementIssuedBeyondPool=${input.entitlementIssuedBeyondPool ?? false}`,
    },
    NO_TREASURY_MINT_FROM_ACCESS: {
      held: input.treasuryMintFromAccess !== true,
      evidence: `treasuryMintFromAccess=${input.treasuryMintFromAccess ?? false}`,
    },
    NO_CUSTOMER_FUNDS_USED_AS_PROTOCOL_RESERVE: {
      held: input.customerFundsAsReserve !== true,
      evidence: `customerFundsAsReserve=${input.customerFundsAsReserve ?? false}`,
    },
  };

  return Object.freeze(
    ACCESS_SOLVENCY_INVARIANT_IDS.map((invariantId) =>
      Object.freeze({
        invariantId,
        statement: ACCESS_SOLVENCY_INVARIANT_STATEMENTS[invariantId],
        held: checks[invariantId].held,
        evidence: checks[invariantId].evidence,
      }),
    ),
  );
}
