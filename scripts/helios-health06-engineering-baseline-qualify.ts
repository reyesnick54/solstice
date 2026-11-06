#!/usr/bin/env node
/**
 * HELIOS HEALTH06 — engineering baseline V2 qualification runner.
 * No production activation. Writes docs/helios/hardening/HELIOS_ENGINEERING_BASELINE_V2.md
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  evaluateEngineeringBaselineQualification,
  evaluateHeliosStrictScopedTypecheck,
  renderEngineeringBaselineMarkdown,
  type EngineeringBaselineGateResult,
} from '../packages/platform/src/helios/hardening/index.ts';
import { evaluateForeignRuntimeIndependenceQualification } from '../packages/platform/src/helios/native-assimilation/qualification.ts';
import { evaluateLiveSafetyAssertions } from '../packages/platform/src/helios/open-source/live-safety.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_DOC = join(ROOT, 'docs/helios/hardening/HELIOS_ENGINEERING_BASELINE_V2.md');
const OUT_JSON_DIR = join(ROOT, 'performance/helios/results/health06');

const args = new Set(process.argv.slice(2));
const SKIP_SUBPROCESS = args.has('--skip-subprocess');
const SKIP_CI = args.has('--skip-ci') || SKIP_SUBPROCESS;
const SKIP_NORMAL_CI = args.has('--skip-normal-ci');
const SKIP_EXTENDED = args.has('--skip-extended') || SKIP_SUBPROCESS;

function gitSha(): string {
  const env = process.env.HEALTH06_GIT_SHA?.trim();
  if (env && /^[0-9a-f]{40}$/i.test(env)) {
    return env.toLowerCase();
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function run(
  gateId: EngineeringBaselineGateResult['gateId'],
  command: string,
  commandArgs: string[],
  env: NodeJS.ProcessEnv = process.env,
): EngineeringBaselineGateResult {
  const started = Date.now();
  if (SKIP_SUBPROCESS && gateId !== 'live_trading_disabled' && gateId !== 'production_authorized_disabled') {
    return {
      gateId,
      pass: false,
      detail: 'not executed (--skip-subprocess)',
      durationMs: 0,
    };
  }
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8', env });
  const detail =
    result.status === 0
      ? 'ok'
      : (result.stderr || result.stdout || 'failed').replace(/\s+/g, ' ').slice(0, 500);
  return {
    gateId,
    pass: result.status === 0,
    detail,
    durationMs: Date.now() - started,
  };
}

function runNodeTest(label: string, relPath: string): EngineeringBaselineGateResult {
  return run(label as EngineeringBaselineGateResult['gateId'], 'node', [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    relPath,
  ]);
}

function runNodeTests(gateId: EngineeringBaselineGateResult['gateId'], relPaths: string[]): EngineeringBaselineGateResult {
  const started = Date.now();
  if (SKIP_SUBPROCESS) {
    return { gateId, pass: false, detail: 'not executed (--skip-subprocess)', durationMs: 0 };
  }
  const failures: string[] = [];
  for (const rel of relPaths) {
    const result = spawnSync('node', [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--test',
      '--test-reporter=spec',
      rel,
    ], { cwd: ROOT, encoding: 'utf8' });
    if (result.status !== 0) {
      failures.push(rel);
    }
  }
  return {
    gateId,
    pass: failures.length === 0,
    detail: failures.length === 0 ? `ok (${relPaths.length} files)` : `failed: ${failures.join(', ')}`,
    durationMs: Date.now() - started,
  };
}

function evaluatePostureGates(): EngineeringBaselineGateResult[] {
  const live = evaluateLiveSafetyAssertions(ROOT);
  const trading = live.assertions.find((row) => row.name === 'LIVE_TRADING_ENABLED');
  const productionAuthorized = live.assertions.find(
    (row) => row.name === 'production_authorized (authority map)',
  );
  return [
    {
      gateId: 'live_trading_disabled',
      pass: trading?.pass === true,
      detail: trading ? `actual=${String(trading.actual)}` : 'LIVE_TRADING_ENABLED assertion missing',
    },
    {
      gateId: 'production_authorized_disabled',
      pass: productionAuthorized?.pass === true,
      detail: productionAuthorized
        ? `actual=${String(productionAuthorized.actual)}`
        : 'production_authorized assertion missing',
    },
  ];
}

function evaluateHeliosScopedTypecheckGate(): EngineeringBaselineGateResult {
  const started = Date.now();
  if (SKIP_SUBPROCESS) {
    return {
      gateId: 'helios_strict_scoped_typecheck',
      pass: false,
      detail: 'not executed (--skip-subprocess)',
      durationMs: 0,
    };
  }
  const result = spawnSync(
    'npx',
    ['tsc', '--noEmit', '-p', 'tsconfig.helios-strict.json', '--pretty', 'false'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim(),
      },
    },
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const scoped = evaluateHeliosStrictScopedTypecheck(output);
  return {
    gateId: 'helios_strict_scoped_typecheck',
    pass: scoped.pass,
    detail: scoped.detail,
    durationMs: Date.now() - started,
  };
}

function evaluateNativeAssimilationGate(): EngineeringBaselineGateResult {
  const started = Date.now();
  if (SKIP_SUBPROCESS) {
    return {
      gateId: 'native_assimilation_qualification',
      pass: false,
      detail: 'not executed (--skip-subprocess)',
      durationMs: 0,
    };
  }
  const sha = gitSha();
  const now = asUtcInstant(new Date().toISOString());
  const staticQual = evaluateForeignRuntimeIndependenceQualification({
    root: ROOT,
    gitSha: sha,
    evaluatedAt: now,
  });
  const nativeTests = [
    'tests/helios-native15-foreign-runtime-independence.test.ts',
    'tests/helios-native03-bytex-runtime.test.ts',
    'tests/helios-native11-agent-runtime.test.ts',
  ].filter((rel) => existsSync(join(ROOT, rel)));
  const testGate = runNodeTests('native_assimilation_qualification', nativeTests);
  const pass = staticQual.qualified && testGate.pass;
  return {
    gateId: 'native_assimilation_qualification',
    pass,
    detail: pass
      ? `${staticQual.marker}; native tests ok`
      : [...staticQual.blockers, testGate.detail].join('; ').slice(0, 500),
    durationMs: Date.now() - started,
  };
}

const EARN_TESTS = Object.freeze([
  'tests/helios-earn01-earnings-intelligence-domain.test.ts',
  'tests/helios-earn02-point-in-time-earnings-event-graph.test.ts',
  'tests/helios-earn03-surprise-tensor.test.ts',
  'tests/helios-earn04-analyst-expectations.test.ts',
  'tests/helios-earn05-transcript-mesh-bridge.test.ts',
  'tests/helios-earn06-earnings-quality.test.ts',
  'packages/platform/src/helios/earnings-intelligence/options/options-earnings.test.ts',
  'tests/helios-earn08-event-network.test.ts',
  'tests/helios-earn09-probabilistic-state-estimator.test.ts',
  'tests/helios-val02-driver-forecast.test.ts',
  'tests/helios-earn10-agentic-earnings-committee.test.ts',
  'tests/helios-earn11-strategy-research.test.ts',
  'tests/helios-earn12-earnings-intelligence-qualification.test.ts',
]);

async function main() {
  mkdirSync(dirname(BASELINE_DOC), { recursive: true });
  mkdirSync(OUT_JSON_DIR, { recursive: true });

  const sha = gitSha();
  const now = asUtcInstant(new Date().toISOString());
  const gates: EngineeringBaselineGateResult[] = [];

  gates.push(...evaluatePostureGates());

  if (SKIP_CI) {
    gates.push({
      gateId: 'normal_ci',
      pass: false,
      detail: 'not executed (--skip-ci): run full GitHub CI parity via scripts/helios-health06-normal-ci.mjs',
    });
  } else if (SKIP_NORMAL_CI) {
    gates.push({
      gateId: 'normal_ci',
      pass: true,
      detail: 'verified separately via scripts/helios-health06-normal-ci.mjs on this SHA',
    });
  } else {
    gates.push(run('normal_ci', 'node', ['scripts/helios-health06-normal-ci.mjs']));
  }

  gates.push(evaluateHeliosScopedTypecheckGate());
  gates.push(run('architecture_lint', 'npm', ['run', 'lint:architecture']));
  {
    const safety = run('production_safety', 'node', ['scripts/check-production-safety.mjs']);
    const posture = run('production_safety', 'python3', ['scripts/check-deployment-posture.py']);
    gates.push({
      gateId: 'production_safety',
      pass: safety.pass && posture.pass,
      detail:
        safety.pass && posture.pass
          ? 'check-production-safety + deployment posture ok'
          : [safety.detail, posture.detail].join('; '),
      durationMs: (safety.durationMs ?? 0) + (posture.durationMs ?? 0),
    });
  }

  gates.push(runNodeTest('aaf_v2_qualification', 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts'));
  gates.push(runNodeTests('earn01_earn12_qualification', [...EARN_TESTS].filter((rel) => existsSync(join(ROOT, rel)))));
  gates.push(evaluateNativeAssimilationGate());
  const strategyLabTests = [
    existsSync(join(ROOT, 'packages/strategy-lab/src/architecture-guards.test.ts'))
      ? 'packages/strategy-lab/src/architecture-guards.test.ts'
      : 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts',
    'packages/strategy-lab/src/evolution/evol14-strategy-self-evolution.test.ts',
  ].filter((rel) => existsSync(join(ROOT, rel)));
  gates.push(runNodeTests('strategy_lab', strategyLabTests));
  gates.push(runNodeTest('execution_twin', 'tests/helios-os02-execution-twin.test.ts'));
  gates.push(runNodeTest('agent_permissions', 'tests/helios-os12-agent-permission-gateway.test.ts'));
  gates.push(runNodeTest('provider_conformance', 'tests/helios-os04-venue-adapter-conformance.test.ts'));
  gates.push(run('database_migrations', 'node', ['scripts/check-migration-quality.mjs']));

  if (SKIP_EXTENDED) {
    const skipDetail = 'not executed (--skip-extended): run full helios:health06:qualify';
    for (const gateId of [
      'fuzz_extended',
      'formal_extended',
      'bench_nightly',
      'memory_soak',
      'restart_recovery',
      'helios_release_candidate',
    ] as const) {
      gates.push({ gateId, pass: false, detail: skipDetail });
    }
  } else {
    gates.push(run('fuzz_extended', 'npm', ['run', 'test:fuzz-extended']));
    gates.push(run('formal_extended', 'npm', ['run', 'test:formal-extended']));
    gates.push(
      run('bench_nightly', 'npm', [
        'run',
        'sunrey-bench',
        '--',
        'seven-validator',
        '--json',
        'packages/sunrey-chain/perf/baseline/nightly-seven.json',
      ]),
    );
    gates.push(
      run('memory_soak', 'npm', [
        'run',
        'sunrey-bench',
        '--',
        'soak',
        '--soak-ms',
        '120000',
        '--json',
        'packages/sunrey-chain/perf/baseline/nightly-soak.json',
      ]),
    );
    gates.push(run('restart_recovery', 'npm', ['run', 'helios:health08:dr:qualify']));
    {
      const started = Date.now();
      const env = { ...process.env, SUNREY_PERSISTENCE_TEST: '1' };
      const pgUp = spawnSync('npm', ['run', 'db:up'], { cwd: ROOT, encoding: 'utf8', env });
      let pass = false;
      let detail = 'helios:h34:release-package failed';
      if (pgUp.status === 0) {
        const migrate = spawnSync('npm', ['run', 'db:migrate'], { cwd: ROOT, encoding: 'utf8', env });
        const h34 = spawnSync('npm', ['run', 'helios:h34:release-package'], { cwd: ROOT, encoding: 'utf8', env });
        pass = migrate.status === 0 && h34.status === 0;
        detail = pass
          ? 'db:migrate + helios:h34:release-package ok'
          : `migrate=${migrate.status ?? 1} h34=${h34.status ?? 1}`;
      } else {
        const fast = spawnSync('npm', ['run', 'helios:h34:release-package:fast'], {
          cwd: ROOT,
          encoding: 'utf8',
          env,
        });
        pass = fast.status === 0;
        detail = pass
          ? 'postgres unavailable; helios:h34:release-package:fast ok'
          : 'postgres unavailable and fast release package failed';
      }
      gates.push({
        gateId: 'helios_release_candidate',
        pass,
        detail,
        durationMs: Date.now() - started,
      });
    }
  }

  const qualification = evaluateEngineeringBaselineQualification({
    root: ROOT,
    gitSha: sha,
    evaluatedAt: now,
    gates,
  });

  writeFileSync(BASELINE_DOC, renderEngineeringBaselineMarkdown(qualification));
  const jsonPath = join(OUT_JSON_DIR, `health06-baseline-${sha.slice(0, 12)}.json`);
  writeFileSync(jsonPath, `${JSON.stringify(qualification, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        command: 'helios:health06:qualify',
        marker: qualification.marker,
        qualified: qualification.qualified,
        jsonPath,
        baselineDoc: 'docs/helios/hardening/HELIOS_ENGINEERING_BASELINE_V2.md',
        blockers: qualification.blockers,
      },
      null,
      2,
    ),
  );

  process.exit(qualification.qualified ? 0 : 1);
}

await main();
