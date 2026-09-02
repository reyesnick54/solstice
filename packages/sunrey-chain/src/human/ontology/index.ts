/**
 * Wave 6 — SunRey Human Economy ontology.
 *
 * Specializes Wave 4 Economic Awareness for governed human contribution.
 * Does not mint SunRey or define human worth.
 */

export {
  HUMAN_ONTOLOGY_ID,
  HUMAN_ONTOLOGY_VERSION,
  RAW_HUMAN_DATA_CANNOT_MINT,
  CONTRIBUTION_EVENT_CANNOT_DIRECTLY_MINT,
  VERIFICATION_DOES_NOT_EQUAL_ISSUANCE,
  ELIGIBILITY_DOES_NOT_EQUAL_ISSUANCE,
  PEVE_DOES_NOT_AUTOMATICALLY_EQUAL_SUNREY_QUANTITY,
  CONSENT_DOES_NOT_EQUAL_VALUATION,
  VALUATION_DOES_NOT_EQUAL_HUMAN_WORTH,
  AI_CANNOT_DEFINE_HUMAN_WORTH,
  AI_CANNOT_APPROVE_ISSUANCE,
  PERSONAL_DATA_STAYS_OFF_CHAIN,
  HUMAN_GOVERNANCE_REQUIRED_FOR_MONETARY_POLICY,
  ATTRIBUTE_IS_NOT_CONTRIBUTION,
  PROFILE_IS_NOT_CONTRIBUTION,
  EVIDENCE_IS_NOT_CONTRIBUTION,
  CLAIM_IS_NOT_SUNREY,
  MARKET_PRICE_IS_NOT_CONTRIBUTION_VALUE,
  HUMAN_ONTOLOGY_INVARIANTS,
} from './constants.ts';

export type {
  HumanContributionEventKind,
  HumanAttributeClass,
  HumanIdentityAssuranceLevel,
  HumanActorStatus,
  HumanControlRejectionCode,
  HumanOntologyResult,
  HumanGovernanceCategory,
  HumanGovernanceCategoryRecord,
  HumanEventTypeDefinition,
  HumanEconomicActor,
  HumanContributionEventMaterial,
} from './types.ts';

export {
  HUMAN_CONTRIBUTION_EVENT_KINDS,
  HUMAN_ATTRIBUTE_CLASSES,
  HUMAN_IDENTITY_ASSURANCE_LEVELS,
  HUMAN_ACTOR_STATUSES,
  HUMAN_CONTROL_REJECTION_CODES,
} from './types.ts';

export {
  HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY,
  governanceCategoryRecord,
  contributionClassForGovernanceCategory,
  governanceCategoryForContributionClass,
  listGovernanceCategories,
} from './categories.ts';

export {
  eventTypeDefinition,
  listEventTypes,
  isKnownEventType,
  eventTypeForContributionClass,
} from './events.ts';

export {
  createHumanEconomicActor,
  validateActorMetadata,
  actorPseudonymCommitment,
  type CreateHumanEconomicActorInput,
} from './actor.ts';

export {
  refuseAttributeAsContribution,
  refuseProfileAsContribution,
  refuseConsentAsContribution,
  refuseConsentAsValuation,
  refuseEvidenceAsContribution,
  refuseValuationAsHumanWorth,
  refuseClaimAsSunRey,
  refuseMarketPriceAsContributionValue,
  refuseCredentialExistenceAsEarned,
  refuseEmploymentRelationshipAsWork,
  refusePaperExistenceAsContribution,
  refuseAttentionAsContribution,
  refuseAppUsageAsContribution,
  refuseLocationAsContribution,
  refuseHealthActivityAsContribution,
  validateHumanContributionEventMaterial,
  contributionIsNotValuation,
  valuationIsNotHumanWorth,
  type AttributeLike,
  type ProfileLike,
  type CredentialExistenceLike,
  type EmploymentRelationshipLike,
  type ResearchPaperExistenceLike,
} from './controls.ts';

export {
  HUMAN_CLAIM_EXTENSION_SCHEMA,
  buildHumanEconomicClaimBundle,
  humanClaimLacksSupplyAuthority,
  type HumanEconomicClaimExtension,
  type HumanEconomicClaimBundle,
} from './claims.ts';

export {
  HUMAN_EVENT_RELATIONS,
  projectHumanContributionToGraph,
  type HumanGraphProjection,
} from './graph.ts';

export {
  WAVE6_FIXTURE_NOW,
  WAVE6_FIXTURE_END,
  WAVE6_FIXTURE_ACTOR_ID,
  WAVE6_FIXTURE_PSEUDONYM,
  EMPLOYMENT_WORK_EVENT,
  RESEARCH_CONTRIBUTION_EVENT,
  EDUCATION_MILESTONE_EVENT,
  SKILL_DEMONSTRATION_EVENT,
  AUTHORIZED_COMPUTATION_EVENT,
  AUTHORIZED_DATASET_EVENT,
  PROFILE_NOT_CONTRIBUTION,
  HUMAN_ATTRIBUTE_LOCATION,
  CREDENTIAL_EXISTS_NOT_EARNED,
  EMPLOYMENT_WITHOUT_WORK,
  PAPER_WITHOUT_CONTRIBUTION,
  WAVE6_DOMAIN_FIXTURES,
} from './fixtures.ts';
