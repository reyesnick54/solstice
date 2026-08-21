import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const MAP_REL = 'docs/productization/sunrey-authority-map.json';
const FREEZE_REL = 'docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md';
const RULES_REL = 'docs/productization/SUNREY_PRODUCTIZATION_ENGINEERING_RULES.md';
const FLAGS_REL = 'packages/config/src/flags.ts';

const REQUIRED_FREEZE_HEADINGS = [
  '## 1. Objective',
  '## 2. Architecture freeze statement',
  '## 3. Authoritative subsystem table',
  '## 4. Financial authority rules',
  '## 5. AI authority rules',
  '## 6. Frontend authority rules',
  '## 7. Provider authority rules',
  '## 8. Exchange authority rules',
  '## 9. Blockchain authority rules',
  '## 10. Persistence boundaries',
  '## 11. Regulated mutation sequence',
  '## 12. Agent sequence',
  '## 13. Exchange sequence',
  '## 14. Provider adapter principles',
  '## 15. Deprecation policy',
  '## 16. Prohibited architecture patterns',
  '## 17. Future productization rules',
  '## 18. Exception process',
] as const;

const REQUIRED_DOMAINS = [
  'MONEY_REPRESENTATION',
  'LEDGER',
  'BALANCES',
  'IDENTITY',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'KERNEL_POLICY',
  'EXECUTION_AUTHORITY',
  'COMPLIANCE',
  'EVIDENCE',
  'EVENTS',
  'PERSISTENCE',
  'ACCOUNTS',
  'PAYMENTS',
  'CARDS',
  'FX',
  'TREASURY',
  'INVESTMENTS',
  'PERSONAL_ECONOMIC_GRAPH',
  'GROWTH_ORCHESTRATOR',
  'AI_MODEL_GATEWAY',
  'SUNREY_AGENT',
  'AGENT_TOOLS',
  'AGENT_APPROVALS',
  'SUNREY_EXCHANGE',
  'MATCHING',
  'SETTLEMENT',
  'CUSTODY',
  'SUNREY_CHAIN',
  'CONSENSUS',
  'NATIVE_ASSET_SUPPLY',
  'SUNREY_COIN',
  'MOONREY_COIN',
  'ORACLES',
  'HIN',
  'PERSONAL_DATA',
  'PROVIDER_INTEGRATIONS',
  'OPERATIONS',
  'DEPLOYMENT',
] as const;

const AUTHORITY_TYPES = new Set([
  'ACTIVE_CANONICAL',
  'ACTIVE_SPECIALIZED',
  'DEPRECATED',
  'COMPATIBILITY_ONLY',
  'MIGRATION_PENDING',
  'TEST_ONLY',
  'SIMULATION_ONLY',
  'REMOVE_AFTER_MIGRATION',
]);

const COMPETING_PATHS = [
  'packages/ledger-v2',
  'packages/financial-ledger',
  'packages/double-entry',
  'packages/kernel-v2',
  'packages/compliance-kernel',
  'packages/policy-engine',
  'packages/execution-authority',
  'packages/authority-issuer',
  'packages/sunrey-exchange-v2',
  'packages/matching-engine',
  'packages/agent-v2',
  'packages/user-agent-v2',
  'packages/financial-automation',
  'packages/ai-gateway',
  'packages/model-gateway',
  'packages/moonrey-coin',
  'packages/native-mint',
  'packages/asset-authority',
] as const;

const DEPRECATED_PACKAGE_NAMES = [
  '@solstice/moonrey-coin',
  '@sunrey/moonrey-coin',
  '@solstice/ledger-v2',
  '@solstice/kernel-v2',
  '@solstice/agent-v2',
  '@solstice/sunrey-exchange-v2',
  '@solstice/sunrey-chain-v2',
] as const;

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', 'target']);

type AuthorityDomain = {
  readonly domain?: unknown;
  readonly canonicalPath?: unknown;
  readonly authorityType?: unknown;
  readonly mayWrite?: unknown;
  readonly mustUseKernel?: unknown;
  readonly mustUseExecutionAuthority?: unknown;
  readonly canonicalStore?: unknown;
  readonly deprecatedAlternatives?: unknown;
};

