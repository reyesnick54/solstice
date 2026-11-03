import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  INSTITUTIONAL_RESEARCH_ROLES,
  type StructuredResearchArtifact,
} from './types.ts';
import { assertAllRolesProduceArtifacts, validateStructuredResearchArtifact } from './artifact-validation.ts';
import { TRADING_AGENTS_UPSTREAM } from './upstream-reference.ts';
import { roleDisplayName } from './mesh-service.ts';

export const HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH = 'HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH' as const;
export const HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED =
  'HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED' as const;
export const HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_BLOCKED =
  'HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_BLOCKED' as const;

export type Os09QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Os09QualificationResult = {
  readonly marker:
    | typeof HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED
    | typeof HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Os09QualificationCheck[];
  readonly upstream: typeof TRADING_AGENTS_UPSTREAM;
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

export function evaluateOs09InstitutionalResearchQualification(input: {
  readonly sampleArtifacts: readonly StructuredResearchArtifact[];
  readonly repoRoot?: string;
}): Os09QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Os09QualificationCheck[] = [];
  const blockers: string[] = [];

  const expectedAgents = INSTITUTIONAL_RESEARCH_ROLES.map((role) => roleDisplayName(role));
  checks.push({
    id: 'os09.agent.roster',
    passed: expectedAgents.length === 14,
    message: `registered ${expectedAgents.length} institutional research agents`,
  });

  checks.push({
    id: 'os09.upstream.reference_sha',
    passed: TRADING_AGENTS_UPSTREAM.referenceSha === 'c4544913a14ed3df5f1ed7b9e8483270ce20682a',
    message: `TradingAgents reference SHA pinned (${TRADING_AGENTS_UPSTREAM.referenceSha})`,
  });

  for (const artifact of input.sampleArtifacts) {
    const errors = validateStructuredResearchArtifact(artifact);
    checks.push({
      id: `os09.artifact.${artifact.role}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? `${artifact.role} artifact valid` : errors.join('; '),
    });
    if (errors.length > 0) blockers.push(`${artifact.role}: ${errors.join('; ')}`);
  }

  const missing = assertAllRolesProduceArtifacts(input.sampleArtifacts);
  checks.push({
    id: 'os09.artifact.coverage',
    passed: missing.length === 0,
    message: missing.length === 0 ? 'all specialist roles produced artifacts' : missing.join('; '),
  });
  if (missing.length > 0) blockers.push(...missing);

  const meshDir = join(root, 'packages/agentic-capital-mesh/src/institutional-research-mesh');
  checks.push({
    id: 'os09.module.present',
    passed: existsSync(meshDir),
    message: existsSync(meshDir) ? 'institutional-research-mesh module present' : 'module missing',
  });

  const forbiddenPackages = [
    'packages/trading-agents',
    'packages/tradingagents',
    'vendor/TradingAgents',
  ] as const;
  for (const pkg of forbiddenPackages) {
    const present = existsSync(join(root, pkg));
    checks.push({
      id: `os09.no_upstream_package.${pkg}`,
      passed: !present,
      message: present ? `forbidden upstream package present: ${pkg}` : `${pkg} not vendored`,
    });
    if (present) blockers.push(`upstream package vendored at ${pkg}`);
  }

  const meshSources = walkTs(meshDir);
  let importViolation = false;
  for (const file of meshSources) {
    const source = readFileSync(file, 'utf8');
    if (/from\s+['"]tradingagents/.test(source) || /require\(['"]tradingagents/.test(source)) {
      importViolation = true;
      blockers.push(`forbidden tradingagents import in ${file}`);
    }
    if (/submitOrder\s*\(/.test(source) || /createPaperOrder\s*\(/.test(source)) {
      importViolation = true;
      blockers.push(`order path in research mesh: ${file}`);
    }
  }
  checks.push({
    id: 'os09.boundary.no_upstream_import_or_orders',
    passed: !importViolation,
    message: importViolation ? 'boundary violations detected' : 'no upstream imports or order APIs',
  });

  const testPath = join(root, 'tests/helios-os09-institutional-research-mesh.test.ts');
  checks.push({
    id: 'os09.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'OS09 qualification test present' : 'missing OS09 test file',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-os09-institutional-research-mesh.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED
      : HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    upstream: TRADING_AGENTS_UPSTREAM,
    specialistAgentNames: Object.freeze([...expectedAgents]),
  });
}
