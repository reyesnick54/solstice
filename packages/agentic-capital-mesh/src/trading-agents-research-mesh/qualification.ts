import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { TRADING_AGENTS_ASSIMILATION, TRADING_AGENTS_NATIVE_ROLE_MAP } from './upstream-reference.ts';
import { CANONICAL_TRADING_AGENTS_STATE_GRAPH } from './state-graph.ts';
import { TRADING_AGENTS_MESH_ROLES, type TradingAgentsResearchArtifact } from './types.ts';
import { roleDisplayLabel } from './conditional-logic.ts';

export const HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED =
  'HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED' as const;
export const HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_BLOCKED =
  'HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_BLOCKED' as const;

export type Native09QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Native09QualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED
    | typeof HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: readonly Native09QualificationCheck[];
  readonly assimilation: typeof TRADING_AGENTS_ASSIMILATION;
  readonly roleLabels: readonly string[];
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

export function evaluateNative09TradingAgentsResearchQualification(input: {
  readonly sampleArtifacts: readonly TradingAgentsResearchArtifact[];
  readonly repoRoot?: string;
}): Native09QualificationResult {
  const root = input.repoRoot ?? repoRootFromHere();
  const checks: Native09QualificationCheck[] = [];
  const blockers: string[] = [];

  const roleLabels = TRADING_AGENTS_MESH_ROLES.map((role) => roleDisplayLabel(role));
  checks.push({
    id: 'native09.role.roster',
    passed: TRADING_AGENTS_MESH_ROLES.length === 13,
    message: `registered ${TRADING_AGENTS_MESH_ROLES.length} TradingAgents-native research roles`,
  });

  checks.push({
    id: 'native09.upstream.reference_sha',
    passed: TRADING_AGENTS_ASSIMILATION.referenceSha === 'c4544913a14ed3df5f1ed7b9e8483270ce20682a',
    message: `reference SHA ${TRADING_AGENTS_ASSIMILATION.referenceSha}`,
  });

  const assimilationReadme = join(root, TRADING_AGENTS_ASSIMILATION.assimilationPath, 'README.md');
  checks.push({
    id: 'native09.assimilation.readme',
    passed: existsSync(assimilationReadme),
    message: existsSync(assimilationReadme) ? 'assimilation README present' : 'missing vendor assimilation README',
  });
  if (!existsSync(assimilationReadme)) blockers.push('vendor/assimilation/tradingagents/README.md missing');

  checks.push({
    id: 'native09.state_graph',
    passed: CANONICAL_TRADING_AGENTS_STATE_GRAPH.length >= 10,
    message: `${CANONICAL_TRADING_AGENTS_STATE_GRAPH.length} canonical state-graph edges`,
  });

  checks.push({
    id: 'native09.role_map.coverage',
    passed: Object.keys(TRADING_AGENTS_NATIVE_ROLE_MAP).length >= 10,
    message: `${Object.keys(TRADING_AGENTS_NATIVE_ROLE_MAP).length} upstream role mappings`,
  });

  const aiRuntimeModule = join(root, 'packages/ai-runtime/src/trading-agents-research/index.ts');
  checks.push({
    id: 'native09.ai_runtime.prompts',
    passed: existsSync(aiRuntimeModule),
    message: existsSync(aiRuntimeModule) ? 'ai-runtime trading-agents-research module present' : 'ai-runtime module missing',
  });
  if (!existsSync(aiRuntimeModule)) blockers.push('packages/ai-runtime/src/trading-agents-research missing');

  const rolesSeen = new Set(input.sampleArtifacts.map((row) => row.role));
  for (const role of TRADING_AGENTS_MESH_ROLES) {
    checks.push({
      id: `native09.artifact.${role}`,
      passed: rolesSeen.has(role),
      message: rolesSeen.has(role) ? `${role} artifact produced` : `${role} missing from sample run`,
    });
    if (!rolesSeen.has(role)) blockers.push(`missing artifact for ${role}`);
  }

  for (const artifact of input.sampleArtifacts) {
    if (artifact.grantsFinancialAuthority || artifact.issuesOrders) {
      blockers.push(`${artifact.role} attempted execution semantics`);
    }
  }
  checks.push({
    id: 'native09.no_execution_authority',
    passed: !blockers.some((row) => row.includes('execution semantics')),
    message: 'artifacts remain research-only',
  });

  const meshDir = join(root, 'packages/agentic-capital-mesh/src/trading-agents-research-mesh');
  const meshSources = existsSync(meshDir) ? walkTs(meshDir) : [];
  let boundaryViolation = false;
  for (const file of meshSources) {
    const source = readFileSync(file, 'utf8');
    if (
      /from\s+['"]tradingagents/.test(source) ||
      /require\(['"]tradingagents/.test(source) ||
      /from\s+['"]langgraph/.test(source) ||
      /import\s+langgraph/.test(source)
    ) {
      boundaryViolation = true;
      blockers.push(`forbidden upstream runtime import in ${file}`);
    }
  }
  checks.push({
    id: 'native09.no_langgraph_or_python_import',
    passed: !boundaryViolation,
    message: boundaryViolation ? 'LangGraph/python import detected' : 'native TypeScript orchestration only',
  });

  const testPath = join(root, 'tests/helios-native09-trading-agents-research-mesh.test.ts');
  checks.push({
    id: 'native09.test.present',
    passed: existsSync(testPath),
    message: existsSync(testPath) ? 'NATIVE09 qualification test present' : 'missing NATIVE09 test',
  });
  if (!existsSync(testPath)) blockers.push('tests/helios-native09-trading-agents-research-mesh.test.ts missing');

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED
      : HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    checks: Object.freeze([...checks]),
    assimilation: TRADING_AGENTS_ASSIMILATION,
    roleLabels: Object.freeze([...roleLabels]),
  });
}
