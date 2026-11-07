import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  EXEC08_RECORD_TRUTH,
  type Exec08ReconciliationId,
  type AssetAvailabilityState,
} from '../../../custody/src/execution-connectivity/index.ts';

export type Exec08BrokerBreakKind =
  | 'BROKER_LEDGER_CASH_MISMATCH'
  | 'BROKER_LEDGER_SECURITY_MISMATCH'
  | 'BENEFICIAL_OWNER_UNMAPPED';

export type Exec08BrokerReconciliationBreak = {
  readonly kind: Exec08BrokerBreakKind;
  readonly instrumentOrCurrency: string;
  readonly providerObservedMinorUnits: string;
  readonly sunReyLedgerMinorUnits: string;
  readonly autoSynchronized: false;
  readonly notes: readonly string[];
};

export type Exec08BrokerReconciliationReport = {
  readonly schema: 'sunrey.exec08-broker-reconciliation.v1';
  readonly reconciliationId: Exec08ReconciliationId;
  readonly matched: boolean;
  readonly breaks: readonly Exec08BrokerReconciliationBreak[];
  readonly providerBalanceIsSunReyLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
  readonly sunReyLedgerIsProviderCustodyTruth: typeof EXEC08_RECORD_TRUTH.sunReyLedgerIsProviderCustodyTruth;
  readonly silentBalanceSynchronization: typeof EXEC08_RECORD_TRUTH.silentBalanceSynchronization;
  readonly asOf: UtcInstant;
  readonly simulation: true;
};

function breakOf(input: {
  readonly kind: Exec08BrokerBreakKind;
  readonly instrumentOrCurrency: string;
  readonly provider: bigint;
  readonly ledger: bigint;
  readonly notes: readonly string[];
}): Exec08BrokerReconciliationBreak {
  return Object.freeze({
    kind: input.kind,
    instrumentOrCurrency: input.instrumentOrCurrency,
    providerObservedMinorUnits: input.provider.toString(),
    sunReyLedgerMinorUnits: input.ledger.toString(),
    autoSynchronized: false,
    notes: Object.freeze([...input.notes]),
  });
}

export function reconcileBrokerProviderToLedger(input: {
  readonly reconciliationId: Exec08ReconciliationId;
  readonly asOf: UtcInstant;
  readonly cashScopes: readonly {
    readonly currency: string;
    readonly providerAvailability: AssetAvailabilityState;
    readonly sunReyLedgerCashMinorUnits: bigint;
    readonly beneficialOwnerMapped: boolean;
  }[];
  readonly securityScopes: readonly {
    readonly instrumentId: string;
    readonly providerAvailability: AssetAvailabilityState;
    readonly sunReyLedgerQuantityMinorUnits: bigint;
    readonly beneficialOwnerMapped: boolean;
  }[];
}): Exec08BrokerReconciliationReport {
  const breaks: Exec08BrokerReconciliationBreak[] = [];
  for (const scope of input.cashScopes) {
    if (!scope.beneficialOwnerMapped) {
      breaks.push(
        breakOf({
          kind: 'BENEFICIAL_OWNER_UNMAPPED',
          instrumentOrCurrency: scope.currency,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: scope.sunReyLedgerCashMinorUnits,
          notes: ['beneficial owner mapping missing for external broker cash'],
        }),
      );
    }
    if (scope.providerAvailability.providerReportedTotal !== scope.sunReyLedgerCashMinorUnits) {
      breaks.push(
        breakOf({
          kind: 'BROKER_LEDGER_CASH_MISMATCH',
          instrumentOrCurrency: scope.currency,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: scope.sunReyLedgerCashMinorUnits,
          notes: ['broker cash is independent of SunRey ledger; mismatch requires investigation'],
        }),
      );
    }
  }
  for (const scope of input.securityScopes) {
    if (!scope.beneficialOwnerMapped) {
      breaks.push(
        breakOf({
          kind: 'BENEFICIAL_OWNER_UNMAPPED',
          instrumentOrCurrency: scope.instrumentId,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: scope.sunReyLedgerQuantityMinorUnits,
          notes: ['beneficial owner mapping missing for external broker security position'],
        }),
      );
    }
    if (scope.providerAvailability.providerReportedTotal !== scope.sunReyLedgerQuantityMinorUnits) {
      breaks.push(
        breakOf({
          kind: 'BROKER_LEDGER_SECURITY_MISMATCH',
          instrumentOrCurrency: scope.instrumentId,
          provider: scope.providerAvailability.providerReportedTotal,
          ledger: scope.sunReyLedgerQuantityMinorUnits,
          notes: ['broker position is independent of SunRey ledger; mismatch requires investigation'],
        }),
      );
    }
  }
  return Object.freeze({
    schema: 'sunrey.exec08-broker-reconciliation.v1',
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
