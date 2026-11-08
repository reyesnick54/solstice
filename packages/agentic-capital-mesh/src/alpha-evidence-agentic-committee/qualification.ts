import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ALPHA14_COMMITTEE_ROLES,
  HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_BLOCKED,
  HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED,
} from './taxonomy.ts';
import type { Alpha14CommitteeArtifact, AlphaEvidenceThesis } from './types.ts';
import {
  assertAllAlpha14RolesProduceArtifacts,
  alpha14RoleDisplayName,
  specialistAgentNames,
  validateAlpha14CommitteeArtifact,
  validateAlphaEvidenceThesis,
} from './artifact-validation.ts';
import { allAlpha14RolesRegistered } from './routing.ts';

export type Alpha14QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Alpha14QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED
    | typeof HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Alpha14QualificationCheck[];
  readonly specialistAgentNames: readonly string[];
};

function repoRootFromHere(): string {
  return join(import.meta.dirname, '..', '..', '..', '..');
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

export function evaluateAlpha14AgenticEvidenceQualification(input: {
  readonly sampleArtifacts: readonly Alpha14CommitteeArtifact[];
  readonly sampleThesis: AlphaEvidenceThesis | null;
  readonly repoRoot?: string;
}): Alpha14QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Alpha14QualificationCheck[] = [];
  const blockers: string[] = [];

  const agents = specialistAgentNames();
  checks.push({
    id: 'alpha14.agent.roster',
    passed: agents.length === ALPHA14_COMMITTEE_ROLES.length && allAlpha14RolesRegistered(),
    message: `registered ${agents.length} alpha evidence committee agents`,
  });
  for (const role of ALPHA14_COMMITTEE_ROLES) {
    const expected = alpha14RoleDisplayName(role);
    if (!agents.includes(expected)) {
      blockers.push(`missing agent name for ${role}`);
    }
  }

  for (const artifact of input.sampleArtifacts) {
    const errors = validateAlpha14CommitteeArtifact(artifact);
    checks.push({
      id: `alpha14.artifact.${artifact.role}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? `${artifact.role} artifact valid` : errors.join('; '),
    });
    if (errors.length > 0) blockers.push(`${artifact.role}: ${errors.join('; ')}`);
  }

  const missing = assertAllAlpha14RolesProduceArtifacts(input.sampleArtifacts);
  if (missing.length > 0) {
    blockers.push(...missing);
  }
  checks.push({
    id: 'alpha14.artifacts.complete',
    passed: missing.length === 0,
    message: missing.length === 0 ? 'all committee roles produced artifacts' : missing.join('; '),
  });

  if (input.sampleThesis) {
    const thesisErrors = validateAlphaEvidenceThesis(input.sampleThesis);
    checks.push({
      id: 'alpha14.thesis.sample',
      passed: thesisErrors.length === 0,
      message: thesisErrors.length === 0 ? 'sample AlphaEvidenceThesis valid' : thesisErrors.join('; '),
    });
    if (thesisErrors.length > 0) blockers.push(...thesisErrors);
    if (input.sampleThesis.activatesCapital !== false) {
      blockers.push('thesis must not activate capital');
    }
  } else {
    blockers.push('sample AlphaEvidenceThesis required for qualification');
  }

  const moduleDir = join(root, 'packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee');
  checks.push({
    id: 'alpha14.module.present',
    passed: existsSync(moduleDir),
    message: existsSync(moduleDir) ? 'alpha-evidence-agentic-committee module present' : 'module missing',
  });
  if (!existsSync(moduleDir)) blockers.push('alpha-evidence-agentic-committee module missing');

  const meshSources = existsSync(moduleDir) ? walkTs(moduleDir) : [];
  let boundaryViolation = false;
  for (const file of meshSources) {
    const source = readFileSync(file, 'utf8');
    if (/submitOrder\s*\(/.test(source) || /createPaperOrder\s*\(/.test(source)) {
      boundaryViolation = true;
      blockers.push(`order path in alpha evidence committee: ${file}`);
    }
    if (/waive\s+evidence\s+requirements/i.test(source) && !file.endsWith('artifact-validation.ts')) {
      if (/waive evidence requirements/i.test(source) && !/FORBIDDEN|forbidden|may not/i.test(source)) {
        boundaryViolation = true;
        blockers.push(`improper waive language: ${file}`);
      }
    }
  }
  checks.push({
    id: 'alpha14.boundary.research_only',
    passed: !boundaryViolation,
    message: boundaryViolation ? 'boundary violations detected' : 'research-only; no orders, capital, or waivers',
  });

  const testPath = join(root, 'tests/helios-alpha14-agentic-evidence-committee.test.ts');
  checks.push({
    id: 'alpha14.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'ALPHA14 qualification test present' : 'missing ALPHA14 test file',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-alpha14-agentic-evidence-committee.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED
      : HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    specialistAgentNames: Object.freeze([...agents]),
  });
}
