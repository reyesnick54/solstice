import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  EARNINGS_COMMITTEE_ROLES,
  EARNINGS_COMMITTEE_AGENT_NAMES,
  HELIOS_EARN10_AGENTIC_COMMITTEE_BLOCKED,
  HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED,
} from './taxonomy.ts';
import type { EarningsInvestmentThesis, EarningsSpecialistArtifact } from './types.ts';
import {
  specialistAgentNames,
  validateEarningsInvestmentThesis,
  validateEarningsSpecialistArtifact,
} from './validation.ts';

export type Earn10QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Earn10QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED
    | typeof HELIOS_EARN10_AGENTIC_COMMITTEE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Earn10QualificationCheck[];
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

export function evaluateEarn10AgenticCommitteeQualification(input: {
  readonly sampleArtifacts: readonly EarningsSpecialistArtifact[];
  readonly sampleThesis: EarningsInvestmentThesis | null;
  readonly repoRoot?: string;
}): Earn10QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Earn10QualificationCheck[] = [];
  const blockers: string[] = [];

  const agents = specialistAgentNames();
  checks.push({
    id: 'earn10.agent.roster',
    passed: agents.length === EARNINGS_COMMITTEE_ROLES.length,
    message: `registered ${agents.length} earnings committee agents`,
  });
  for (const role of EARNINGS_COMMITTEE_ROLES) {
    const expected = EARNINGS_COMMITTEE_AGENT_NAMES[role];
    if (!agents.includes(expected)) {
      blockers.push(`missing agent name for ${role}`);
    }
  }

  for (const artifact of input.sampleArtifacts) {
    const errors = validateEarningsSpecialistArtifact(artifact);
    checks.push({
      id: `earn10.artifact.${artifact.role}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? `${artifact.role} artifact valid` : errors.join('; '),
    });
    if (errors.length > 0) blockers.push(`${artifact.role}: ${errors.join('; ')}`);
  }

  if (input.sampleThesis) {
    const thesisErrors = validateEarningsInvestmentThesis(input.sampleThesis);
    checks.push({
      id: 'earn10.thesis.sample',
      passed: thesisErrors.length === 0,
      message: thesisErrors.length === 0 ? 'sample thesis valid' : thesisErrors.join('; '),
    });
    if (thesisErrors.length > 0) blockers.push(...thesisErrors);
  } else {
    blockers.push('sample thesis required for qualification');
  }

  const moduleDir = join(root, 'packages/agentic-capital-mesh/src/earnings-agentic-committee');
  checks.push({
    id: 'earn10.module.present',
    passed: existsSync(moduleDir),
    message: existsSync(moduleDir) ? 'earnings-agentic-committee module present' : 'module missing',
  });
  if (!existsSync(moduleDir)) blockers.push('earnings-agentic-committee module missing');

  const meshSources = existsSync(moduleDir) ? walkTs(moduleDir) : [];
  let boundaryViolation = false;
  for (const file of meshSources) {
    const source = readFileSync(file, 'utf8');
    if (/submitOrder\s*\(/.test(source) || /createPaperOrder\s*\(/.test(source)) {
      boundaryViolation = true;
      blockers.push(`order path in earnings committee: ${file}`);
    }
  }
  checks.push({
    id: 'earn10.boundary.no_orders_or_authority',
    passed: !boundaryViolation,
    message: boundaryViolation ? 'boundary violations detected' : 'research-only; no orders or authority',
  });

  const testPath = join(root, 'tests/helios-earn10-agentic-earnings-committee.test.ts');
  checks.push({
    id: 'earn10.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'EARN10 qualification test present' : 'missing EARN10 test file',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-earn10-agentic-earnings-committee.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED
      : HELIOS_EARN10_AGENTIC_COMMITTEE_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    specialistAgentNames: Object.freeze([...agents]),
  });
}
