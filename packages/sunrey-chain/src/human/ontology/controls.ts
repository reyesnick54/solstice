/**
 * Wave 6 — human attribute/contribution and achievement/activity controls.
 */

import { FORBIDDEN_SCORE_FIELDS } from '../../../../human-economic-contribution/src/taxonomy.ts';
import { governanceCategoryRecord } from './categories.ts';
import { eventTypeDefinition } from './events.ts';
import type {
  HumanAttributeClass,
  HumanContributionEventMaterial,
  HumanControlRejectionCode,
  HumanOntologyResult,
} from './types.ts';

export type AttributeLike = {
  readonly attributeClass: HumanAttributeClass;
  readonly subjectRef: string;
  readonly valueDigest?: string;
};

export type ProfileLike = {
  readonly profileId: string;
  readonly createdAtUtc: string;
  readonly usageMetrics?: Readonly<Record<string, unknown>>;
};

export type CredentialExistenceLike = {
  readonly credentialId: string;
  readonly issuedAtUtc: string;
  readonly earnedProofRef?: string | null;
};

export type EmploymentRelationshipLike = {
  readonly employerRef: string;
  readonly employeeRef: string;
  readonly active: boolean;
  readonly workPerformedProofRef?: string | null;
};

export type ResearchPaperExistenceLike = {
  readonly paperRef: string;
  readonly publishedAtUtc: string;
  readonly contributionProofRef?: string | null;
};

function ok<T>(value: T): HumanOntologyResult<T> {
  return Object.freeze({ ok: true, value });
}

function fail<T>(code: HumanControlRejectionCode, message: string): HumanOntologyResult<T> {
  return Object.freeze({ ok: false, code, message });
}

export function refuseAttributeAsContribution(attribute: AttributeLike): HumanOntologyResult<true> {
  return fail(
    'ATTRIBUTE_IS_NOT_CONTRIBUTION',
    `human attribute ${attribute.attributeClass} is not an economic contribution merely because it exists`,
  );
}

export function refuseProfileAsContribution(profile: ProfileLike): HumanOntologyResult<true> {
  return fail('PROFILE_IS_NOT_CONTRIBUTION', `profile ${profile.profileId} creation is not a monetizable contribution`);
}

export function refuseConsentAsContribution(): HumanOntologyResult<true> {
  return fail('CONSENT_IS_NOT_CONTRIBUTION', 'consent grant alone is not an economic contribution');
}

export function refuseConsentAsValuation(): HumanOntologyResult<true> {
  return fail('CONSENT_IS_NOT_VALUATION', 'consent does not authorize valuation quantity');
}

export function refuseEvidenceAsContribution(): HumanOntologyResult<true> {
  return fail('EVIDENCE_IS_NOT_CONTRIBUTION', 'evidence bundle alone is not an economic contribution event');
}

export function refuseValuationAsHumanWorth(payload: Readonly<Record<string, unknown>>): HumanOntologyResult<true> {
  for (const key of Object.keys(payload)) {
    if ((FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key)) {
      return fail('VALUATION_IS_NOT_HUMAN_WORTH', `valuation payload must not include human-worth field ${key}`);
    }
  }
  return ok(true);
}

export function refuseClaimAsSunRey(): HumanOntologyResult<true> {
  return fail('CONTRIBUTION_IS_NOT_SUNREY', 'canonical human economic claim does not authorize SunRey issuance');
}

export function refuseMarketPriceAsContributionValue(): HumanOntologyResult<true> {
  return fail('MARKET_PRICE_IS_NOT_CONTRIBUTION_VALUE', 'exchange market price is not contribution value');
}

export function refuseCredentialExistenceAsEarned(credential: CredentialExistenceLike): HumanOntologyResult<true> {
  if (!credential.earnedProofRef) {
    return fail(
      'CREDENTIAL_EXISTENCE_IS_NOT_EARNED',
      `credential ${credential.credentialId} existence does not prove legitimate earning`,
    );
  }
  return ok(true);
}

export function refuseEmploymentRelationshipAsWork(relationship: EmploymentRelationshipLike): HumanOntologyResult<true> {
  if (!relationship.workPerformedProofRef) {
    return fail(
      'EMPLOYMENT_RELATIONSHIP_IS_NOT_WORK',
      `employment relationship with ${relationship.employerRef} does not prove work contribution occurred`,
    );
  }
  return ok(true);
}

export function refusePaperExistenceAsContribution(paper: ResearchPaperExistenceLike): HumanOntologyResult<true> {
  if (!paper.contributionProofRef) {
    return fail(
      'PAPER_EXISTENCE_IS_NOT_CONTRIBUTION',
      `paper ${paper.paperRef} existence does not prove person contributed to research`,
    );
  }
  return ok(true);
}

export function refuseAttentionAsContribution(): HumanOntologyResult<true> {
  return fail('ATTENTION_IS_NOT_CONTRIBUTION', 'attention or engagement metrics are not monetizable contributions');
}

export function refuseAppUsageAsContribution(): HumanOntologyResult<true> {
  return fail('APP_USAGE_IS_NOT_CONTRIBUTION', 'application usage is not a monetizable contribution without governed methodology');
}

export function refuseLocationAsContribution(): HumanOntologyResult<true> {
  return fail('LOCATION_IS_NOT_CONTRIBUTION', 'location data is not an economic contribution merely because it exists');
}

export function refuseHealthActivityAsContribution(): HumanOntologyResult<true> {
  return fail('HEALTH_ACTIVITY_IS_NOT_CONTRIBUTION', 'health activity is not a monetizable contribution without explicit authorization');
}

export function validateHumanContributionEventMaterial(
  material: HumanContributionEventMaterial,
): HumanOntologyResult<HumanContributionEventMaterial> {
  const eventDef = eventTypeDefinition(material.eventType);
  if (!eventDef) {
    return fail('UNKNOWN_EVENT_TYPE', `unknown human contribution event type ${material.eventType}`);
  }
  if (eventDef.governanceCategory !== material.governanceCategory) {
    return fail('EVENT_CLASS_MISMATCH', `event ${material.eventType} governance category mismatch`);
  }
  if (!(eventDef.contributionClasses as readonly string[]).includes(material.contributionClass)) {
    return fail('EVENT_CLASS_MISMATCH', `contribution class ${material.contributionClass} invalid for ${material.eventType}`);
  }
  const category = governanceCategoryRecord(material.governanceCategory);
  if (category.requiresConsent && material.consentRefs.length === 0) {
    return fail('MISSING_CONSENT', `event ${material.eventType} requires consent references`);
  }
  if (category.requiresRights && material.rightsRefs.length === 0) {
    return fail('MISSING_RIGHTS', `event ${material.eventType} requires rights references`);
  }
  if (category.requiresAttestation && material.attestationRefs.length === 0) {
    return fail('MISSING_ATTESTATION', `event ${material.eventType} requires attestation references`);
  }
  if (eventDef.requiresEarnedProof && material.evidenceRefs.length === 0) {
    return fail('MISSING_ATTESTATION', `achievement event ${material.eventType} requires earned-proof evidence`);
  }
  return ok(material);
}

export function contributionIsNotValuation(): HumanOntologyResult<true> {
  return ok(true);
}

export function valuationIsNotHumanWorth(): HumanOntologyResult<true> {
  return ok(true);
}
