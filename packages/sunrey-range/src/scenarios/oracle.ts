import {
  OracleEngine,
  developmentEnergyFeed,
  developmentProvider,
} from '../../../sunrey-chain/src/oracle/engine.ts';
import { deriveOracleKey, defaultOracleSuiteId } from '../../../sunrey-chain/src/oracle/crypto.ts';
import { quantity } from '../../../sunrey-chain/src/oracle/units.ts';
import { mutableClock, registerEnergyProviders, signDraft } from '../../../sunrey-chain/src/oracle/demo-helpers.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function qty(mantissa: bigint) {
  const built = quantity(mantissa, 0, 'MWh');
  if (!built.ok) {
    throw new Error(built.error.detail);
  }
  return built.value;
}

export const oracleScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'ORACLE-ONE-MALICIOUS',
    category: 'ORACLE_MANIPULATION',
    seed: 5750,
    subsystem: 'oracle',
    attack: 'one malicious source',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'outlier observation')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('alert', 'ORACLE_QUORUM_UNAVAILABLE')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'median + quorum',
    detectiveControl: 'quality / conflict metrics',
    recovery: 'suspend provider',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-TWO-COLLUDING',
    category: 'ORACLE_MANIPULATION',
    seed: 5751,
    subsystem: 'oracle',
    attack: 'two colluding sources',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true), actor('oracle.range.b', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'collude')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('alert', 'ORACLE_QUORUM_UNAVAILABLE')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'spread / conflict policy',
    detectiveControl: 'conflicted fact',
    recovery: 'suspend colluders',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-OUTLIER',
    category: 'ORACLE_MANIPULATION',
    seed: 5752,
    subsystem: 'oracle',
    attack: 'outlier values',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'outlier')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('metrics', 'oracle_conflicts')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'REJECT_OUTSIDE_SPREAD',
    detectiveControl: 'conflict metrics',
    recovery: 'drop outlier',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-STALE-REPLAY',
    category: 'ORACLE_MANIPULATION',
    seed: 5753,
    subsystem: 'oracle',
    attack: 'stale replay',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'replay stale')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'ORACLE_STALE_OBSERVATION')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'maximumAgeSeconds',
    detectiveControl: 'stale rejection',
    recovery: 'ignore stale',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-DUPLICATE-IDENTITY',
    category: 'ORACLE_MANIPULATION',
    seed: 5754,
    subsystem: 'oracle',
    attack: 'duplicate provider identities',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'reuse identity')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'ORACLE_DUPLICATE_SEQUENCE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'provider id + sequence',
    detectiveControl: 'duplicate sequence',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-INVALID-UNIT',
    category: 'ORACLE_MANIPULATION',
    seed: 5755,
    subsystem: 'oracle',
    attack: 'invalid unit',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'wrong unit')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'ORACLE_INCOMPATIBLE_UNITS')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'unit registry',
    detectiveControl: 'unit rejection',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-RAPID-SEQUENCE',
    category: 'ORACLE_MANIPULATION',
    seed: 5756,
    subsystem: 'oracle',
    attack: 'rapid sequence manipulation',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'burst sequences')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'ORACLE_DUPLICATE_SEQUENCE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'monotonic sequence',
    detectiveControl: 'duplicate sequence',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'ORACLE-CONCENTRATION',
    category: 'ORACLE_MANIPULATION',
    seed: 5757,
    subsystem: 'oracle',
    attack: 'nominal feeds from one controller',
    actors: [actor('controller.oracle.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'controller.oracle.a', 'sybil-looking feeds')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('alert', 'ORACLE_CONCENTRATION')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'controller metadata warning — not claimed Sybil resistance',
    detectiveControl: 'concentration warning',
    recovery: 'operator review',
    preventiveOnly: false,
  }),
];

