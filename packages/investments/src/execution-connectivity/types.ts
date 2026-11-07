import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  EXEC08_RECORD_TRUTH,
  type AssetAvailabilityState,
  type BeneficialOwnerBinding,
  type ExternalAccountPermission,
  type ExternalAccountRepresentationModel,
  type ExternalAccountStatus,
  assetAvailabilityFromParts,
  freezeAssetAvailabilityState,
  freezeBeneficialOwnerBinding,
  type LegalOwnerReference,
} from '../../../custody/src/execution-connectivity/index.ts';
import type { InstrumentId } from '../ids.ts';
import { Money } from '../../../money/src/money.ts';
import type {
  ExternalBrokerAccountId,
  ExternalCashPositionId,
  ExternalSecurityPositionId,
} from './ids.ts';
import type { AssetAvailabilityStateKind } from '../../../custody/src/execution-connectivity/taxonomy.ts';

export type ExternalBrokerAccount = {
  readonly schema: 'sunrey.external-broker-account.v1';
  readonly accountId: ExternalBrokerAccountId;
  readonly provider: string;
  readonly providerAccountRef: string;
  readonly representationModel: ExternalAccountRepresentationModel;
  readonly legalOwner: LegalOwnerReference;
  readonly beneficialOwnerBindings: readonly BeneficialOwnerBinding[];
  readonly currency: string;
  readonly jurisdiction: Jurisdiction;
  readonly status: ExternalAccountStatus;
  readonly permissions: readonly ExternalAccountPermission[];
  readonly evidenceRefs: readonly string[];
  readonly updatedAt: UtcInstant;
  readonly simulation: true;
  readonly legalSuitabilityClaimed: false;
  readonly providerBalanceIsLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
};

export type ExternalCashPosition = {
  readonly positionId: ExternalCashPositionId;
  readonly brokerAccountId: ExternalBrokerAccountId;
  readonly provider: string;
  readonly currency: string;
  readonly availability: AssetAvailabilityState;
  readonly ledgerCashMinorUnits: bigint;
  readonly asOf: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly providerBalanceIsLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
  readonly simulation: true;
};

export type ExternalSecurityPosition = {
  readonly positionId: ExternalSecurityPositionId;
  readonly brokerAccountId: ExternalBrokerAccountId;
  readonly provider: string;
  readonly instrumentId: InstrumentId;
  readonly availability: AssetAvailabilityState;
  readonly ledgerQuantityMinorUnits: bigint;
  readonly asOf: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly providerBalanceIsLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
  readonly simulation: true;
};

export { assetAvailabilityFromParts, freezeAssetAvailabilityState };
export type { AssetAvailabilityState, BeneficialOwnerBinding };

function assertNoSilentSync(): void {
  if (EXEC08_RECORD_TRUTH.silentBalanceSynchronization) {
    throw new Error('EXEC08 forbids silent balance synchronization');
  }
}

export function freezeExternalBrokerAccount(row: ExternalBrokerAccount): ExternalBrokerAccount {
  assertNoSilentSync();
  if (row.legalSuitabilityClaimed !== false) {
    throw new Error('external broker account must not claim legal suitability');
  }
  return Object.freeze({
    ...row,
    beneficialOwnerBindings: Object.freeze(row.beneficialOwnerBindings.map((b) => freezeBeneficialOwnerBinding(b))),
    permissions: Object.freeze([...row.permissions]),
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
    providerBalanceIsLedgerTruth: false,
  });
}

export function freezeExternalCashPosition(row: ExternalCashPosition): ExternalCashPosition {
  assertNoSilentSync();
  return Object.freeze({
    ...row,
    availability: freezeAssetAvailabilityState(row.availability),
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
    providerBalanceIsLedgerTruth: false,
  });
}

export function freezeExternalSecurityPosition(row: ExternalSecurityPosition): ExternalSecurityPosition {
  assertNoSilentSync();
  return Object.freeze({
    ...row,
    availability: freezeAssetAvailabilityState(row.availability),
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
    providerBalanceIsLedgerTruth: false,
  });
}

export function cashAvailabilityMinorUnits(
  currency: string,
  parts: Readonly<Partial<Record<AssetAvailabilityStateKind, Money>>>,
): AssetAvailabilityState {
  const minorParts: Partial<Record<AssetAvailabilityStateKind, bigint>> = {};
  for (const [state, money] of Object.entries(parts) as [AssetAvailabilityStateKind, Money][]) {
    if (money !== undefined) {
      if (money.currency !== currency) {
        throw new Error(`cash availability currency mismatch: ${money.currency} vs ${currency}`);
      }
      minorParts[state] = money.minorUnits;
    }
  }
  return assetAvailabilityFromParts(currency, minorParts);
}
