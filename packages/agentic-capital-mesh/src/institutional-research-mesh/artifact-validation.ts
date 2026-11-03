import {
  INSTITUTIONAL_RESEARCH_ROLES,
  RESEARCH_RECOMMENDATION_CLASSES,
  RESEARCH_TIME_HORIZONS,
  type StructuredResearchArtifact,
} from './types.ts';

function inRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateStructuredResearchArtifact(artifact: StructuredResearchArtifact): readonly string[] {
  const errors: string[] = [];
  if (!artifact.artifactId) errors.push('artifactId required');
  if (!(INSTITUTIONAL_RESEARCH_ROLES as readonly string[]).includes(artifact.role)) {
    errors.push(`unknown role ${artifact.role}`);
  }
  if (!artifact.thesis.trim()) errors.push('thesis required');
  if (!Array.isArray(artifact.supportingEvidence) || artifact.supportingEvidence.length === 0) {
    errors.push('supportingEvidence must be non-empty');
  }
  if (!Array.isArray(artifact.contradictingEvidence)) errors.push('contradictingEvidence must be an array');
  if (!inRange(artifact.confidence)) errors.push('confidence must be between 0 and 1');
  if (!artifact.uncertainty.trim()) errors.push('uncertainty required');
  if (!(RESEARCH_TIME_HORIZONS as readonly string[]).includes(artifact.timeHorizon)) {
    errors.push('timeHorizon invalid');
  }
  if (!Array.isArray(artifact.applicableInstruments)) errors.push('applicableInstruments must be an array');
  if (!Array.isArray(artifact.applicableRegimes)) errors.push('applicableRegimes must be an array');
  if (!Array.isArray(artifact.sourceRefs) || artifact.sourceRefs.length === 0) {
    errors.push('sourceRefs must be non-empty');
  }
  if (!artifact.informationTime) errors.push('informationTime required');
  if (!Array.isArray(artifact.knownLimitations) || artifact.knownLimitations.length === 0) {
    errors.push('knownLimitations must be non-empty');
  }
  if (!(RESEARCH_RECOMMENDATION_CLASSES as readonly string[]).includes(artifact.recommendationClass)) {
    errors.push('recommendationClass invalid');
  }
  if (artifact.grantsFinancialAuthority !== false) {
    errors.push('grantsFinancialAuthority must be false');
  }
  if (artifact.issuesOrders !== false) {
    errors.push('research agents must not issue financial orders');
  }
  for (const tool of artifact.toolsUsed) {
    if (/submitOrder|postJournal|issueExecutionAuthority/i.test(tool)) {
      errors.push(`forbidden tool ${tool}`);
    }
  }
  return Object.freeze(errors);
}

export function assertAllRolesProduceArtifacts(artifacts: readonly StructuredResearchArtifact[]): readonly string[] {
  const present = new Set(artifacts.map((row) => row.role));
  const missing = INSTITUTIONAL_RESEARCH_ROLES.filter((role) => !present.has(role));
  return Object.freeze(missing.map((role) => `missing artifact for ${role}`));
}
