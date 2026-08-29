import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { asInstrumentId, type InstrumentId } from '../ids.ts';
import type { CapacityCategory, ComputeServiceClass, MarketFamily } from '../taxonomy.ts';
import type { DeliveryWindow, ExchangeInstrument, OraclePolicy } from '../types-universal.ts';
import type {
  AccessDeliveryRequirements,
  AccessGeography,
  AccessPolicyRequirements,
  AccessProvenance,
  AccessRightsTerms,
  AccessServiceClass,
  CapacityAccessTerms,
  ProductiveObjectReference,
  TermsCompleteness,
} from './types.ts';
import type { AccessSettlementSemantics, ConsiderationKind } from './taxonomy.ts';

const DEFAULT_ORACLE_POLICY: OraclePolicy = Object.freeze({
  required: true,
  factTypes: [],
  conflict: 'BLOCK_ON_CONFLICT',
  stale: 'BLOCK_ON_STALE',
  maxProviderShareBps: 8_000n,
});

/**
 * Build a complete capacity access term sheet. Every ACCESS-09 attribute is a
 * required argument: an Exchange capacity order cannot be created with a
 * partially specified target, window, geography, service class, rights terms,
 * policy requirements, jurisdiction, provenance, or delivery requirements.
 */
export function capacityAccessTerms(input: {
  readonly termsId: string;
  readonly family: MarketFamily;
  readonly instrumentId: string;
  readonly productiveObject: ProductiveObjectReference;
  readonly quantity: bigint;
  readonly unit: string;
  readonly availabilityWindow: DeliveryWindow;
  readonly geography: AccessGeography;
  readonly serviceClass: AccessServiceClass;
  readonly rightsTerms: AccessRightsTerms;
  readonly policyRequirements: AccessPolicyRequirements;
  readonly jurisdiction: Jurisdiction;
  readonly provenance: AccessProvenance;
  readonly deliveryRequirements: AccessDeliveryRequirements;
  readonly permittedConsideration: readonly ConsiderationKind[];
}): CapacityAccessTerms {
  if (typeof input.quantity !== 'bigint') {
    throw new TypeError('capacity quantity must be bigint scaled units');
  }
  if (input.quantity <= 0n) {
    throw new TypeError('capacity quantity must be positive');
  }
  if (input.unit !== input.productiveObject.canonicalUnit) {
    throw new TypeError(
      `capacity unit ${input.unit} must equal the canonical productive unit ${input.productiveObject.canonicalUnit}`,
    );
  }
  return Object.freeze({
    termsId: input.termsId,
    family: input.family,
    instrumentId: asInstrumentId(input.instrumentId),
    productiveObject: Object.freeze({ ...input.productiveObject }),
    quantity: input.quantity,
    unit: input.unit,
    availabilityWindow: Object.freeze({ ...input.availabilityWindow }),
    geography: Object.freeze({ ...input.geography }),
    serviceClass: Object.freeze({ ...input.serviceClass }),
    rightsTerms: Object.freeze({
      ...input.rightsTerms,
      permittedPurposes: Object.freeze([...input.rightsTerms.permittedPurposes]),
    }),
    policyRequirements: Object.freeze({
      ...input.policyRequirements,
      requiredCapabilities: Object.freeze([...input.policyRequirements.requiredCapabilities]),
      permittedJurisdictions: Object.freeze([...input.policyRequirements.permittedJurisdictions]),
      deniedJurisdictions: Object.freeze([...input.policyRequirements.deniedJurisdictions]),
    }),
    jurisdiction: input.jurisdiction,
    provenance: Object.freeze({
      ...input.provenance,
      attestationRefs: Object.freeze([...input.provenance.attestationRefs]),
      oracleFactIds: Object.freeze([...input.provenance.oracleFactIds]),
    }),
    deliveryRequirements: Object.freeze({
      ...input.deliveryRequirements,
      acceptedEvidenceQualities: Object.freeze([
        ...input.deliveryRequirements.acceptedEvidenceQualities,
      ]),
      deliveryConditions: Object.freeze([...input.deliveryRequirements.deliveryConditions]),
    }),
    permittedConsideration: Object.freeze([...input.permittedConsideration]),
  });
}

