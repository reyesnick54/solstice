/**
 * ACCESS-19 permanent bridge invariants.
 *
 * Additive only: later chunks may add invariants, never remove or loosen.
 */

import {
  PRODUCTIVE_ACCESS_BRIDGE_INVARIANT_IDS,
  type ProductiveAccessBridgeInvariantId,
} from './ids.ts';
import type {
  AccessCapacityCommitment,
  AccessCapacityPoolLedger,
  AccessDeliveryEvidence,
  MoonReyIssuanceObservation,
  ProductiveAccessInvariantResult,
  ProviderSettlementRecord,
  VerifiedAvailableCapacity,
} from './types.ts';

export const PRODUCTIVE_ACCESS_INVARIANT_STATEMENTS: Readonly<
  Record<ProductiveAccessBridgeInvariantId, string>
> = Object.freeze({
  NO_PRODUCTIVE_CAPACITY_DOUBLE_COUNT:
    'The same verified productive capacity is never committed beyond its verified available quantity.',
  NO_ACCESS_USAGE_MINTS_MOONREY: 'Access consumption never issues MoonRey.',
  NO_PROVIDER_SETTLEMENT_EQUALS_MOONREY_ISSUANCE:
    'Provider settlement for Access delivery is never silently equated to MoonRey productive issuance.',
  CAPACITY_COMMITMENT_LE_VERIFIED_AVAILABLE_CAPACITY:
    'Every active commitment quantity is less than or equal to verified available capacity.',
  NO_OUTPUT_DELIVERY_DOUBLE_ISSUANCE:
    'Output and delivery lineage for the same economic event cannot both earn full productive issuance.',
  NO_PHANTOM_PRODUCTIVE_CAPACITY:
    'No commitment exists without a verified productive capacity source.',
  NO_ORACLE_FACT_ALONE_MINTS: 'An oracle fact alone cannot authorize MoonRey issuance or capacity commitment.',
  ONLY_CANONICAL_MR_BALANCE_AFFECTS_MR_TWAB:
    'Only canonical MoonRey balances from governed issuance affect MR time-weighted averages.',
});

export type ProductiveAccessInvariantInput = {
  readonly verifiedCapacities: readonly VerifiedAvailableCapacity[];
  readonly commitments: readonly AccessCapacityCommitment[];
  readonly poolLedgers: readonly AccessCapacityPoolLedger[];
  readonly deliveries: readonly AccessDeliveryEvidence[];
  readonly settlements: readonly ProviderSettlementRecord[];
  readonly moonreyIssuances: readonly MoonReyIssuanceObservation[];
  readonly moonreyIssuedByAccess: bigint;
  readonly outputDeliveryFingerprints: ReadonlyMap<string, readonly string[]>;
};

function availableUnits(capacity: VerifiedAvailableCapacity): bigint {
  return capacity.verifiedQuantity - capacity.alreadyCommittedQuantity;
}

export function checkProductiveAccessInvariants(
  input: ProductiveAccessInvariantInput,
): readonly ProductiveAccessInvariantResult[] {
  const committedByCapacity = new Map<string, bigint>();
  for (const commitment of input.commitments) {
    if (commitment.status === 'REVOKED' || commitment.status === 'CANCELLED') {
      continue;
    }
    const key = commitment.productiveObjectRef;
    committedByCapacity.set(key, (committedByCapacity.get(key) ?? 0n) + commitment.quantity);
  }

  const overCommitted = input.verifiedCapacities.filter((capacity) => {
    const committed = committedByCapacity.get(capacity.productiveObjectRef) ?? 0n;
    return committed > availableUnits(capacity);
  });

  const phantomCommitments = input.commitments.filter((commitment) => {
    if (commitment.status === 'REVOKED' || commitment.status === 'CANCELLED') {
      return false;
    }
    return !input.verifiedCapacities.some(
      (capacity) => capacity.productiveObjectRef === commitment.productiveObjectRef,
    );
  });

  const oracleOnlyCommitments = input.commitments.filter(
    (commitment) =>
      commitment.oracleRefs.length > 0 &&
      commitment.evidenceRefs.length === 0 &&
      commitment.verifiedContributionRef === null,
  );

  const issuanceFingerprints = new Set(input.moonreyIssuances.map((row) => row.contributionFingerprint));
  const duplicateIssuance = issuanceFingerprints.size !== input.moonreyIssuances.length;

  const settlementEqualsIssuance = input.settlements.filter((settlement) => {
    return settlement.moonreyIssuanceRef !== null;
  });

  const outputDeliveryDouble = [...input.outputDeliveryFingerprints.entries()].filter(([, fingerprints]) => {
    const issued = fingerprints.filter((fp) => issuanceFingerprints.has(fp));
    return issued.length > 1;
  });

  const poolOversold = input.poolLedgers.filter(
    (ledger) => ledger.consumedUnits + ledger.reservedUnits > ledger.publishedUnits,
  );

  const checks: Readonly<Record<ProductiveAccessBridgeInvariantId, { readonly held: boolean; readonly evidence: string }>> =
    {
      NO_PRODUCTIVE_CAPACITY_DOUBLE_COUNT: {
        held: overCommitted.length === 0 && poolOversold.length === 0,
        evidence: `overCommitted=${overCommitted.length} poolOversold=${poolOversold.length}`,
      },
      NO_ACCESS_USAGE_MINTS_MOONREY: {
        held: input.moonreyIssuedByAccess === 0n,
        evidence: `moonreyIssuedByAccess=${input.moonreyIssuedByAccess}`,
      },
      NO_PROVIDER_SETTLEMENT_EQUALS_MOONREY_ISSUANCE: {
        held: settlementEqualsIssuance.length === 0,
        evidence: `settlementWithIssuanceRef=${settlementEqualsIssuance.length}`,
      },
      CAPACITY_COMMITMENT_LE_VERIFIED_AVAILABLE_CAPACITY: {
        held: overCommitted.length === 0,
        evidence: `overCommittedObjects=${overCommitted.length}`,
      },
      NO_OUTPUT_DELIVERY_DOUBLE_ISSUANCE: {
        held: outputDeliveryDouble.length === 0 && !duplicateIssuance,
        evidence: `outputDeliveryPairs=${outputDeliveryDouble.length} duplicateIssuance=${duplicateIssuance}`,
      },
      NO_PHANTOM_PRODUCTIVE_CAPACITY: {
        held: phantomCommitments.length === 0,
        evidence: `phantomCommitments=${phantomCommitments.length}`,
      },
      NO_ORACLE_FACT_ALONE_MINTS: {
        held: oracleOnlyCommitments.length === 0,
        evidence: `oracleOnlyCommitments=${oracleOnlyCommitments.length}`,
      },
      ONLY_CANONICAL_MR_BALANCE_AFFECTS_MR_TWAB: {
        held: input.moonreyIssuances.every((row) => row.triggeredByAccess === false),
        evidence: `issuanceCount=${input.moonreyIssuances.length}`,
      },
    };

  return Object.freeze(
    PRODUCTIVE_ACCESS_BRIDGE_INVARIANT_IDS.map((invariant) =>
      Object.freeze({
        invariant,
        statement: PRODUCTIVE_ACCESS_INVARIANT_STATEMENTS[invariant],
        held: checks[invariant].held,
        evidence: checks[invariant].evidence,
      }),
    ),
  );
}
