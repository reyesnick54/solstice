import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function committedQuarantineArchivesActive(root: string): boolean {
  const quarantinePath = join(root, 'vendor/assimilation/QUARANTINE.json');
  const manifestPath = join(root, 'vendor/assimilation/SOURCE_IMPORT_MANIFEST.json');
  if (!existsSync(quarantinePath) || !existsSync(manifestPath)) return false;
  try {
    const quarantine = JSON.parse(readFileSync(quarantinePath, 'utf8')) as { state?: string };
    if (quarantine.state !== 'QUARANTINED') return false;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      sources?: readonly { runtimeDependency?: boolean; sourceAssimilationState?: string }[];
    };
    return (manifest.sources ?? []).every(
      (source) =>
        source.runtimeDependency === false && source.sourceAssimilationState === 'QUARANTINED',
    );
  } catch {
    return false;
  }
}

export const HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED =
  'HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED' as const;
export const HELIOS_NATIVE_TRADINGAGENTS_DATA_BLOCKED = 'HELIOS_NATIVE_TRADINGAGENTS_DATA_BLOCKED' as const;

export const TRADINGAGENTS_UPSTREAM_SHA = 'c4544913a14ed3df5f1ed7b9e8483270ce20682a' as const;

export type Native10QualificationChecks = {
  readonly dataflowPorted: boolean;
  readonly memoryPorted: boolean;
  readonly portfolioContextPorted: boolean;
  readonly pitEnforced: boolean;
  readonly evidenceSealed: boolean;
  readonly noPythonImportInProduction: boolean;
};

export type Native10QualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED
    | typeof HELIOS_NATIVE_TRADINGAGENTS_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function repoRoot(): string {
  return join(import.meta.dirname, '..', '..', '..', '..');
}

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

export function assertNoPythonProductionDependency(root = repoRoot()): readonly string[] {
  const blockers: string[] = [];
  const scanRoots = [
    join(root, 'packages/external-data/src/tradingagents-native'),
    join(root, 'packages/agentic-capital-mesh/src/tradingagents-native'),
    join(root, 'packages/platform/src/helios/feature-fabric'),
  ];
  for (const dir of scanRoots) {
    for (const file of walkTs(dir)) {
      const source = readFileSync(file, 'utf8');
      if (/from\s+['"]tradingagents/.test(source) || /require\(['"]tradingagents/.test(source)) {
        blockers.push(`forbidden tradingagents python import: ${file}`);
      }
    }
  }
  const vendorTree = join(root, 'vendor/assimilation/tradingagents/tradingagents');
  if (existsSync(vendorTree) && !committedQuarantineArchivesActive(root)) {
    blockers.push('upstream tradingagents tree must not be committed under vendor/assimilation');
  }
  return Object.freeze(blockers);
}

export function evaluateNative10TradingAgentsDataQualification(
  checks: Native10QualificationChecks,
): Native10QualificationResult {
  const blockers: string[] = [];
  if (!checks.dataflowPorted) blockers.push('dataflow_not_ported');
  if (!checks.memoryPorted) blockers.push('memory_not_ported');
  if (!checks.portfolioContextPorted) blockers.push('portfolio_context_not_ported');
  if (!checks.pitEnforced) blockers.push('pit_not_enforced');
  if (!checks.evidenceSealed) blockers.push('evidence_not_sealed');
  if (!checks.noPythonImportInProduction) blockers.push('python_production_dependency');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED : HELIOS_NATIVE_TRADINGAGENTS_DATA_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