/**
 * Refuse a term sheet that omits an ACCESS-09 attribute. Emptiness is a
 * refusal, not a default: a capacity market cannot infer geography, rights, or
 * delivery requirements.
 */
export function evaluateTermsCompleteness(terms: CapacityAccessTerms): TermsCompleteness {
  const missing: string[] = [];
  if (!terms.productiveObject.objectId) {
    missing.push('productiveObject.objectId');
  }
  if (!terms.productiveObject.productiveCategory) {
    missing.push('productiveObject.productiveCategory');
  }
  if (!terms.productiveObject.canonicalUnit) {
    missing.push('productiveObject.canonicalUnit');
  }
  if (terms.quantity <= 0n) {
    missing.push('quantity');
  }
  if (!terms.unit) {
    missing.push('unit');
  }
  if (terms.availabilityWindow.endHeight <= terms.availabilityWindow.startHeight) {
    missing.push('availabilityWindow');
  }
  if (!terms.geography.deliveryLocation) {
    missing.push('geography.deliveryLocation');
  }
  if (!terms.serviceClass.label) {
    missing.push('serviceClass.label');
  }
  if (!terms.rightsTerms.rightsReference) {
    missing.push('rightsTerms.rightsReference');
  }
  if (terms.rightsTerms.permittedPurposes.length === 0) {
    missing.push('rightsTerms.permittedPurposes');
  }
  if (
    terms.policyRequirements.permittedJurisdictions.length === 0 &&
    terms.policyRequirements.deniedJurisdictions.length === 0
  ) {
    missing.push('policyRequirements.jurisdictions');
  }
  if (!terms.jurisdiction) {
    missing.push('jurisdiction');
  }
  if (!terms.provenance.providerId) {
    missing.push('provenance.providerId');
  }
  if (
    terms.provenance.attestationRefs.length === 0 &&
    terms.provenance.oracleFactIds.length === 0
  ) {
    missing.push('provenance.attestation');
  }
  if (terms.deliveryRequirements.acceptedEvidenceQualities.length === 0) {
    missing.push('deliveryRequirements.acceptedEvidenceQualities');
  }
  if (terms.deliveryRequirements.deliveryConditions.length === 0) {
    missing.push('deliveryRequirements.deliveryConditions');
  }
  if (terms.permittedConsideration.length === 0) {
    missing.push('permittedConsideration');
  }
  return Object.freeze({ complete: missing.length === 0, missing: Object.freeze(missing) });
}

/**
 * Derive a term sheet from a canonical listed Exchange instrument. The
 * instrument remains the listing authority; this only projects its policies
 * into the capacity access shape.
 */
