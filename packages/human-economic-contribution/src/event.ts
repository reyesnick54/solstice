import { err, ok, type Result } from '../../domain/src/result.ts';
import { contributionIdFor } from './ids.ts';
import { validateContributionInput } from './invariants.ts';
import { mergeCanonicalReferences } from './references.ts';
import {
  HUMAN_CONTRIBUTION_SCHEMA_VERSION,
  SOURCE_QUALITY_LOCK,
  isNonAuthoritativeSource,
} from './taxonomy.ts';
import {
  AUTHORITY_BOUNDARY,
  CURRENT_TAXONOMY_VERSION,
  PRIVACY_BOUNDARY,
  type ContributionFailure,
  type ContributionMeasurement,
  type ExecutionRefusal,
  type HumanContributionEvent,
  type MintRefusal,
  type RecordContributionInput,
} from './types.ts';

function lockedQuality(input: RecordContributionInput): HumanContributionEvent['verificationQuality'] {
  if (isNonAuthoritativeSource(input.sourceClass)) {
    return SOURCE_QUALITY_LOCK[input.sourceClass];
  }
  return input.verificationQuality ?? 'ATTESTED';
}

function initialStatus(input: RecordContributionInput): HumanContributionEvent['status'] {
  if (input.status) {
    return input.status;
  }
  if (isNonAuthoritativeSource(input.sourceClass)) {
    return input.sourceClass === 'USER_DECLARED' ? 'SUBMITTED' : 'VERIFICATION_REQUIRED';
  }
  return 'OBSERVED';
}

function measurementOf(input: RecordContributionInput): ContributionMeasurement {
  return Object.freeze({
    quantity: input.measurementQuantity,
    unit: input.measurementUnit,
    unlikeUnitsEconomicallyEquivalent: false,
    isMonetaryValuation: false,
    isSunReyQuantity: false,
    isPeveScore: false,
  });
}

export function createHumanContributionEvent(
  input: RecordContributionInput,
): Result<HumanContributionEvent, ContributionFailure> {
  const validated = validateContributionInput(input);
  if (!validated.ok) {
    return validated;
  }

  const canonical = mergeCanonicalReferences({
    informationRightRefs: input.rightsReferences ?? input.canonicalReferences?.informationRightRefs ?? [],
    consentGrantRefs: input.consentReferences ?? input.canonicalReferences?.consentGrantRefs ?? [],
    usageReceiptRefs: input.usageReceiptReferences ?? input.canonicalReferences?.usageReceiptRefs ?? [],
    cleanRoomResultRefs: input.canonicalReferences?.cleanRoomResultRefs ?? [],
    pegEventRefs: input.canonicalReferences?.pegEventRefs ?? [],
    ledgerEventRefs: input.canonicalReferences?.ledgerEventRefs ?? [],
    paymentEventRefs: input.canonicalReferences?.paymentEventRefs ?? [],
    cardEventRefs: input.canonicalReferences?.cardEventRefs ?? [],
    externalAttestationRefs: input.canonicalReferences?.externalAttestationRefs ?? [],
    communityAttestationRefs: input.canonicalReferences?.communityAttestationRefs ?? [],
    researchAttestationRefs: input.canonicalReferences?.researchAttestationRefs ?? [],
    professionalAttestationRefs: input.canonicalReferences?.professionalAttestationRefs ?? [],
  });

  const event: HumanContributionEvent = {
    schemaVersion: HUMAN_CONTRIBUTION_SCHEMA_VERSION,
    taxonomyVersion: CURRENT_TAXONOMY_VERSION,
    contributionId: input.contributionId ?? contributionIdFor(`${input.subjectRef}:${input.eventReference}:${input.createdAt}`),
    subjectRef: input.subjectRef,
    contributionClass: input.contributionClass,
    sourceClass: input.sourceClass,
    eventReference: input.eventReference,
    measurement: measurementOf(input),
    measurementUnit: input.measurementUnit,
    validFrom: input.validFrom,
    validUntil: input.validUntil ?? null,
    jurisdiction: input.jurisdiction,
    evidenceReferences: Object.freeze([...(input.evidenceReferences ?? [])]),
    rightsReferences: Object.freeze([...(input.rightsReferences ?? canonical.informationRightRefs)]),
    consentReferences: Object.freeze([...(input.consentReferences ?? canonical.consentGrantRefs)]),
    purposeReferences: Object.freeze([...(input.purposeReferences ?? [])]),
    provenanceReferences: Object.freeze([...(input.provenanceReferences ?? [])]),
    attestationReferences: Object.freeze([...(input.attestationReferences ?? [])]),
    usageReceiptReferences: Object.freeze([...(input.usageReceiptReferences ?? canonical.usageReceiptRefs)]),
    canonicalReferences: canonical,
    createdAt: input.createdAt,
    status: initialStatus(input),
    eligibilityState: input.eligibilityState ?? 'NOT_EVALUATED',
    verificationQuality: lockedQuality(input),
    dataQuality: input.dataQuality ?? 'CURRENT',
    supersededBy: null,
    supersedes: input.supersedes ?? null,
    policyDecisionRef: input.policyDecisionRef ?? null,
    privacyBoundary: PRIVACY_BOUNDARY,
    authorityBoundary: AUTHORITY_BOUNDARY,
    issuanceEligible: false,
    sunReyQuantity: null,
    peveScoreUsedAsValue: false,
    humanWorthScore: false,
  };

  return ok(Object.freeze(event));
}

export function refuseExecution(event: HumanContributionEvent): ExecutionRefusal {
  return Object.freeze({
    authorized: false,
    issuesExecutionAuthority: false,
    reason: 'CONTRIBUTION_EVENT_CANNOT_AUTHORIZE_EXECUTION',
    contributionId: event.contributionId,
    schemaVersion: event.schemaVersion,
  });
}

export function refuseMint(event: HumanContributionEvent): MintRefusal {
  return Object.freeze({
    authorized: false,
    sunReyQuantity: null,
    reason: 'CONTRIBUTION_EVENT_CANNOT_AUTHORIZE_SUNREY_ISSUANCE',
    contributionId: event.contributionId,
    schemaVersion: event.schemaVersion,
  });
}

export function contributionToSunReyQuantity(_event: HumanContributionEvent): Result<never, ContributionFailure> {
  return err({
    code: 'ISSUANCE_QUANTITY_FORBIDDEN',
    message: 'CHUNK-104 defines contribution ontology only. It does not calculate SunRey Coin quantities.',
  });
}
