import {
  COUNTERFACTUAL_CF13_QUESTIONS,
  COUNTERFACTUAL_CF13_ROLES,
  SKEPTIC_CF13_ATTACK_VECTORS,
  type CounterfactualCf13Artifact,
} from './types.ts';

function inRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

const FORBIDDEN_DEFINITE_EARNINGS = /definitely\s+would\s+have\s+earned/i;

export function validateCounterfactualCf13Artifact(artifact: CounterfactualCf13Artifact): readonly string[] {
  const errors: string[] = [];
  if (!artifact.artifactId) errors.push('artifactId required');
  if (!(COUNTERFACTUAL_CF13_ROLES as readonly string[]).includes(artifact.role)) {
    errors.push(`unknown role ${artifact.role}`);
  }
  if (!artifact.thesis.trim()) errors.push('thesis required');
  if (FORBIDDEN_DEFINITE_EARNINGS.test(artifact.thesis)) {
    errors.push('thesis must not assert definite counterfactual earnings');
  }
  if (!Array.isArray(artifact.supportingEvidence) || artifact.supportingEvidence.length === 0) {
    errors.push('supportingEvidence must be non-empty');
  }
  if (!Array.isArray(artifact.contradictingEvidence)) errors.push('contradictingEvidence must be an array');
  if (!inRange(artifact.confidence)) errors.push('confidence must be between 0 and 1');
  if (!artifact.uncertainty.trim()) errors.push('uncertainty required');
  if (!artifact.informationTime) errors.push('informationTime required');
  if (artifact.grantsFinancialAuthority !== false) {
    errors.push('grantsFinancialAuthority must be false');
  }
  if (artifact.issuesOrders !== false) {
    errors.push('counterfactual agents must not issue financial orders');
  }
  if (!Array.isArray(artifact.counterfactualQuestionsAddressed) || artifact.counterfactualQuestionsAddressed.length === 0) {
    errors.push('counterfactualQuestionsAddressed must be non-empty');
  }
  for (const q of artifact.counterfactualQuestionsAddressed) {
    if (!(COUNTERFACTUAL_CF13_QUESTIONS as readonly string[]).includes(q)) {
      errors.push(`unknown counterfactual question: ${q}`);
    }
  }
  if (!Array.isArray(artifact.skepticAttacksConsidered)) {
    errors.push('skepticAttacksConsidered must be an array');
  } else if (artifact.role === 'SKEPTIC' && artifact.skepticAttacksConsidered.length === 0) {
    errors.push('SkepticAgent must list attacks considered');
  }
  for (const a of artifact.skepticAttacksConsidered) {
    if (!(SKEPTIC_CF13_ATTACK_VECTORS as readonly string[]).includes(a)) {
      errors.push(`unknown skeptic attack vector: ${a}`);
    }
  }
  return Object.freeze(errors);
}

export function assertAllCf13RolesProduceArtifacts(artifacts: readonly CounterfactualCf13Artifact[]): readonly string[] {
  const present = new Set(artifacts.map((row) => row.role));
  const missing = COUNTERFACTUAL_CF13_ROLES.filter((role) => !present.has(role));
  return Object.freeze(missing.map((role) => `missing artifact for ${role}`));
}

export function thesisPassesLanguageGuard(text: string): boolean {
  return !FORBIDDEN_DEFINITE_EARNINGS.test(text);
}
