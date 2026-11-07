import type { UtcInstant } from '../../../domain/src/time.ts';
import { EXEC08_RECORD_TRUTH } from './taxonomy.ts';
import type { AssetAvailabilityState } from './types.ts';
import type { Exec08ReconciliationId } from './ids.ts';

export type Exec08CustodyBreakKind =
  | 'PROVIDER_LEDGER_CASH_MISMATCH'
  | 'PROVIDER_LEDGER_POSITION_MISMATCH'
  | 'BENEFICIAL_OWNER_UNMAPPED'
  | 'AVAILABILITY_BUCKET_MISMATCH';

export type Exec08CustodyReconciliationBreak = {
  readonly kind: Exec08CustodyBreakKind;
  readonly assetId: string;
  readonly providerObservedMinorUnits: string;
  readonly sunReyLedgerMinorUnits: string;
  readonly autoSynchronized: false;
  readonly notes: readonly string[];
};

export type Exec08CustodyReconciliationReport = {
  readonly schema: 'sunrey.exec08-custody-reconciliation.v1';
  readonly reconciliationId: Exec08ReconciliationId;
  readonly matched: boolean;
  readonly breaks: readonly Exec08CustodyReconciliationBreak[];
  readonly providerBalanceIsSunReyLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
  readonly sunReyLedgerIsProviderCustodyTruth: typeof EXEC08_RECORD_TRUTH.sunReyLedgerIsProviderCustodyTruth;
  readonly silentBalanceSynchronization: typeof EXEC08_RECORD_TRUTH.silentBalanceSynchronization;
  readonly asOf: UtcInstant;
  readonly simulation: true;
};

function breakOf(input: {
  readonly kind: Exec08CustodyBreakKind;
  readonly assetId: string;
  readonly provider: bigint;
  readonly ledger: bigint;
  readonly notes: readonly string[];
}): Exec08CustodyReconciliationBreak {
  return Object.freeze({
    kind: input.kind,
    assetId: input.assetId,
    providerObservedMinorUnits: input.provider.toString(),
    sunReyLedgerMinorUnits: input.ledger.toString(),
    autoSynchronized: false,
    notes: Object.freeze([...input.notes]),
  });
}

export function reconcileCustodyProviderToLedger(input: {
  readonly reconciliationId: Exec08ReconciliationId;
  readonly asOf: UtcInstant;
  readonly scopes: readonly {
    readonly assetId: string;
    readonly providerAvailability: AssetAvailabilityState;
    readonly sunReyLedgerMinorUnits: bigint;
    readonly beneficialOwnerMapped: boolean;
  }[];
}): Exec08CustodyReconciliationReport {
  const breaks: Exec08CustodyReconciliationBreak[] = [];
  for (const scope of input.scopes) {
    if (!scope.beneficialOwnerMapped) {
      breaks.push(
        breakOf({
          kind: 'BENEFICIAL_OWNER_UNMAPPED',
          assetId: scope.assetId,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: scope.sunReyLedgerMinorUnits,
          notes: ['beneficial owner mapping missing for external custody account'],
        }),
      );
    }
    if (scope.providerAvailability.providerReportedTotal !== scope.sunReyLedgerMinorUnits) {
      breaks.push(
        breakOf({
          kind: 'PROVIDER_LEDGER_POSITION_MISMATCH',
          assetId: scope.assetId,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: scope.sunReyLedgerMinorUnits,
          notes: [
            'provider custody quantity is independent of SunRey ledger; mismatch requires investigation',
          ],
        }),
      );
    }
    let bucketSum = 0n;
    for (const qty of Object.values(scope.providerAvailability.byState)) {
      if (qty !== undefined) {
        bucketSum += qty;
      }
    }
    if (bucketSum !== scope.providerAvailability.providerReportedTotal) {
      breaks.push(
        breakOf({
          kind: 'AVAILABILITY_BUCKET_MISMATCH',
          assetId: scope.assetId,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: bucketSum,
          notes: ['availability buckets do not sum to provider reported total'],
        }),
      );
    }
  }
  return Object.freeze({
    schema: 'sunrey.exec08-custody-reconciliation.v1',
    reconciliationId: input.reconciliationId,
    matched: breaks.length === 0,
    breaks: Object.freeze(breaks),
    providerBalanceIsSunReyLedgerTruth: false,
    sunReyLedgerIsProviderCustodyTruth: false,
    silentBalanceSynchronization: false,
    asOf: input.asOf,
    simulation: true,
  });
}
