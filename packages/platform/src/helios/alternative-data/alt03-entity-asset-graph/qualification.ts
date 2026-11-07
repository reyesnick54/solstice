import { asUtcInstant } from '@solstice/domain';

import { assertAltObservationCompanyFeatureEligible } from './feature-gate.ts';
import { seedAlt03ReferenceEntityAssetGraph } from './fixtures.ts';
import { createHeliosAlt03EntityAssetGraphFabric } from './fabric.ts';
import {
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_BLOCKED,
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED,
} from './taxonomy.ts';

export type Alt03QualificationChecks = {
  readonly brandNotPublicCompany: boolean;
  readonly facilityNotParentCollapse: boolean;
  readonly patentAssigneeTemporal: boolean;
  readonly vesselCargoNotSilentParent: boolean;
  readonly jobPostingCrosswalkToOperator: boolean;
  readonly llmProposalNotSilentCertify: boolean;
  readonly ambiguousBlocksInvestmentFeature: boolean;
  readonly fullCascadeEvidence: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Alt03QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED
    | typeof HELIOS_ALT03_ENTITY_ASSET_GRAPH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt03EntityAssetGraphQualification(
  checks: Alt03QualificationChecks,
): Alt03QualificationResult {
  const blockers: string[] = [];
  if (!checks.brandNotPublicCompany) blockers.push('brand_not_public_company');
  if (!checks.facilityNotParentCollapse) blockers.push('facility_not_parent');
  if (!checks.patentAssigneeTemporal) blockers.push('patent_assignee_temporal');
  if (!checks.vesselCargoNotSilentParent) blockers.push('vessel_cargo_parent_assumption');
  if (!checks.jobPostingCrosswalkToOperator) blockers.push('job_posting_parent_assumption');
  if (!checks.llmProposalNotSilentCertify) blockers.push('llm_silent_certify');
  if (!checks.ambiguousBlocksInvestmentFeature) blockers.push('ambiguous_investment_feature');
  if (!checks.fullCascadeEvidence) blockers.push('cascade_evidence');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED : HELIOS_ALT03_ENTITY_ASSET_GRAPH_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function runAlt03QualificationHarness(): Alt03QualificationResult {
  const fixture = seedAlt03ReferenceEntityAssetGraph();
  const fabric = createHeliosAlt03EntityAssetGraphFabric({
    graph: fixture.store,
    crosswalk: fixture.crosswalk,
    llmProposals: fixture.llmProposals,
  });

  const t = asUtcInstant('2024-06-01T00:00:00.000Z');

  const brandMention = fabric.resolveObservation({
    observationRef: 'obs:brand-dawn',
    providerId: 'fixture_alt',
    surface: 'BRAND_MENTION',
    rawLabel: 'Dawn dish soap brand',
    asOf: t,
    knowableAtCutoff: t,
    deterministicIdentifiers: Object.freeze([]),
    normalizedTokens: Object.freeze([normalizeToken('Dawn')]),
    sourceRefs: Object.freeze(['evidence:alt:social:001']),
  });

  const facilitySignal = fabric.resolveObservation({
    observationRef: 'obs:facility-zhangzhou',
    providerId: 'fixture_alt',
    surface: 'FACILITY_ACTIVITY',
    rawLabel: 'Zhangzhou plant',
    asOf: t,
    knowableAtCutoff: t,
    deterministicIdentifiers: Object.freeze([{ system: 'facility_epa', id: 'cn-zhangzhou-017' }]),
    normalizedTokens: Object.freeze([]),
    sourceRefs: Object.freeze(['evidence:alt:satellite:017']),
  });

  const patent2024 = fabric.resolveObservation({
    observationRef: 'obs:patent-oldco',
    providerId: 'fixture_alt',
    surface: 'PATENT_FILING',
    rawLabel: 'OldCo Patents LLC',
    asOf: t,
    knowableAtCutoff: t,
    deterministicIdentifiers: Object.freeze([{ system: 'uspto_assignee', id: 'oldco-patents-llc' }]),
    normalizedTokens: Object.freeze([]),
    sourceRefs: Object.freeze(['evidence:uspto:assignee']),
  });

  const vesselCargo = fabric.resolveObservation({
    observationRef: 'obs:vessel-cargo-ambiguous',
    providerId: 'fixture_alt',
    surface: 'VESSEL_CARGO',
    rawLabel: 'Mystery bulk cargo consignee',
    asOf: t,
    knowableAtCutoff: t,
    deterministicIdentifiers: Object.freeze([]),
    normalizedTokens: Object.freeze([]),
    sourceRefs: Object.freeze(['evidence:ais:cargo']),
  });

  const jobPosting = fabric.resolveObservation({
    observationRef: 'obs:job-pg-site',
    providerId: 'fixture_alt',
    surface: 'JOB_POSTING',
    rawLabel: 'pgcareers.com',
    asOf: t,
    knowableAtCutoff: t,
    deterministicIdentifiers: Object.freeze([]),
    normalizedTokens: Object.freeze(['website:pgcareers.com']),
    sourceRefs: Object.freeze(['evidence:alt:jobs']),
  });

  const brandGate = assertAltObservationCompanyFeatureEligible(brandMention.matchState);
  const facilityGate = assertAltObservationCompanyFeatureEligible(facilitySignal.matchState);
  const ambiguousGate = assertAltObservationCompanyFeatureEligible(vesselCargo.matchState);

  return evaluateAlt03EntityAssetGraphQualification({
    brandNotPublicCompany: brandMention.matchState === 'EXACT' && brandMention.resolvedKind === 'BRAND',
    facilityNotParentCollapse:
      facilitySignal.matchState === 'EXACT' && facilitySignal.resolvedKind === 'FACILITY' && facilitySignal.investmentIssuerEntityId === null,
    patentAssigneeTemporal: patent2024.matchState === 'EXACT' && patent2024.resolvedKind === 'PATENT_ASSIGNEE',
    vesselCargoNotSilentParent:
      vesselCargo.matchState === 'AMBIGUOUS' && vesselCargo.llmProposal?.certified === false,
    jobPostingCrosswalkToOperator:
      jobPosting.matchState === 'HIGH_CONFIDENCE' && jobPosting.resolvedNodeId !== fixture.pghParent,
    llmProposalNotSilentCertify: vesselCargo.llmProposal !== null && vesselCargo.llmProposal.certified === false,
    ambiguousBlocksInvestmentFeature: !ambiguousGate.ok && brandGate.ok && facilityGate.ok,
    fullCascadeEvidence:
      brandMention.cascade.length >= 1 &&
      facilitySignal.cascade.some((s) => s.stage === 'DETERMINISTIC_IDENTIFIER' && s.outcome === 'EXACT'),
    noExecutionAuthority:
      brandMention.grantsExecutionAuthority === false &&
      facilitySignal.grantsExecutionAuthority === false &&
      vesselCargo.grantsExecutionAuthority === false,
  });
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}
