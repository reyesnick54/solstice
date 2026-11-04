import type { EarningsInvestmentThesis, EarningsSpecialistArtifact } from './types.ts';
import { EARNINGS_COMMITTEE_ROLES, EARNINGS_COMMITTEE_AGENT_NAMES } from './taxonomy.ts';

export function validateEarningsSpecialistArtifact(artifact: EarningsSpecialistArtifact): readonly string[] {
  const errors: string[] = [];
  if (!artifact.artifactId) errors.push('artifactId required');
  if (!EARNINGS_COMMITTEE_ROLES.includes(artifact.role)) errors.push(`unknown role ${artifact.role}`);
  if (artifact.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (artifact.issuesOrders !== false) errors.push('issuesOrders must be false');
  if (artifact.confidence < 0 || artifact.confidence > 1) errors.push('confidence out of range');
  return Object.freeze(errors);
}

export function validateEarningsInvestmentThesis(thesis: EarningsInvestmentThesis): readonly string[] {
  const errors: string[] = [];
  if (!thesis.thesisId) errors.push('thesisId required');
  if (!thesis.entity) errors.push('entity required');
  if (!thesis.event) errors.push('event required');
  if (thesis.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (thesis.issuesOrders !== false) errors.push('issuesOrders must be false');
  if (thesis.AAFQualification.simulationOnly !== true) errors.push('AAFQualification.simulationOnly must be true');
  if (!thesis.AAFQualification.pointInTimeFrozen) errors.push('AAFQualification.pointInTimeFrozen required');
  if (thesis.evidenceRefs.length === 0) errors.push('evidenceRefs must be non-empty');
  const beatSum = thesis.beatProbabilities.reduce((sum, row) => sum + row.probability, 0);
  if (Math.abs(beatSum - 1) > 0.05) errors.push('beatProbabilities should sum to ~1');
  return Object.freeze(errors);
}

export function specialistAgentNames(): readonly string[] {
  return Object.freeze(EARNINGS_COMMITTEE_ROLES.map((role) => EARNINGS_COMMITTEE_AGENT_NAMES[role]));
}
