import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  COUNTERFACTUAL_CF13_ROLES,
  type CounterfactualCf13Artifact,
} from './types.ts';
import { assertAllCf13RolesProduceArtifacts, validateCounterfactualCf13Artifact } from './artifact-validation.ts';
import { CF13_UPSTREAM_INSPIRATION } from './upstream-reference.ts';
import { counterfactualCf13RoleDisplayName } from './mesh-service.ts';

export const HELIOS_CF13_COUNTERFACTUAL_RESEARCH_MESH = 'HELIOS_CF13_COUNTERFACTUAL_RESEARCH_MESH' as const;
export const HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED =
  'HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED' as const;
export const HELIOS_CF13_AGENTIC_COUNTERFACTUAL_BLOCKED =
  'HELIOS_CF13_AGENTIC_COUNTERFACTUAL_BLOCKED' as const;

export type Cf13QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Cf13QualificationResult = {
  readonly marker:
    | typeof HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED
    | typeof HELIOS_CF13_AGENTIC_COUNTERFACTUAL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Cf13QualificationCheck[];
  readonly upstream: typeof CF13_UPSTREAM_INSPIRATION;
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

export function evaluateCf13CounterfactualQualification(input: {
  readonly sampleArtifacts: readonly CounterfactualCf13Artifact[];
  readonly repoRoot?: string;
}): Cf13QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Cf13QualificationCheck[] = [];
  const blockers: string[] = [];

  const expectedAgents = COUNTERFACTUAL_CF13_ROLES.map((role) => counterfactualCf13RoleDisplayName(role));
  checks.push({
    id: 'cf13.agent.roster',
    passed: expectedAgents.length === 9,
    message: `registered ${expectedAgents.length} counterfactual research agents`,
  });

  checks.push({
    id: 'cf13.upstream.inspiration',
    passed: CF13_UPSTREAM_INSPIRATION.note.length > 0,
    message: 'CF13 upstream inspiration note present',
  });

  for (const artifact of input.sampleArtifacts) {
    const errors = validateCounterfactualCf13Artifact(artifact);
    checks.push({
      id: `cf13.artifact.${artifact.role}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? `${artifact.role} artifact valid` : errors.join('; '),
    });
    if (errors.length > 0) blockers.push(`${artifact.role}: ${errors.join('; ')}`);
  }

  const missing = assertAllCf13RolesProduceArtifacts(input.sampleArtifacts);
  checks.push({
    id: 'cf13.artifact.coverage',
    passed: missing.length === 0,
    message: missing.length === 0 ? 'all specialist roles produced artifacts' : missing.join('; '),
  });
  if (missing.length > 0) blockers.push(...missing);

  const meshDir = join(root, 'packages/agentic-capital-mesh/src/counterfactual-research-cf13');
  checks.push({
    id: 'cf13.module.present',
    passed: existsSync(meshDir),
    message: existsSync(meshDir) ? 'counterfactual-research-cf13 module present' : 'module missing',
  });

  const forbiddenPackages = ['packages/trading-agents', 'packages/tradingagents', 'vendor/TradingAgents'] as const;
  for (const pkg of forbiddenPackages) {
    const present = existsSync(join(root, pkg));
    checks.push({
      id: `cf13.no_upstream_package.${pkg}`,
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
      blockers.push(`order path in counterfactual mesh: ${file}`);
    }
    if (/definitely\s+would\s+have\s+earned/i.test(source) && !file.endsWith('artifact-validation.ts')) {
      importViolation = true;
      blockers.push(`forbidden definite counterfactual earnings phrase in ${file}`);
    }
  }
  checks.push({
    id: 'cf13.boundary.no_upstream_import_or_orders',
    passed: !importViolation,
    message: importViolation ? 'boundary violations detected' : 'no upstream imports or order APIs',
  });

  const testPath = join(root, 'tests/helios-cf13-counterfactual-research-mesh.test.ts');
  checks.push({
    id: 'cf13.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'CF13 qualification test present' : 'missing CF13 test file',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-cf13-counterfactual-research-mesh.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified ? HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED : HELIOS_CF13_AGENTIC_COUNTERFACTUAL_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    upstream: CF13_UPSTREAM_INSPIRATION,
    specialistAgentNames: Object.freeze([...expectedAgents]),
  });
}
