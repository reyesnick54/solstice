#!/usr/bin/env node
/**
 * Wave 6 Prompt 18 — canonical local release qualification gate.
 *
 * Orchestrates deterministic repository gates that can run in CI or on a
 * developer machine. External evidence (pentest, audit, live providers,
 * regulatory approval) is recorded as EXTERNAL_REQUIRED and does not pass
 * automatically.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkJsonIntegrity } from './check-json-integrity.mjs';
import { checkMergeIntegrity } from './check-merge-integrity.mjs';
import { checkYamlIntegrity } from './check-yaml-integrity.mjs';
import { checkAuthorityMap } from './check-authority-map.mjs';
import { checkArchitectureFreeze } from './check-architecture-freeze.mjs';
import { checkProductionSafety } from './check-production-safety.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUALIFICATION_REL = 'release/qualification.json';
const RC_ID = 'sunrey-platform-wave6-prompt18-rc.1';

function git(cmd) {
  const result = spawnSync('git', cmd, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }
  return (result.stdout ?? '').trim();
}

function runNpm(script, args = []) {
  const started = Date.now();
  const result = spawnSync('npm', ['run', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
  return {
    command: `npm run ${script}${args.length ? ` -- ${args.join(' ')}` : ''}`,
    status: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-20).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-20).join('\n'),
  };
}

function runNode(scriptRel, args = []) {
  const started = Date.now();
  const result = spawnSync('node', [join(ROOT, scriptRel), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    command: `node ${scriptRel}${args.length ? ` ${args.join(' ')}` : ''}`,
    status: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-20).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-20).join('\n'),
  };
}

function runPython(scriptRel) {
  const started = Date.now();
  const result = spawnSync('python3', [join(ROOT, scriptRel)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    command: `python3 ${scriptRel}`,
    status: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-20).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-20).join('\n'),
  };
}

function gateStatus(passed, external = false) {
  if (external) return 'EXTERNAL_REQUIRED';
  return passed ? 'PASS' : 'FAIL';
}

function classifyGate(id, passed, { mandatory = true, external = false, skipped = false } = {}) {
  if (skipped) {
    return { id, status: 'SKIPPED', mandatory, passed: null };
  }
  if (external) {
    return { id, status: 'EXTERNAL_REQUIRED', mandatory: false, passed: null };
  }
  return { id, status: passed ? 'PASS' : 'FAIL', mandatory, passed };
}

export function buildQualificationManifest({ gates, release }) {
  const mandatoryFailures = gates.filter((g) => g.mandatory && g.status === 'FAIL');
  const overall =
    mandatoryFailures.length > 0
      ? 'NO_GO'
      : gates.some((g) => g.status === 'EXTERNAL_REQUIRED')
        ? 'CONDITIONAL_GO'
        : 'GO';

  return {
    schema: 'sunrey.release.qualification.v1',
    release,
    system: 'sunrey-platform',
    status: overall,
    evaluatedAtUtc: new Date().toISOString(),
    gates,
    mandatoryFailureCount: mandatoryFailures.length,
    evidence: {
      report: 'docs/qualification/PRODUCTION_READINESS_REPORT.md',
      buildStatus: 'docs/build-status.md',
      providerScorecard: 'docs/providers/PRODUCTION_READINESS_SCORECARD.md',
      backendRc: 'docs/productization/PHASE_I_06_BACKEND_RC_QUALIFICATION.md',
      performanceBaseline: 'packages/sunrey-chain/perf/baseline/manifest.json',
      securityAuditReadiness: 'docs/audit/README.md',
    },
    environment: {
      ENVIRONMENT: 'simulation',
      PRODUCTION_READY: false,
      PRODUCTION_ACTIVE: false,
      LIVE_CONNECTIVITY_ENABLED: false,
      PRODUCTION_HSM_KMS_CONFIGURED: false,
      productionAuthorized: false,
    },
    externalDependencies: [
      { id: 'external-security-audit', status: 'EXTERNAL_REQUIRED' },
      { id: 'external-pentest', status: 'EXTERNAL_REQUIRED' },
      { id: 'external-cryptography-review', status: 'EXTERNAL_REQUIRED' },
      { id: 'provider-live-validation', status: 'EXTERNAL_REQUIRED' },
      { id: 'regulatory-legal-approval', status: 'EXTERNAL_REQUIRED' },
      { id: 'production-hsm-kms', status: 'EXTERNAL_REQUIRED' },
      { id: 'hosted-preproduction-cluster', status: 'EXTERNAL_REQUIRED' },
    ],
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const skipSlow = args.has('--skip-slow');
  const skipTests = args.has('--skip-tests');

  const release = {
    id: RC_ID,
    commitSha: git(['rev-parse', 'HEAD']),
    branch: git(['branch', '--show-current']),
    dateUtc: new Date().toISOString().slice(0, 10),
    version: '0.1.0',
  };

  const gates = [];
  let failed = false;

  console.log(`[RELEASE] qualifying ${release.id} @ ${release.commitSha}`);

  function pass(findings) {
    return Array.isArray(findings) && findings.length === 0;
  }

  // Wave 1 integrity
  const json = checkJsonIntegrity(ROOT);
  gates.push(classifyGate('json-integrity', pass(json.findings)));
  if (!pass(json.findings)) failed = true;

  const merge = checkMergeIntegrity(ROOT);
  gates.push(classifyGate('merge-integrity', pass(merge.findings)));
  if (!pass(merge.findings)) failed = true;

  const yaml = checkYamlIntegrity(ROOT);
  gates.push(classifyGate('yaml-integrity', pass(yaml.findings)));
  if (!pass(yaml.findings)) failed = true;

  const authority = checkAuthorityMap(ROOT);
  gates.push(classifyGate('authority-map', pass(authority.findings)));
  if (!pass(authority.findings)) failed = true;

  const freeze = checkArchitectureFreeze(ROOT);
  gates.push(classifyGate('architecture-freeze', pass(freeze.findings)));
  if (!pass(freeze.findings)) failed = true;

  const safety = checkProductionSafety(ROOT);
  gates.push(classifyGate('production-safety', pass(safety.findings)));
  if (!pass(safety.findings)) failed = true;

  const posture = runPython('scripts/check-deployment-posture.py');
  gates.push(classifyGate('deployment-posture', posture.status === 0));
  if (posture.status !== 0) failed = true;

  const invariants = runPython('scripts/lint-architectural-invariants.py');
  gates.push(classifyGate('architectural-invariants', invariants.status === 0));
  if (invariants.status !== 0) failed = true;

  const extraction = runPython('scripts/extraction-dryrun.py');
  gates.push(classifyGate('extraction-dryrun', extraction.status === 0));
  if (extraction.status !== 0) failed = true;

  const archLint = runNpm('lint:architecture');
  gates.push(classifyGate('lint-architecture', archLint.status === 0));
  if (archLint.status !== 0) failed = true;

  const kernel = runNpm('gate');
  gates.push(classifyGate('kernel-gating', kernel.status === 0));
  if (kernel.status !== 0) failed = true;

  const typecheck = runNpm('typecheck');
  gates.push(classifyGate('typescript', typecheck.status === 0));
  if (typecheck.status !== 0) failed = true;

  const migrations = runNode('scripts/check-migration-quality.mjs');
  gates.push(classifyGate('migration-quality', migrations.status === 0));
  if (migrations.status !== 0) failed = true;

  const provider = runNpm('provider:certify');
  gates.push(classifyGate('provider-certify-sandbox', provider.status === 0));
  if (provider.status !== 0) failed = true;

  if (!skipSlow) {
    const bench = runNpm('sunrey-bench', ['sanity']);
    gates.push(classifyGate('performance-sanity-bench', bench.status === 0));
    if (bench.status !== 0) failed = true;
  } else {
    gates.push(classifyGate('performance-sanity-bench', true, { skipped: true }));
  }

  if (!skipTests) {
    const tests = runNpm('test');
    gates.push(classifyGate('unit-integration-tests', tests.status === 0));
    if (tests.status !== 0) failed = true;
  } else {
    gates.push(classifyGate('unit-integration-tests', true, { skipped: true }));
  }

  // External evidence — never auto-pass
  for (const id of [
    'external-security-audit',
    'external-pentest',
    'external-cryptography-review',
    'provider-live-validation',
    'regulatory-legal-approval',
    'production-hsm-kms',
    'hosted-preproduction-soak',
  ]) {
    gates.push(classifyGate(id, false, { mandatory: false, external: true }));
  }

  const manifest = buildQualificationManifest({ gates, release });
  const outPath = join(ROOT, QUALIFICATION_REL);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`[RELEASE] wrote ${QUALIFICATION_REL}`);
  console.log(`[RELEASE] overall=${manifest.status} mandatoryFailures=${manifest.mandatoryFailureCount}`);

  for (const gate of gates) {
    console.log(`  ${gate.id}: ${gate.status}`);
  }

  if (failed) {
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
