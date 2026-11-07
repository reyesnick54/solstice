/**
 * HELIOS ALT10 — point-in-time government procurement observation types.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  ProcurementArtifactKind,
  ProcurementContractType,
  ProcurementCounterpartyRole,
  PROCUREMENT_OBSERVATION_SCHEMA,
  ProcurementModificationKind,
  ProcurementProviderKind,
  ProcurementValueKind,
} from './taxonomy.ts';

export type ProcurementMonetaryAmount = {
  readonly kind: ProcurementValueKind;
  readonly currency: string;
  readonly amountMinor: bigint;
};

export type ProcurementObservationProvenance = {
  readonly providerId: string;
  readonly providerKind: ProcurementProviderKind;
  readonly sourceId: string;
  readonly feedId: string;
  readonly evidenceRef: string;
  readonly rawPayloadHash: string;
  readonly dedupeKey: string;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type ProcurementEntityBinding = {
  readonly bindingId: string;
  readonly sourceLegalName: string;
  readonly canonicalEntityId: string;
  readonly role: ProcurementCounterpartyRole;
  readonly parentCanonicalEntityId: string | null;
  readonly jointVenturePartnerIds: readonly string[];
};

/**
 * Attribution target for award/obligated economics. For joint ventures this stays
 * on the JV entity; parent company is informational only.
 */
export type ProcurementAttributionBinding = {
  readonly attributionEntityId: string;
  readonly counterpartyBinding: ProcurementEntityBinding;
  readonly rollsUpToParent: false;
};

export type GovernmentCustomer = {
  readonly customerId: string;
  readonly agencyCode: string;
  readonly agencyName: string;
  readonly program: string | null;
  readonly countryCode: string;
};

export type ContractVehicle = {
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly contractType: ProcurementContractType;
  readonly parentVehicleId: string | null;
  readonly governmentCustomerId: string;
};

export type ProcurementAward = {
  readonly awardId: string;
  readonly contractPiid: string;
  readonly title: string;
  readonly awardDate: string;
  readonly periodOfPerformanceStart: string | null;
  readonly periodOfPerformanceEnd: string | null;
  readonly contractDurationDays: number | null;
  readonly optionPeriods: readonly string[];
  readonly awardCeiling: ProcurementMonetaryAmount;
  readonly governmentCustomerId: string;
  readonly agency: string;
  readonly program: string | null;
  readonly contractType: ProcurementContractType;
  readonly contractVehicleId: string | null;
  readonly attribution: ProcurementAttributionBinding;
  readonly cancelled: boolean;
};

export type ProcurementModification = {
  readonly modificationId: string;
  readonly awardId: string;
  readonly modificationNumber: string;
  readonly modificationKind: ProcurementModificationKind;
  readonly effectiveDate: string;
  readonly deltaCeilingMinor: bigint | null;
  readonly deltaObligationMinor: bigint | null;
  readonly cancellation: boolean;
  readonly description: string;
};

export type ProcurementObligation = {
  readonly obligationId: string;
  readonly awardId: string;
  readonly obligationDate: string;
  readonly obligatedValue: ProcurementMonetaryAmount;
  readonly paidValue: ProcurementMonetaryAmount | null;
};

export type ProcurementBacklogEstimate = {
  readonly backlogId: string;
  readonly attributionEntityId: string;
  readonly asOfDate: string;
  readonly remainingCeilingMinor: bigint;
  readonly remainingObligationMinor: bigint;
  readonly currency: string;
};

export type ProcurementExternalObservation = {
  readonly schema: typeof PROCUREMENT_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly artifactKind: ProcurementArtifactKind;
  readonly provenance: ProcurementObservationProvenance;
  readonly attributionEntityId: string;
  readonly award: ProcurementAward | null;
  readonly modification: ProcurementModification | null;
  readonly obligation: ProcurementObligation | null;
  readonly contractVehicle: ContractVehicle | null;
  readonly governmentCustomer: GovernmentCustomer | null;
  readonly backlogEstimate: ProcurementBacklogEstimate | null;
  readonly supersedesObservationId: string | null;
  readonly lineageRootId: string;
  readonly grantsExecutionAuthority: false;
};

export type IngestProcurementObservationInput = Omit<
  ProcurementExternalObservation,
  'schema' | 'grantsExecutionAuthority'
>;

export type IngestProcurementObservationResult =
  | { readonly ok: true; readonly observation: ProcurementExternalObservation; readonly deduplicated: boolean }
  | { readonly ok: false; readonly reason: string };