export function termsFromInstrument(input: {
  readonly termsId: string;
  readonly instrument: ExchangeInstrument;
  readonly productiveCategory: string;
  readonly claimId?: string | null;
  readonly claimVerified?: boolean;
  readonly normalizationReceiptId?: string | null;
  readonly quantity?: bigint;
  readonly jurisdiction: Jurisdiction;
  readonly provenance: AccessProvenance;
  readonly semantics: AccessSettlementSemantics;
  readonly permittedConsideration: readonly ConsiderationKind[];
  readonly permittedPurposes: readonly string[];
  readonly deliveryConditions: readonly string[];
}): CapacityAccessTerms {
  const extension = input.instrument.extension;
  if (extension.kind !== 'PRODUCTIVE_CAPACITY' && extension.kind !== 'INTELLIGENCE_COMPUTE') {
    throw new TypeError(
      'capacity access terms require a PRODUCTIVE_CAPACITY or INTELLIGENCE_COMPUTE instrument',
    );
  }
  const capacityCategory: CapacityCategory | null =
    extension.kind === 'PRODUCTIVE_CAPACITY' ? extension.capacityCategory : null;
  const computeClass: ComputeServiceClass | null =
    extension.kind === 'INTELLIGENCE_COMPUTE' ? extension.hardwareOrServiceClass : null;
  const quantity =
    input.quantity ?? (extension.kind === 'PRODUCTIVE_CAPACITY' ? extension.quantity : extension.capacity);
  const location =
    extension.kind === 'PRODUCTIVE_CAPACITY' ? extension.deliveryLocation : extension.region;
  const rightsReference =
    extension.kind === 'PRODUCTIVE_CAPACITY'
      ? extension.rightsReference
      : `rights:${input.instrument.instrumentId}`;
  const objectId =
    extension.kind === 'PRODUCTIVE_CAPACITY'
      ? extension.productiveObject
      : input.instrument.underlyingReference;

  return capacityAccessTerms({
    termsId: input.termsId,
    family: input.instrument.marketFamily,
    instrumentId: String(input.instrument.instrumentId),
    productiveObject: {
      objectId,
      claimId: input.claimId ?? null,
      claimType: input.claimId ? 'CAPACITY' : null,
      productiveCategory: input.productiveCategory,
      canonicalUnit: extension.unit,
      normalizationReceiptId: input.normalizationReceiptId ?? null,
      claimVerified: input.claimVerified ?? false,
      tokenizesTitle: false,
    },
    quantity,
    unit: extension.unit,
    availabilityWindow: extension.deliveryWindow,
    geography: {
      deliveryLocation: location,
      region: extension.kind === 'INTELLIGENCE_COMPUTE' ? extension.region : null,
      gridOrNetworkZone: null,
    },
    serviceClass: {
      label: computeClass ?? capacityCategory ?? 'UNSPECIFIED',
      computeClass,
      capacityCategory,
      maximumLatencyClass:
        extension.kind === 'INTELLIGENCE_COMPUTE' ? extension.maximumLatencyClass : null,
      minimumAvailabilityBps: null,
    },
    rightsTerms: {
      rightsReference,
      grantsUseNotOwnership: true,
      sublicensable: false,
      revocationBehavior: input.instrument.rightsPolicy.revocationBehavior,
      permittedPurposes: input.permittedPurposes,
    },
    policyRequirements: {
      requiredCapabilities: input.instrument.eligibilityPolicy.requiredCapabilities,
      requireVerifiedAccount: input.instrument.eligibilityPolicy.requireVerifiedAccount,
      permittedJurisdictions: input.instrument.jurisdictionPolicy.permitted,
      deniedJurisdictions: input.instrument.jurisdictionPolicy.denied,
      requiresManualReviewAbove: null,
      oraclePolicy: input.instrument.oraclePolicy ?? DEFAULT_ORACLE_POLICY,
    },
    jurisdiction: input.jurisdiction,
    provenance: input.provenance,
    deliveryRequirements: {
      semantics: input.semantics,
      requiresOracleAttestation: input.instrument.oraclePolicy.required,
      acceptedEvidenceQualities: ['FINALIZED'],
      partialDeliveryAllowed: input.instrument.deliveryPolicy.partial !== 'ALL_OR_NOTHING',
      deliveryConditions: input.deliveryConditions,
    },
    permittedConsideration: input.permittedConsideration,
  });
}

export function termsInstrumentId(terms: CapacityAccessTerms): InstrumentId {
  return terms.instrumentId;
}

export function windowCoversHeight(window: DeliveryWindow, height: bigint): boolean {
  return height >= window.startHeight && height < window.endHeight;
}

export function windowsOverlap(a: DeliveryWindow, b: DeliveryWindow): boolean {
  return a.startHeight < b.endHeight && b.startHeight < a.endHeight;
}

export function provenanceRecordedAt(terms: CapacityAccessTerms): UtcInstant {
  return terms.provenance.recordedAt;
}