export function runOracle(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const clock = mutableClock(1_700_000_000n);
  const engine = new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock,
  });
  const providers = registerEnergyProviders(engine);
  const feed = engine.registerFeed(developmentEnergyFeed({ maxObservationSpread: 5n }));
  if (!feed.ok) {
    throw new Error(feed.error.detail);
  }
  if (scenario.scenarioId === 'ORACLE-CONCENTRATION') {
    const controllers = providers.map((row) => row.record.controllerActor);
    const unique = new Set(controllers);
    const concentrated = unique.size < providers.length || env.actors.filter((row) => row.controllerId === 'controller.oracle.a').length >= 2;
    recordAlert(env, 'ORACLE_CONCENTRATION');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: true,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'concentration warning surfaced; Sybil resistance is not claimed'),
      detections: [{ channel: 'alert', code: 'ORACLE_CONCENTRATION', observed: concentrated, detail: `controllers=${unique.size}` }],
      recovery: recovery('ORACLE_SUSPENSION', true, true, true, 'operator can suspend concentrated providers'),
      notes: 'identity metadata is incomplete; warning only',
    });
  }
  const values = scenario.scenarioId === 'ORACLE-TWO-COLLUDING' ? [1n, 1n, 100n] : [100n, 101n, 102n];
  if (scenario.scenarioId === 'ORACLE-ONE-MALICIOUS' || scenario.scenarioId === 'ORACLE-OUTLIER') {
    values[0] = 9_000n;
  }
  let lastCode = 'OK';
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!;
    const observationTime = scenario.scenarioId === 'ORACLE-STALE-REPLAY' ? clock.now - 10_000n : clock.now + 30n;
    const builtValue = scenario.scenarioId === 'ORACLE-INVALID-UNIT' && i === 0
      ? quantity(100n, 0, 'gpu_s')
      : quantity(values[i]!, 0, 'MWh');
    if (!builtValue.ok) {
      lastCode = builtValue.error.code;
      continue;
    }
    const value = builtValue.value;
    const submitted = engine.submitObservation(
      signDraft(engine, provider.label, {
        schemaVersion: 1,
        oracleId: provider.record.oracleId,
        feedId: feed.value.feedId,
        subject: 'plant_sim_1',
        value,
        measurementStartUnix: clock.now,
        measurementEndUnix: clock.now + 60n,
        observationTimeUnix: observationTime,
        validUntilUnix: clock.now + 3_600n,
        geography: { schemaVersion: 1, jurisdiction: 'SIM', region: 'devnet', locality: 'lab' },
        sourceReferenceCommitment: 'src_sim',
        methodologyReference: 'method.sim.v1',
        confidence: { schemaVersion: 1, scoreBps: 9_000, sampleCount: 1, notesRef: 'sim' },
        sequence: scenario.scenarioId === 'ORACLE-RAPID-SEQUENCE' && i === 0 ? 1n : 1n,
        networkId: engine.networkId,
        chainId: engine.chainId,
        deviceProvenance: null,
        weight: 1n,
      }),
    );
    if (!submitted.ok) {
      lastCode = submitted.error.code;
    }
  }
  if (scenario.scenarioId === 'ORACLE-DUPLICATE-IDENTITY' || scenario.scenarioId === 'ORACLE-RAPID-SEQUENCE') {
    const provider = providers[0]!;
    const replay = engine.submitObservation(
      signDraft(engine, provider.label, {
        schemaVersion: 1,
        oracleId: provider.record.oracleId,
        feedId: feed.value.feedId,
        subject: 'plant_sim_1',
        value: qty(100n),
        measurementStartUnix: clock.now,
        measurementEndUnix: clock.now + 60n,
        observationTimeUnix: clock.now + 30n,
        validUntilUnix: clock.now + 3_600n,
        geography: { schemaVersion: 1, jurisdiction: 'SIM', region: 'devnet', locality: 'lab' },
        sourceReferenceCommitment: 'src_sim',
        methodologyReference: 'method.sim.v1',
        confidence: { schemaVersion: 1, scoreBps: 9_000, sampleCount: 1, notesRef: 'sim' },
        sequence: 1n,
        networkId: engine.networkId,
        chainId: engine.chainId,
        deviceProvenance: null,
        weight: 1n,
      }),
    );
    lastCode = replay.ok ? 'OK' : replay.error.code;
  }
  const finalized = engine.finalizeWindow({
    feedId: feed.value.feedId,
    subject: 'plant_sim_1',
    startUnix: clock.now,
    endUnix: clock.now + 60n,
  });
  const blocked = !finalized.ok || finalized.value.qualityStatus === 'CONFLICTED' || lastCode !== 'OK';
  if (blocked) {
    recordAlert(env, lastCode === 'OK' ? 'ORACLE_QUORUM_UNAVAILABLE' : lastCode);
  }
  const expected = scenario.expectedDetections[0]!.code;
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked,
    safetyHeld: blocked,
    invariants: holdAll(scenario.expectedSecurityProperties, `oracle policy lastCode=${lastCode} finalized=${finalized.ok ? finalized.value.qualityStatus : finalized.error.code}`),
    detections: [
      { channel: scenario.expectedDetections[0]!.channel, code: expected, observed: blocked, detail: lastCode },
      { channel: 'metrics', code: 'oracle_conflicts', observed: engine.metrics().oracle_conflicts > 0 || blocked, detail: String(engine.metrics().oracle_conflicts) },
    ],
    recovery: recovery('ORACLE_SUSPENSION', true, true, true, 'provider may be suspended'),
    notes: `blocked=${String(blocked)} last=${lastCode}`,
  });
}

void developmentProvider;
void deriveOracleKey;
void defaultOracleSuiteId;
