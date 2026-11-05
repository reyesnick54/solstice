import type { ValuationInvestmentThesis, ValuationSpecialistArtifact } from './types.ts';
import { VALUATION_COMMITTEE_AGENT_NAMES, VALUATION_COMMITTEE_ROLES } from './taxonomy.ts';

export function validateValuationSpecialistArtifact(
  artifact: ValuationSpecialistArtifact,
): readonly string[] {
  const errors: string[] = [];
  if (!artifact.artifactId) errors.push('artifactId required');
  if (!VALUATION_COMMITTEE_ROLES.includes(artifact.role)) errors.push(`unknown role ${artifact.role}`);
  if (artifact.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (artifact.issuesOrders !== false) errors.push('issuesOrders must be false');
  if (artifact.confidence < 0 || artifact.confidence > 1) errors.push('confidence out of range');
  if (artifact.assumptionTopicsChallenged.length === 0) {
    errors.push('assumptionTopicsChallenged must cite at least one challenged topic');
  }
  return Object.freeze(errors);
}

export function validateValuationInvestmentThesis(thesis: ValuationInvestmentThesis): readonly string[] {
  const errors: string[] = [];
  if (!thesis.thesisId) errors.push('thesisId required');
  if (!thesis.entity) errors.push('entity required');
  if (!thesis.instrumentId) errors.push('instrumentId required');
  if (thesis.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (thesis.issuesOrders !== false) errors.push('issuesOrders must be false');
  if (thesis.AAFQualification.simulationOnly !== true) errors.push('AAFQualification.simulationOnly must be true');
  if (!thesis.AAFQualification.pointInTimeFrozen) errors.push('AAFQualification.pointInTimeFrozen required');
  if (thesis.AAFQualification.canonicalFactsImmutable !== true) {
    errors.push('AAFQualification.canonicalFactsImmutable must be true');
  }
  if (thesis.evidenceRefs.length === 0) errors.push('evidenceRefs must be non-empty');
  if (thesis.intrinsicValueDistribution.length < 2) {
    errors.push('intrinsicValueDistribution requires at least two bands');
  }
  const probSum = thesis.intrinsicValueDistribution.reduce((sum, row) => sum + row.probability, 0);
  if (Math.abs(probSum - 1) > 0.08) errors.push('intrinsicValueDistribution probabilities should sum to ~1');
  if (thesis.marketImpliedExpectations.length === 0) {
    errors.push('marketImpliedExpectations must be non-empty');
  }
  if (thesis.expectationGaps.length === 0) errors.push('expectationGaps must be non-empty');
  if (thesis.keyAssumptions.length === 0) errors.push('keyAssumptions must be non-empty');
  return Object.freeze(errors);
}

export function specialistAgentNames(): readonly string[] {
  return Object.freeze(VALUATION_COMMITTEE_ROLES.map((role) => VALUATION_COMMITTEE_AGENT_NAMES[role]));
}