type AuthorityMap = {
  readonly productionPosture?: {
    readonly PRODUCTION_READY?: unknown;
    readonly PRODUCTION_ACTIVE?: unknown;
    readonly LIVE_CONNECTIVITY_ENABLED?: unknown;
    readonly ENVIRONMENT?: unknown;
  };
  readonly domains?: readonly AuthorityDomain[];
};

function finding(rule: string, file: string, message: string, line = 1): Finding {
  return { rule, file, line, message };
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|js|mjs|cjs|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function isTestOrIsolation(rel: string): boolean {
  return (
    /\.test\.ts$/.test(rel) ||
    /\/tests\//.test(rel) ||
    /isolation\.ts$/.test(rel) ||
    /architecture-guards/.test(rel) ||
    /tools\/architectural-linter\//.test(rel)
  );
}

function stripComments(line: string): string {
  return line.replace(/\/\/.*$/, '');
}

function parseAuthorityMap(root: string): { map: AuthorityMap | null; findings: Finding[] } {
  const findings: Finding[] = [];
  const path = join(root, MAP_REL);
  if (!existsSync(path)) {
    findings.push(finding('missing-canonical-owner', MAP_REL, 'sunrey-authority-map.json is required'));
    return { map: null, findings };
  }
  let parsed: AuthorityMap;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as AuthorityMap;
  } catch (error) {
    findings.push(
      finding(
        'authority-map-invalid',
        MAP_REL,
        `authority map is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return { map: null, findings };
  }
  return { map: parsed, findings };
}

export function lintArchitectureFreezeDocuments(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of [FREEZE_REL, RULES_REL, MAP_REL]) {
    if (!existsSync(join(root, rel))) {
      findings.push(finding('missing-canonical-owner', rel, `${rel} is required by the architecture freeze`));
    }
  }

  if (existsSync(join(root, FREEZE_REL))) {
    const freeze = readFileSync(join(root, FREEZE_REL), 'utf8');
    for (const heading of REQUIRED_FREEZE_HEADINGS) {
      if (!freeze.includes(heading)) {
        findings.push(finding('architecture-freeze-incomplete', FREEZE_REL, `missing required heading ${heading}`));
      }
    }
    if (/PRODUCTION_READY\s*=\s*true/.test(freeze) || /PRODUCTION_ACTIVE\s*=\s*true/.test(freeze)) {
      findings.push(finding('production-gate-closed', FREEZE_REL, 'freeze document must not claim production ready/active'));
    }
    if (!freeze.includes('A model response is never authorization') && !freeze.includes('must never be treated as authorization')) {
      findings.push(finding('architecture-freeze-incomplete', FREEZE_REL, 'AI sequence must deny model-as-authorization'));
    }
  }

  if (existsSync(join(root, RULES_REL))) {
    const rules = readFileSync(join(root, RULES_REL), 'utf8');
    for (const needle of [
      'Search for the existing implementation',
      'Read the canonical inventory',
      'authority map',
      'Extend the canonical component',
      'parallel architecture',
      'Keep production gates closed',
    ]) {
      if (!rules.toLowerCase().includes(needle.toLowerCase())) {
        findings.push(finding('architecture-freeze-incomplete', RULES_REL, `engineering rules missing: ${needle}`));
      }
    }
  }

  const { map, findings: mapFindings } = parseAuthorityMap(root);
  findings.push(...mapFindings);
  if (!map) {
    return findings;
  }

  const posture = map.productionPosture;
  if (
    posture?.PRODUCTION_READY !== false ||
    posture?.PRODUCTION_ACTIVE !== false ||
    posture?.LIVE_CONNECTIVITY_ENABLED !== false ||
    posture?.ENVIRONMENT !== 'simulation'
  ) {
    findings.push(
      finding(
        'production-gate-closed',
        MAP_REL,
        'authority map must keep PRODUCTION_READY/ACTIVE and LIVE_CONNECTIVITY disabled in simulation',
      ),
    );
  }

  const domains = Array.isArray(map.domains) ? map.domains : [];
  if (domains.length === 0) {
    findings.push(finding('authority-map-invalid', MAP_REL, 'authority map must declare domains'));
    return findings;
  }

  const seen = new Set<string>();
  for (const row of domains) {
    const domain = typeof row.domain === 'string' ? row.domain : '';
    if (!domain) {
      findings.push(finding('authority-map-invalid', MAP_REL, 'domain entry missing domain'));
      continue;
    }
    if (seen.has(domain)) {
      findings.push(finding('duplicate-protected-ownership', MAP_REL, `duplicate authority domain ${domain}`));
    }
    seen.add(domain);
    if (typeof row.canonicalPath !== 'string' || row.canonicalPath.length === 0) {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} missing canonicalPath`));
    } else if (!existsSync(join(root, row.canonicalPath))) {
      findings.push(finding('missing-canonical-owner', MAP_REL, `${domain} canonicalPath does not exist: ${row.canonicalPath}`));
    }
    if (typeof row.authorityType !== 'string' || !AUTHORITY_TYPES.has(row.authorityType)) {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} has unknown authorityType`));
    }
    if (typeof row.mayWrite !== 'boolean') {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} mayWrite must be boolean`));
    }
    if (typeof row.mustUseKernel !== 'boolean') {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} mustUseKernel must be boolean`));
    }
    if (typeof row.mustUseExecutionAuthority !== 'boolean') {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} mustUseExecutionAuthority must be boolean`));
    }
    if (typeof row.canonicalStore !== 'string' || row.canonicalStore.length === 0) {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} missing canonicalStore`));
    }
    if (!Array.isArray(row.deprecatedAlternatives)) {
      findings.push(finding('authority-map-invalid', MAP_REL, `${domain} missing deprecatedAlternatives`));
    }
  }

  for (const required of REQUIRED_DOMAINS) {
    if (!seen.has(required)) {
      findings.push(finding('authority-map-invalid', MAP_REL, `required domain ${required} is missing`));
    }
  }

  return findings;
}

export function lintCompetingArchitecturePaths(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push(
        finding('forbidden-competing-path', rel, `competing architecture path ${rel} is forbidden; extend the canonical owner`),
      );
    }
  }
  return findings;
}

export function lintPrivilegedImportBoundaries(root: string): Finding[] {
  const findings: Finding[] = [];
  const files = walk(root);
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (isTestOrIsolation(rel)) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const inPersonalAgent = rel.startsWith('packages/agent/');
    const inAiRuntime = rel.startsWith('packages/ai-runtime/');
    const inSunreyAgent = rel.startsWith('packages/sunrey-agent/');
    const inFrontend = rel.startsWith('apps/');
    const inProviderCandidate =
      /\/provider-candidate\//.test(rel) || /\/production-candidate\//.test(rel) || /\/providers\/production-binding\//.test(rel);

    for (let i = 0; i < lines.length; i += 1) {
      const lineNo = i + 1;
      const line = stripComments(lines[i] ?? '');
      if (!line.trim() || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
        continue;
      }

      const isImport = /^\s*import\s/.test(line) || /require\s*\(/.test(line);

      if (
        (inPersonalAgent || inAiRuntime) &&
        isImport &&
        (/execution-authority/.test(line) || /AuthorityIssuer/.test(line) || /\/ledger\/src\//.test(line))
      ) {
        findings.push(
          finding(
            'agent-privileged-import',
            rel,
            'Agent / AI runtime must not import Execution Authority issuance or Ledger internals',
            lineNo,
          ),
        );
      }

      if (inSunreyAgent && (/new AuthorityIssuer/.test(line) || /postJournal\s*\(/.test(line))) {
        findings.push(
          finding(
            'agent-privileged-import',
            rel,
            'SunRey Agent must not construct AuthorityIssuer or post journals',
            lineNo,
          ),
        );
      }

      if (
        inFrontend &&
        isImport &&
        (/packages\/ledger\//.test(line) ||
          /packages\/kernel\//.test(line) ||
          /execution-authority/.test(line) ||
          /packages\/security\/src\/provider/.test(line))
      ) {
        findings.push(
          finding(
            'frontend-privileged-import',
            rel,
            'frontend clients must not import privileged server modules',
            lineNo,
          ),
        );
      }

      if (inProviderCandidate && /postJournal\s*\(/.test(line)) {
        findings.push(
          finding(
            'provider-ledger-shortcut',
            rel,
            'provider adapters must not post Ledger journals; use the authorized domain path',
            lineNo,
          ),
        );
      }

      if (
        !rel.startsWith('packages/ledger/') &&
        !rel.startsWith('services/accounts/') &&
        !rel.startsWith('packages/payments/') &&
        !rel.startsWith('packages/cards/') &&
        !rel.startsWith('packages/treasury/') &&
        !rel.startsWith('packages/investments/') &&
        !rel.startsWith('packages/sunrey-coin/') &&
        !rel.startsWith('packages/information-market/') &&
        !rel.startsWith('packages/persistence/') &&
        isImport &&
        /ledger\/src\/invariants\.ts/.test(line)
      ) {
        findings.push(
          finding(
            'ledger-internal-import',
            rel,
            'direct import of Ledger internals is forbidden outside authorized journal paths',
            lineNo,
          ),
        );
      }
    }
  }
  return findings;
}

export function lintDeprecatedPackageDependencies(root: string): Finding[] {
  const findings: Finding[] = [];
  const packageJsonFiles = [join(root, 'package.json'), ...listPackageJson(root)];
  for (const file of packageJsonFiles) {
    if (!existsSync(file)) {
      continue;
    }
    const rel = relative(root, file).replaceAll('\\', '/');
    const text = readFileSync(file, 'utf8');
    for (const name of DEPRECATED_PACKAGE_NAMES) {
      if (text.includes(`"${name}"`)) {
        findings.push(finding('deprecated-package-dependency', rel, `new dependency on DEPRECATED package ${name} is forbidden`));
      }
    }
  }
  return findings;
}

function listPackageJson(root: string): string[] {
  const out: string[] = [];
  for (const top of ['packages', 'services', 'apps', 'tools']) {
    const dir = join(root, top);
    if (!existsSync(dir)) {
      continue;
    }
    for (const entry of readdirSync(dir)) {
      const candidate = join(dir, entry, 'package.json');
      if (existsSync(candidate)) {
        out.push(candidate);
      }
    }
  }
  return out;
}

export function lintProductionGatesRemainClosed(root: string): Finding[] {
  const findings: Finding[] = [];
  const flagsPath = join(root, FLAGS_REL);
  if (!existsSync(flagsPath)) {
    findings.push(finding('missing-canonical-owner', FLAGS_REL, 'simulation flags file is missing'));
    return findings;
  }
  const flags = readFileSync(flagsPath, 'utf8');
  if (!/export const ENVIRONMENT = 'simulation'/.test(flags)) {
    findings.push(finding('production-gate-closed', FLAGS_REL, 'ENVIRONMENT must remain simulation'));
  }
  if (/LIVE_[A-Z_]+\s*=\s*true/.test(flags) || /REAL_MONEY_ENABLED\s*=\s*true/.test(flags)) {
    findings.push(finding('production-gate-closed', FLAGS_REL, 'LIVE_* / REAL_MONEY flags must remain false'));
  }
  return findings;
}

export function lintArchitectureFreeze(root: string): Finding[] {
  return [
    ...lintArchitectureFreezeDocuments(root),
    ...lintCompetingArchitecturePaths(root),
    ...lintPrivilegedImportBoundaries(root),
    ...lintDeprecatedPackageDependencies(root),
    ...lintProductionGatesRemainClosed(root),
  ];
}
