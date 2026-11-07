import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ALTERNATIVE_DATA_ALT14_ROLES, type AlternativeDataAlt14Artifact } from './types.ts';
import { assertAllAlt14RolesProduceArtifacts, validateAlternativeDataAlt14Artifact } from './artifact-validation.ts';
import { ALT14_UPSTREAM_INSPIRATION } from './upstream-reference.ts';
import { alternativeDataAlt14RoleDisplayName } from './mesh-service.ts';

export const HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_MESH =
  'HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_MESH' as const;
export const HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_QUALIFIED =
  'HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_QUALIFIED' as const;
export const HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_BLOCKED =
  'HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_BLOCKED' as const;

export type Alt14QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Alt14QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_QUALIFIED
    | typeof HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Alt14QualificationCheck[];
  readonly upstream: typeof ALT14_UPSTREAM_INSPIRATION;
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

export function evaluateAlt14AlternativeDataQualification(input: {
  readonly sampleArtifacts: readonly AlternativeDataAlt14Artifact[];
  readonly repoRoot?: string;
}): Alt14QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Alt14QualificationCheck[] = [];
  const blockers: string[] = [];

  const expectedAgents = ALTERNATIVE_DATA_ALT14_ROLES.map((role) => alternativeDataAlt14RoleDisplayName(role));
  checks.push({
    id: 'alt14.agent.roster',
    passed: expectedAgents.length === 10,
    message: `registered ${expectedAgents.length} alternative-data research agents`,
  });

  checks.push({
    id: 'alt14.upstream.inspiration',
    passed: ALT14_UPSTREAM_INSPIRATION.note.length > 0,
    message: 'ALT14 upstream inspiration note present',
  });

  for (const artifact of input.sampleArtifacts) {
    const errors = validateAlternativeDataAlt14Artifact(artifact);
    checks.push({
      id: `alt14.artifact.${artifact.role}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? `${artifact.role} artifact valid` : errors.join('; '),
    });
    if (errors.length > 0) blockers.push(`${artifact.role}: ${errors.join('; ')}`);
  }

  const missing = assertAllAlt14RolesProduceArtifacts(input.sampleArtifacts);
  checks.push({
    id: 'alt14.artifact.coverage',
    passed: missing.length === 0,
    message: missing.length === 0 ? 'all specialist roles produced artifacts' : missing.join('; '),
  });
  if (missing.length > 0) blockers.push(...missing);

  const meshDir = join(root, 'packages/agentic-capital-mesh/src/alternative-data-research-alt14');
  checks.push({
    id: 'alt14.module.present',
    passed: existsSync(meshDir),
    message: existsSync(meshDir) ? 'alternative-data-research-alt14 module present' : 'module missing',
  });

  const meshSources = walkTs(meshDir);
  let importViolation = false;
  for (const file of meshSources) {
    const source = readFileSync(file, 'utf8');
    if (/submitOrder\s*\(/.test(source) || /createPaperOrder\s*\(/.test(source)) {
      importViolation = true;
      blockers.push(`order path in alternative-data mesh: ${file}`);
    }
  }
  checks.push({
    id: 'alt14.boundary.no_orders',
    passed: !importViolation,
    message: importViolation ? 'boundary violations detected' : 'no order APIs in alt14 mesh',
  });

  const testPath = join(root, 'tests/helios-alt14-alternative-data-research-mesh.test.ts');
  checks.push({
    id: 'alt14.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'ALT14 mesh test present' : 'missing ALT14 mesh test file',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-alt14-alternative-data-research-mesh.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_QUALIFIED
      : HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    upstream: ALT14_UPSTREAM_INSPIRATION,
    specialistAgentNames: Object.freeze([...expectedAgents]),
  });
}
