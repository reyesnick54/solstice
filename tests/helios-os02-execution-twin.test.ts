/**
 * HELIOS OS02 — deterministic execution twin qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  ExecutionTwinRuntime,
  HELIOS_OS02_EXECUTION_TWIN,
  HELIOS_OS02_EXECUTION_TWIN_QUALIFIED,
  createExecutionTwinProvider,
  evaluateOs02ExecutionTwinQualification,
  fixtureExecutionTwinRunInput,
  defaultExecutionTwinPorts,
  historicalReplayPortFrom,
  strategyCapsuleUnchangedAcrossManifests,
  type ExecutionTwinEnvironmentKind,
} from '../packages/platform/src/helios/execution-twin/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ENVIRONMENTS_FOR_PARITY: readonly ExecutionTwinEnvironmentKind[] = Object.freeze([
  'HISTORICAL_REPLAY',
  'SHADOW',
  'PAPER',
  'SANDBOX_LIVE_DATA',
]);

function runTwin(environment: ExecutionTwinEnvironmentKind, runId: string, seed = 'seed_os02_deterministic') {
  const runtime = new ExecutionTwinRuntime({
    clock: new FrozenClock(fixtureExecutionTwinRunInput().orderPlanning.now),
    ports: defaultExecutionTwinPorts(),
    startAt: fixtureExecutionTwinRunInput().orderPlanning.now,
  });
  return runtime.run(
    fixtureExecutionTwinRunInput({
      runId,
      environment,
      randomSeed: seed,
    }),
  );
}

describe('HELIOS OS02 — Execution Twin', () => {
  it('architecture guard: execution-twin extends canonical helios owner', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) => row.file.includes('helios/execution-twin'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
    assert.equal(HELIOS_OS02_EXECUTION_TWIN, 'HELIOS_OS02_EXECUTION_TWIN');
  });

  it('production safety: LIVE flags remain disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
  });

  it('repeated replay is deterministic for the same environment', () => {
    const first = runTwin('HISTORICAL_REPLAY', 'run_det_a');
    const second = runTwin('HISTORICAL_REPLAY', 'run_det_b');
    assert.equal(first.lastOutcomeFingerprint, second.lastOutcomeFingerprint);
    assert.equal(first.orderState, second.orderState);
    assert.equal(first.manifest.grantsExecutionAuthority, false);
    assert.equal(first.manifest.liveFlagsActive, false);
  });

  it('strategy capsule and feature manifest unchanged across environments', () => {
    const manifests = ENVIRONMENTS_FOR_PARITY.map((environment, index) =>
      runTwin(environment, `run_capsule_${index}`).manifest,
    );
    for (let i = 1; i < manifests.length; i += 1) {
      assert.ok(
        strategyCapsuleUnchangedAcrossManifests(manifests[0]!, manifests[i]!),
        `capsule mismatch at index ${i}`,
      );
    }
  });

  it('historical replay cannot invoke live provider APIs', () => {
    const provider = createExecutionTwinProvider({
      environment: 'HISTORICAL_REPLAY',
      randomSeed: 'seed_hist',
      now: fixtureExecutionTwinRunInput().orderPlanning.now,
    });
    const historical = historicalReplayPortFrom(provider);
    assert.ok(historical);
    assert.throws(() => historical!.invokeLiveProviderApiForTest(), /HISTORICAL_REPLAY_LIVE_API_FORBIDDEN/);
    assert.throws(() => historical!.submit({} as never), /HISTORICAL_REPLAY_LIVE_API_FORBIDDEN/);
  });

  it('risk rejection is identical across environments when inputs match', () => {
    const blockedPorts = defaultExecutionTwinPorts({
      risk: {
        evaluate: (ctx) =>
          Object.freeze({
            permitted: false,
            reason: 'position_cap',
            digest: `risk_${ctx.capsuleHash.slice(0, 8)}`,
          }),
      },
    });
    const digests = ENVIRONMENTS_FOR_PARITY.map((environment, index) => {
      const runtime = new ExecutionTwinRuntime({
        clock: new FrozenClock(fixtureExecutionTwinRunInput().orderPlanning.now),
        ports: blockedPorts,
        startAt: fixtureExecutionTwinRunInput().orderPlanning.now,
      });
      const snapshot = runtime.run(
        fixtureExecutionTwinRunInput({
          runId: `run_risk_${index}`,
          environment,
        }),
      );
      const riskEvent = snapshot.events.find((row) => row.kind === 'RISK_CHECK');
      assert.ok(riskEvent);
      return riskEvent!.payloadDigest;
    });
    assert.ok(digests.every((digest) => digest === digests[0]));
  });

  it('records environment-specific assumptions in the run manifest', () => {
    const historical = runTwin('HISTORICAL_REPLAY', 'run_assump_hist').manifest;
    const sandbox = runTwin('SANDBOX_LIVE_DATA', 'run_assump_sandbox').manifest;
    assert.ok(historical.assumptions.some((row) => row.value.includes('recorded')));
    assert.ok(sandbox.assumptions.some((row) => row.label === 'observation_source'));
    assert.notEqual(historical.providerKind, sandbox.providerKind);
  });

  it('restart/resume preserves completed run state', () => {
    const runtime = new ExecutionTwinRuntime({
      clock: new FrozenClock(fixtureExecutionTwinRunInput().orderPlanning.now),
      ports: defaultExecutionTwinPorts(),
      startAt: fixtureExecutionTwinRunInput().orderPlanning.now,
    });
    const input = fixtureExecutionTwinRunInput({ runId: 'run_resume', environment: 'PAPER' });
    const first = runtime.run(input);
    const resumed = runtime.resume('run_resume', input);
    assert.equal(resumed.lastOutcomeFingerprint, first.lastOutcomeFingerprint);
    assert.equal(resumed.stepIndex, first.stepIndex);
    assert.equal(resumed.state, 'COMPLETED');
  });

  it('LIVE environment is rejected at runtime gate', () => {
    const runtime = new ExecutionTwinRuntime({
      clock: new FrozenClock(fixtureExecutionTwinRunInput().orderPlanning.now),
      ports: defaultExecutionTwinPorts(),
      startAt: fixtureExecutionTwinRunInput().orderPlanning.now,
    });
    assert.throws(
      () =>
        runtime.run(
          fixtureExecutionTwinRunInput({
            runId: 'run_live_blocked',
            environment: 'LIVE',
          }),
        ),
      /LIVE execution twin environment is disabled/,
    );
  });

  it('HELIOS_OS02_EXECUTION_TWIN_QUALIFIED when qualification checks pass', () => {
    const replayDeterministic =
      runTwin('SANDBOX_LIVE_DATA', 'q_run_a').lastOutcomeFingerprint ===
      runTwin('SANDBOX_LIVE_DATA', 'q_run_b').lastOutcomeFingerprint;

    const manifests = ENVIRONMENTS_FOR_PARITY.map((environment, index) =>
      runTwin(environment, `q_capsule_${index}`).manifest,
    );
    const capsuleUnchanged = manifests.every((manifest) =>
      strategyCapsuleUnchangedAcrossManifests(manifests[0]!, manifest),
    );

    const historicalProvider = createExecutionTwinProvider({
      environment: 'HISTORICAL_REPLAY',
      randomSeed: 'q',
      now: fixtureExecutionTwinRunInput().orderPlanning.now,
    });
    const historical = historicalReplayPortFrom(historicalProvider);
    let historicalBlocksLive = false;
    try {
      historical!.invokeLiveProviderApiForTest();
    } catch {
      historicalBlocksLive = true;
    }

    const blockedPorts = defaultExecutionTwinPorts({
      risk: {
        evaluate: () =>
          Object.freeze({
            permitted: false,
            reason: 'blocked',
            digest: 'same_digest',
          }),
      },
    });
    const riskDigests = ENVIRONMENTS_FOR_PARITY.map((environment, index) => {
      const runtime = new ExecutionTwinRuntime({
        clock: new FrozenClock(fixtureExecutionTwinRunInput().orderPlanning.now),
        ports: blockedPorts,
        startAt: fixtureExecutionTwinRunInput().orderPlanning.now,
      });
      return runtime.run(fixtureExecutionTwinRunInput({ runId: `q_risk_${index}`, environment })).events.find(
        (row) => row.kind === 'RISK_CHECK',
      )!.payloadDigest;
    });
    const riskParity = riskDigests.every((digest) => digest === riskDigests[0]);

    const assumptionsExplicit =
      runTwin('HISTORICAL_REPLAY', 'q_assump').manifest.assumptions.length > 0 &&
      runTwin('SHADOW', 'q_assump_shadow').manifest.assumptions.length > 0;

    const runtime = new ExecutionTwinRuntime({
      clock: new FrozenClock(fixtureExecutionTwinRunInput().orderPlanning.now),
      ports: defaultExecutionTwinPorts(),
      startAt: fixtureExecutionTwinRunInput().orderPlanning.now,
    });
    const input = fixtureExecutionTwinRunInput({ runId: 'q_resume', environment: 'PAPER' });
    const completed = runtime.run(input);
    const resumed = runtime.resume('q_resume', input);
    const resumeOk =
      resumed.lastOutcomeFingerprint === completed.lastOutcomeFingerprint && resumed.state === 'COMPLETED';

    const result = evaluateOs02ExecutionTwinQualification({
      replayDeterministic,
      capsuleUnchangedAcrossEnvironments: capsuleUnchanged,
      historicalBlocksLiveProviderApi: historicalBlocksLive,
      riskRejectionParity: riskParity,
      assumptionsExplicitInManifest: assumptionsExplicit,
      restartResumePreservesState: resumeOk,
      liveFlagsInactive: !LIVE_TRADING_ENABLED && !LIVE_INVESTMENT_EXECUTION,
    });

    assert.equal(result.marker, HELIOS_OS02_EXECUTION_TWIN_QUALIFIED, result.blockers.join('; '));
  });
});
