import {
  ALPHA14_COMMITTEE_AGENT_NAMES,
  ALPHA14_COMMITTEE_ROLES,
  ALPHA14_EVIDENCE_QUESTIONS,
  ALPHA14_FORBIDDEN_AGENT_ACTIONS,
  ALPHA14_SKEPTIC_ROLES,
  SKEPTIC_ALPHA14_ATTACK_VECTORS,
  type Alpha14CommitteeRole,
} from './taxonomy.ts';
import type { Alpha14CommitteeArtifact, AlphaEvidenceThesis } from './types.ts';

function inRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

const FORBIDDEN_AUTHORITY_PHRASES = [
  /(?<!not\s)waive\s+evidence\s+requirements/i,
  /(?<!not\s)(?<!cannot\s)lower\s+(the\s+)?statistical\s+threshold/i,
  /(?<!not\s)(?<!cannot\s)change\s+(the\s+)?statistical\s+threshold/i,
  /(?<!not\s)activate\s+capital/i,
  /promote\s+(myself|this\s+strategy|to\s+production)/i,
  /(?<!not\s)upgrade\s+evidence\s+status/i,
  /PERFORMANCE_CLAIM_ALLOWED\s*:\s*true/i,
] as const;

export function textViolatesAlpha14AuthorityGuard(text: string): string | null {
  for (const pattern of FORBIDDEN_AUTHORITY_PHRASES) {
    if (pattern.test(text)) {
      return `forbidden authority language matched: ${pattern.source}`;
    }
  }
  for (const action of ALPHA14_FORBIDDEN_AGENT_ACTIONS) {
    if (!text.toLowerCase().includes(action)) continue;
    const idx = text.toLowerCase().indexOf(action);
    const prefix = text.toLowerCase().slice(Math.max(0, idx - 24), idx);
    if (/(not|cannot|without|forbidden)\s*$/.test(prefix)) continue;
    return `forbidden agent action reference: ${action}`;
  }
  return null;
}

export function validateAlpha14CommitteeArtifact(artifact: Alpha14CommitteeArtifact): readonly string[] {
  const errors: string[] = [];
  if (!artifact.artifactId) errors.push('artifactId required');
  if (!(ALPHA14_COMMITTEE_ROLES as readonly string[]).includes(artifact.role)) {
    errors.push(`unknown role ${artifact.role}`);
  }
  if (!artifact.thesis.trim()) errors.push('thesis required');
  const guard = textViolatesAlpha14AuthorityGuard(artifact.thesis);
  if (guard) errors.push(guard);
  if (!Array.isArray(artifact.supportingEvidence) || artifact.supportingEvidence.length === 0) {
    errors.push('supportingEvidence must be non-empty');
  }
  if (!Array.isArray(artifact.contradictingEvidence)) errors.push('contradictingEvidence must be an array');
  if (!inRange(artifact.confidence)) errors.push('confidence must be between 0 and 1');
  if (!artifact.uncertainty.trim()) errors.push('uncertainty required');
  if (!artifact.informationTime) errors.push('informationTime required');
  if (artifact.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (artifact.issuesOrders !== false) errors.push('issuesOrders must be false');
  if (artifact.activatesCapital !== false) errors.push('activatesCapital must be false');
  if (!Array.isArray(artifact.questionsAddressed) || artifact.questionsAddressed.length === 0) {
    errors.push('questionsAddressed must be non-empty');
  }
  for (const q of artifact.questionsAddressed) {
    if (!(ALPHA14_EVIDENCE_QUESTIONS as readonly string[]).includes(q)) {
      errors.push(`unknown alpha evidence question: ${q}`);
    }
  }
  if (!Array.isArray(artifact.skepticAttacksConsidered)) {
    errors.push('skepticAttacksConsidered must be an array');
  }
  const isSkeptic = (ALPHA14_SKEPTIC_ROLES as readonly string[]).includes(artifact.role);
  if (isSkeptic) {
    if (!artifact.seeksRejection) errors.push(`${artifact.role} must set seeksRejection true`);
    if (artifact.contradictingEvidence.length === 0) {
      errors.push(`${artifact.role} must list contradictingEvidence (reject-first)`);
    }
    if (artifact.skepticAttacksConsidered.length < 4) {
      errors.push(`${artifact.role} must list at least four skeptic attack vectors`);
    }
  }
  for (const a of artifact.skepticAttacksConsidered) {
    if (!(SKEPTIC_ALPHA14_ATTACK_VECTORS as readonly string[]).includes(a)) {
      errors.push(`unknown skeptic attack vector: ${a}`);
    }
  }
  return Object.freeze(errors);
}

export function assertAllAlpha14RolesProduceArtifacts(
  artifacts: readonly Alpha14CommitteeArtifact[],
): readonly string[] {
  const present = new Set(artifacts.map((row) => row.role));
  const missing = ALPHA14_COMMITTEE_ROLES.filter((role) => !present.has(role));
  return Object.freeze(missing.map((role) => `missing artifact for ${role}`));
}

export function validateAlphaEvidenceThesis(thesis: AlphaEvidenceThesis): readonly string[] {
  const errors: string[] = [];
  if (!thesis.thesisId) errors.push('thesisId required');
  if (!thesis.strategyRef) errors.push('strategyRef required');
  if (thesis.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (thesis.issuesOrders !== false) errors.push('issuesOrders must be false');
  if (thesis.activatesCapital !== false) errors.push('activatesCapital must be false');
  if (thesis.simulationOnly !== true) errors.push('simulationOnly must be true');
  if (thesis.evidenceRefs.length === 0) errors.push('evidenceRefs must be non-empty');
  if (thesis.supportedClaims.length === 0 && thesis.unsupportedClaims.length === 0) {
    errors.push('supportedClaims or unsupportedClaims must be non-empty');
  }
  if (thesis.recommendedNextEvidence.length === 0) errors.push('recommendedNextEvidence must be non-empty');
  const body = [
    ...thesis.supportedClaims,
    ...thesis.unsupportedClaims,
    ...thesis.contradictions,
    ...thesis.limitations,
    thesis.statisticalEvidence.summary,
    thesis.implementationEvidence.summary,
  ].join(' ');
  const guard = textViolatesAlpha14AuthorityGuard(body);
  if (guard) errors.push(guard);
  return Object.freeze(errors);
}

export function specialistAgentNames(): readonly string[] {
  return Object.freeze(ALPHA14_COMMITTEE_ROLES.map((role) => ALPHA14_COMMITTEE_AGENT_NAMES[role]));
}

export function alpha14RoleDisplayName(role: Alpha14CommitteeRole): string {
  return ALPHA14_COMMITTEE_AGENT_NAMES[role];
}
