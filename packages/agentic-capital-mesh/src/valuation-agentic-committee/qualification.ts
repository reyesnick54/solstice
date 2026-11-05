import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  HELIOS_VAL06_AGENTIC_VALUATION_BLOCKED,
  HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED,
  VALUATION_COMMITTEE_AGENT_NAMES,
  VALUATION_COMMITTEE_ROLES,
} from './taxonomy.ts';
import type { ValuationInvestmentThesis, ValuationSpecialistArtifact } from './types.ts';
import {
  specialistAgentNames,
  validateValuationInvestmentThesis,
  validateValuationSpecialistArtifact,
} from './validation.ts';

export type Val06QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Val06QualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED
    | typeof HELIOS_VAL06_AGENTIC_VALUATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Val06QualificationCheck[];
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

export function evaluateVal06AgenticValuationQualification(input: {
  readonly sampleArtifacts: readonly ValuationSpecialistArtifact[];
  readonly sampleThesis: ValuationInvestmentThesis | null;
  readonly repoRoot?: string;
}): Val06QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Val06QualificationCheck[] = [];
  const blockers: string[] = [];

  const agents = specialistAgentNames();
  checks.push({
    id: 'val06.agent.roster',
    passed: agents.length === VALUATION_COMMITTEE_ROLES.length,
    message: `registered ${agents.length} valuation committee agents`,
  });
  for (const role of VALUATION_COMMITTEE_ROLES) {
    const expected = VALUATION_COMMITTEE_AGENT_NAMES[role];
    if (!agents.includes(expected)) {
      blockers.push(`missing agent name for ${role}`);
    }
  }

  for (const artifact of input.sampleArtifacts) {
    const errors = validateValuationSpecialistArtifact(artifact);
    checks.push({
      id: `val06.artifact.${artifact.role}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? `${artifact.role} artifact valid` : errors.join('; '),
    });
    if (errors.length > 0) blockers.push(`${artifact.role}: ${errors.join('; ')}`);
  }

  if (input.sampleThesis) {
    const thesisErrors = validateValuationInvestmentThesis(input.sampleThesis);
    checks.push({
      id: 'val06.thesis.sample',
      passed: thesisErrors.length === 0,
      message: thesisErrors.length === 0 ? 'sample thesis valid' : thesisErrors.join('; '),
    });
    if (thesisErrors.length > 0) blockers.push(...thesisErrors);
  } else {
    blockers.push('sample thesis required for qualification');
  }

  const moduleDir = join(root, 'packages/agentic-capital-mesh/src/valuation-agentic-committee');
  checks.push({
    id: 'val06.module.present',
    passed: existsSync(moduleDir),
    message: existsSync(moduleDir) ? 'valuation-agentic-committee module present' : 'module missing',
  });
  if (!existsSync(moduleDir)) blockers.push('valuation-agentic-committee module missing');

  const meshSources = existsSync(moduleDir) ? walkTs(moduleDir) : [];
  let boundaryViolation = false;
  for (const file of meshSources) {
    const source = readFileSync(file, 'utf8');
    if (/submitOrder\s*\(/.test(source) || /createPaperOrder\s*\(/.test(source)) {
      boundaryViolation = true;
      blockers.push(`order path in valuation committee: ${file}`);
    }
  }
  checks.push({
    id: 'val06.boundary.no_orders_or_authority',
    passed: !boundaryViolation,
    message: boundaryViolation ? 'boundary violations detected' : 'research-only; no orders or authority',
  });

  const testPath = join(root, 'tests/helios-val06-agentic-valuation-committee.test.ts');
  checks.push({
    id: 'val06.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'VAL06 qualification test present' : 'missing VAL06 test file',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-val06-agentic-valuation-committee.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED
      : HELIOS_VAL06_AGENTIC_VALUATION_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    specialistAgentNames: Object.freeze([...agents]),
  });
}
