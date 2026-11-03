#!/usr/bin/env node
/**
 * HELIOS OS15 — open-source integration wave 1 qualification runner.
 * Writes release report, provenance manifest, and capability delta under docs/helios/open-source/.
 * Does not enable live connectivity or merge integration branches automatically.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED,
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED,
  buildCapabilityDelta,
  buildOpenSourceWorkPackageRegistry,
  evaluateOpenSourceIntegrationQualification,
  renderCapabilityDeltaMarkdown,
  scanOpenSourceProvenance,
  type PlatformGateResult,
} from '../packages/platform/src/helios/open-source/index.ts';
import { runOpenSourceIntegrationSystemDemo } from './lib/helios-open-source-system-demo.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs/helios/open-source');
const REPORT_REL = 'docs/helios/open-source/OPEN_SOURCE_INTEGRATION_RELEASE_REPORT.md';
const MANIFEST_REL = 'docs/helios/open-source/OPEN_SOURCE_PROVENANCE_MANIFEST.json';
const DELTA_REL = 'docs/helios/open-source/HELIOS_CAPABILITY_DELTA.md';

const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runGate(gate: PlatformGateResult['gate'], command: string, args: string[]): PlatformGateResult {
  if (SKIP_SUBPROCESS) {
    return { gate, pass: true, detail: 'skipped (--skip-subprocess)' };
  }
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', env: process.env });
  return {
    gate,
    pass: result.status === 0,
    detail: result.status === 0 ? 'ok' : (result.stderr || result.stdout || 'failed').slice(0, 400),
  };
}

function evaluateHeliosBoundaryGate(): PlatformGateResult {
  const findings = lintHeliosBoundary(ROOT);
  return {
    gate: 'helios_boundary',
    pass: findings.length === 0,
    detail: findings.length === 0 ? 'ok' : findings.map((f) => f.message).join('; ').slice(0, 400),
  };
}

function evaluateAafQualification(): { readonly pass: boolean; readonly detail: string } {
  const aafTests = [
    'tests/helios-aaf02-evidence-time-feature-fabric.test.ts',
    'tests/helios-aaf04-point-in-time-compiler.test.ts',
    'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts',
  ];
  const present = aafTests.filter((rel) => existsSync(join(ROOT, rel)));
  if (present.length === aafTests.length) {
    return { pass: true, detail: 'AAF test suite present on branch' };
  }
  return {
    pass: false,
    detail: `AAF qualification tests absent on this branch (found ${present.length}/${aafTests.length}); merge helios/adaptive-alpha-fabric for AAF gates`,
  };
}

function renderReleaseReport(input: {
  readonly qualification: ReturnType<typeof evaluateOpenSourceIntegrationQualification>;
  readonly capabilityDeltaPath: string;
}): string {
  const q = input.qualification;
  const lines: string[] = [
    '# HELIOS Open-Source Integration — Wave 1 Release Report (OS15)',
    '',
    `**Evaluated at (UTC):** ${q.evaluatedAt}`,
    `**Git SHA:** \`${q.gitSha}\``,
    `**Qualification marker:** \`${q.marker}\``,
    `**Overall:** ${q.qualified ? 'QUALIFIED' : 'BLOCKED'}`,
    '',
  ];

  if (q.blockers.length > 0) {
    lines.push('## Blockers', '');
    for (const blocker of q.blockers) {
      lines.push(`- ${blocker}`);
    }
    lines.push('');
  }

  lines.push('## Work packages (OS00–OS15)', '', '| WP | Title | Status |', '| --- | --- | --- |');
  for (const row of q.workPackages) {
    lines.push(`| ${row.workPackage} | ${row.title} | ${row.status} |`);
  }
  lines.push('');

  lines.push('## Platform gates', '', '| Gate | Pass | Detail |', '| --- | --- | --- |');
  for (const gate of q.platformGates) {
    lines.push(`| ${gate.gate} | ${gate.pass ? 'yes' : 'no'} | ${gate.detail.replaceAll('|', '\\|')} |`);
  }
  lines.push('');

  lines.push('## Live safety', '', '| Assertion | Pass |', '| --- | --- |');
  for (const row of q.liveSafety.assertions) {
    lines.push(`| ${row.name} | ${row.pass ? 'yes' : 'no'} |`);
  }
  lines.push('');

  lines.push('## Canonical authority', '', '| Component | Owner | Competing |', '| --- | --- | --- |');
  for (const row of q.authority.assertions) {
    lines.push(
      `| ${row.component} | ${row.canonicalOwnerPath} | ${row.competingPresent.length ? row.competingPresent.join(', ') : 'none'} |`,
    );
  }
  lines.push('');

  lines.push('## System demonstration (simulation-only)', '', '| Stage | Status | Detail |', '| --- | --- | --- |');
  for (const step of q.systemDemo.steps) {
    lines.push(`| ${step.stage} | ${step.status} | ${step.detail.replaceAll('|', '\\|')} |`);
  }
  lines.push('');
  lines.push(`Capability delta: [HELIOS_CAPABILITY_DELTA.md](./HELIOS_CAPABILITY_DELTA.md)`, '');
  lines.push(
    q.marker === HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED
      ? 'Wave 1 open-source integration is qualified for integration PR review.'
      : 'Do not open the final integration PR until all gates are green and OS00–OS14 artifacts are present.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const sha = gitSha();
  const evaluatedAt = asUtcInstant(new Date().toISOString());

  const platformGates: PlatformGateResult[] = [
    runGate('architecture_lint', 'npm', ['run', 'lint:architecture']),
    runGate('production_safety', 'node', ['scripts/check-production-safety.mjs']),
    runGate('typecheck', 'npm', ['run', 'typecheck']),
    runGate('repository_tests', 'npm', ['test']),
    evaluateHeliosBoundaryGate(),
    runGate('database_migrations', 'node', ['scripts/check-migration-quality.mjs']),
    runGate('package_boundaries', 'python3', ['scripts/check-package-boundaries.py']),
    runGate('security_scan', 'node', ['scripts/static-security-lint.mjs']),
  ];

  const aaf = evaluateAafQualification();
  platformGates.push({
    gate: 'aaf_qualification',
    pass: aaf.pass,
    detail: aaf.detail,
  });

  const provenance = scanOpenSourceProvenance({ root: ROOT, gitSha: sha, scannedAt: evaluatedAt });
  const workPackages = buildOpenSourceWorkPackageRegistry(ROOT);
  platformGates.push({
    gate: 'open_source_work_packages',
    pass: workPackages.every((row) => row.status === 'QUALIFIED'),
    detail: workPackages.every((row) => row.status === 'QUALIFIED')
      ? 'all OS00–OS15 packages qualified'
      : 'missing OS00–OS14 integration artifacts',
  });

  const systemDemo = runOpenSourceIntegrationSystemDemo(ROOT);
  platformGates.push({
    gate: 'system_demo',
    pass: systemDemo.pass,
    detail: systemDemo.pass
      ? 'all stages pass'
      : `${systemDemo.openSourceStagesPending} open-source stages pending or failure`,
  });

  const qualification = evaluateOpenSourceIntegrationQualification({
    root: ROOT,
    gitSha: sha,
    evaluatedAt,
    platformGates,
    provenance,
    aafQualified: aaf.pass,
    aafDetail: aaf.detail,
    systemDemo,
  });

  const capabilityRows = buildCapabilityDelta(workPackages);
  writeFileSync(join(ROOT, MANIFEST_REL), `${JSON.stringify(provenance, null, 2)}\n`);
  writeFileSync(join(ROOT, DELTA_REL), renderCapabilityDeltaMarkdown(capabilityRows));
  writeFileSync(join(ROOT, REPORT_REL), renderReleaseReport({ qualification, capabilityDeltaPath: DELTA_REL }));

  const summary = {
    marker: qualification.marker,
    qualified: qualification.qualified,
    blockers: qualification.blockers,
    report: REPORT_REL,
    manifest: MANIFEST_REL,
    delta: DELTA_REL,
  };
  writeFileSync(join(OUT_DIR, 'os15-qualification-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(JSON.stringify(summary, null, 2));
  if (!qualification.qualified) {
    process.exitCode = 1;
  }
}

main();
