import type { CustomerId } from '../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { LegalEntityId } from '../../../domain/src/legal-entity.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { EXEC08_RECORD_TRUTH } from './taxonomy.ts';
import type {
  AssetAvailabilityStateKind,
  BeneficialOwnerBindingStatus,
  ExternalAccountPermission,
  ExternalAccountRepresentationModel,
  ExternalAccountStatus,
} from './taxonomy.ts';
import type {
  BeneficialOwnerBindingId,
  ExternalCustodyAccountId,
  ExternalDigitalPositionId,
} from './ids.ts';

export type LegalOwnerReference = {
  readonly legalEntityId: LegalEntityId;
  readonly providerLegalOwnerRef: string;
  readonly registrationRef: string | null;
};

export type BeneficialOwnerBinding = {
  readonly bindingId: BeneficialOwnerBindingId;
  readonly externalAccountId: string;
  readonly beneficialCustomerId: CustomerId;
  readonly sunReyEconomicAccountRef: string;
  readonly representationModel: ExternalAccountRepresentationModel;
  readonly status: BeneficialOwnerBindingStatus;
  readonly effectiveFrom: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly providerBalanceIsLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
};

export type ExternalCustodyAccount = {
  readonly schema: 'sunrey.external-custody-account.v1';
  readonly accountId: ExternalCustodyAccountId;
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
};

export type AssetAvailabilityState = {
  readonly assetId: string;
  readonly byState: Readonly<Partial<Record<AssetAvailabilityStateKind, bigint>>>;
  readonly providerReportedTotal: bigint;
  readonly providerBalanceIsLedgerTruth: typeof EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth;
};

export type ExternalDigitalAssetPosition = {
  readonly positionId: ExternalDigitalPositionId;
  readonly custodyAccountId: ExternalCustodyAccountId;
  readonly provider: string;
  readonly assetId: string;
  readonly availability: AssetAvailabilityState;
  readonly asOf: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly simulation: true;
};

function assertExec08TruthInvariants(): void {
  if (EXEC08_RECORD_TRUTH.silentBalanceSynchronization) {
    throw new Error('EXEC08 forbids silent balance synchronization');
  }
}

export function freezeBeneficialOwnerBinding(row: BeneficialOwnerBinding): BeneficialOwnerBinding {
  assertExec08TruthInvariants();
  return Object.freeze({
    ...row,
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
    providerBalanceIsLedgerTruth: false,
  });
}

export function freezeExternalCustodyAccount(row: ExternalCustodyAccount): ExternalCustodyAccount {
  assertExec08TruthInvariants();
  if (row.legalSuitabilityClaimed !== false) {
    throw new Error('external custody account must not claim legal suitability');
  }
  return Object.freeze({
    ...row,
    beneficialOwnerBindings: Object.freeze(row.beneficialOwnerBindings.map((b) => freezeBeneficialOwnerBinding(b))),
    permissions: Object.freeze([...row.permissions]),
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
  });
}

export function freezeAssetAvailabilityState(row: AssetAvailabilityState): AssetAvailabilityState {
  assertExec08TruthInvariants();
  const byState = Object.freeze({ ...row.byState });
  return Object.freeze({
    ...row,
    byState,
    providerBalanceIsLedgerTruth: false,
  });
}

export function freezeExternalDigitalAssetPosition(row: ExternalDigitalAssetPosition): ExternalDigitalAssetPosition {
  assertExec08TruthInvariants();
  return Object.freeze({
    ...row,
    availability: freezeAssetAvailabilityState(row.availability),
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
  });
}

export function assetAvailabilityFromParts(
  assetId: string,
  parts: Readonly<Partial<Record<AssetAvailabilityStateKind, bigint>>>,
): AssetAvailabilityState {
  let total = 0n;
  for (const state of Object.keys(parts) as AssetAvailabilityStateKind[]) {
    const qty = parts[state];
    if (qty !== undefined) {
      total += qty;
    }
  }
  return freezeAssetAvailabilityState({
    assetId,
    byState: parts,
    providerReportedTotal: total,
    providerBalanceIsLedgerTruth: false,
  });
}
