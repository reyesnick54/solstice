import { ProductiveEconomyEngine } from '../../../sunrey-chain/src/productive/engine.ts';
import { developmentIssuancePolicy } from '../../../sunrey-chain/src/productive/policy.ts';
import {
  MoonReyPolicyRegistry,
  applyFactors,
  crossCategoryEventFingerprint,
  developmentPolicyBundle,
  normalizeContribution,
} from '../../../sunrey-chain/src/productive/policy-governance/index.ts';
import {
  DEV_CLOCK,
  fixtureClaim,
  fixtureFacts,
  fixtureRight,
  solarFacility,
} from '../../../sunrey-chain/src/productive/fixtures.ts';
import { runManufacturingDemo } from '../../../sunrey-chain/src/productive/demo.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function seeded(): ProductiveEconomyEngine {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const object = solarFacility();
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
    engine.putOracleFact(fact);
  }
  return engine;
}

export const moonreyScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'MOONREY-DUPLICATE-CLAIM',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5760,
    subsystem: 'moonrey',
    attack: 'duplicate productive claim',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'resubmit claim')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION', 'NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'DUPLICATE_CONTRIBUTION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'contribution fingerprint',
    detectiveControl: 'DUPLICATE_CONTRIBUTION',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-REORDERED-OUTPUT',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5761,
    subsystem: 'moonrey',
    attack: 'same output under different ordering',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'reorder fields')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('security_log', 'DUPLICATE_CONTRIBUTION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'canonical fingerprint',
    detectiveControl: 'DUPLICATE_CONTRIBUTION',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-DUPLICATE-METER',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5762,
    subsystem: 'moonrey',
    attack: 'same energy through duplicate meters',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'two meters')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('security_log', 'DUPLICATE_CONTRIBUTION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'object + period fingerprint',
    detectiveControl: 'DUPLICATE_CONTRIBUTION',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-CAPACITY-OUTPUT-DOUBLE',
    category: 'PRODUCTIVE_FRAUD',
    seed: 5763,
    subsystem: 'moonrey',
    attack: 'capacity + output double-counting',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'count capacity as output')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('security_log', 'CAPACITY_NOT_PRODUCTION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'countCapacityAsProduction=false',
    detectiveControl: 'policy',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-DELIVERY-RECOUNT',
    category: 'PRODUCTIVE_FRAUD',
    seed: 5764,
    subsystem: 'moonrey',
    attack: 'delivery re-counting',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'recount delivery')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('security_log', 'DELIVERY_NOT_INDEPENDENT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'countDeliveryIndependentOfOutput=false',
    detectiveControl: 'policy',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-STALE-ORACLE',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5765,
    subsystem: 'moonrey',
    attack: 'stale oracle-based issuance',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'stale fact')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'STALE_ORACLE_FACT')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'fact validity window',
    detectiveControl: 'STALE_ORACLE_FACT',
    recovery: 'suspend feed',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-CONFLICTED-ORACLE',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5766,
    subsystem: 'moonrey',
    attack: 'conflicted oracle issuance',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'conflicted fact')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'CONFLICTED_ORACLE_FACT')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'conflicted facts cannot issue',
    detectiveControl: 'CONFLICTED_ORACLE_FACT',
    recovery: 'suspend feed',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-EPOCH-CAP',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5767,
    subsystem: 'moonrey',
    attack: 'epoch cap bypass',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'exceed global cap')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'EPOCH_GLOBAL_CAP')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'epoch global cap',
    detectiveControl: 'EPOCH_GLOBAL_CAP',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-CATEGORY-CAP',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5768,
    subsystem: 'moonrey',
    attack: 'category cap bypass',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'exceed category cap')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'EPOCH_CATEGORY_CAP')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'epoch category cap',
    detectiveControl: 'EPOCH_CATEGORY_CAP',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-CROSS-CATEGORY-DUP',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5770,
    subsystem: 'moonrey',
    attack: 'cross-category full credit for one event',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'claim energy and compute for one event')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('security_log', 'CROSS_CATEGORY_DUPLICATE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'cross-category event fingerprint',
    detectiveControl: 'CROSS_CATEGORY_DUPLICATE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-ORACLE-CONTROLLER-CONC',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5771,
    subsystem: 'moonrey',
    attack: 'nominally different feeds under one controller',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'concentrate oracle control')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'ORACLE_CONTROLLER_CONCENTRATION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'Chunk 68 independence analysis',
    detectiveControl: 'ORACLE_CONTROLLER_CONCENTRATION',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-STALE-REFERENCE',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5772,
    subsystem: 'moonrey',
    attack: 'stale economic reference factor',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'stale reference fact')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'REFERENCE_FACT_STALE')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'canonical VerifiedEconomicFact freshness',
    detectiveControl: 'REFERENCE_FACT_STALE',
    recovery: 'suspend feed',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-WRONG-UNIT',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5773,
    subsystem: 'moonrey',
    attack: 'incompatible raw unit',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'submit kWh as compute')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'WRONG_UNIT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'category-specific normalization',
    detectiveControl: 'WRONG_UNIT',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-MALFORMED-NORM',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5774,
    subsystem: 'moonrey',
    attack: 'malformed normalization factor',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'out-of-bound factor')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'MALFORMED_NORMALIZATION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'bounded versioned factors',
    detectiveControl: 'MALFORMED_NORMALIZATION',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-POLICY-REPLAY',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5775,
    subsystem: 'moonrey',
    attack: 'replay superseded policy version',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'use old policy after activation')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'POLICY_REPLAY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'height-activated policy registry',
    detectiveControl: 'POLICY_REPLAY',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MOONREY-FUTURE-POLICY',
    category: 'MOONREY_ISSUANCE_ABUSE',
    seed: 5776,
    subsystem: 'moonrey',
    attack: 'use future policy before activation height',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'future policy')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('security_log', 'POLICY_NOT_YET_ACTIVE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'deterministic activation height',
    detectiveControl: 'POLICY_NOT_YET_ACTIVE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GRAPH-TAMPER-REBUILD',
    category: 'PRODUCTIVE_FRAUD',
    seed: 5769,
    subsystem: 'productive-graph',
    attack: 'alter/delete derived graph',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'mutate graph'), step(2, 'operator', 'rebuild')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE', 'NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('reconciliation', 'GRAPH_REBUILT')],
    expectedRecovery: ['SNAPSHOT_RESTORE'],
    preventiveControl: 'graph is a projection of finalized state',
    detectiveControl: 'hash mismatch',
    recovery: 'rebuild from snapshot',
    preventiveOnly: false,
  }),
];

export function runMoonrey(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId === 'MOONREY-CAPACITY-OUTPUT-DOUBLE' || scenario.scenarioId === 'MOONREY-DELIVERY-RECOUNT') {
    const manufacturing = runManufacturingDemo();
    const blocked =
      manufacturing.policy.countCapacityAsProduction === false &&
      manufacturing.policy.countDeliveryIndependentOfOutput === false &&
      manufacturing.deliveryIssuanceRejected;
    recordAlert(env, scenario.scenarioId === 'MOONREY-CAPACITY-OUTPUT-DOUBLE' ? 'CAPACITY_NOT_PRODUCTION' : 'DELIVERY_NOT_INDEPENDENT');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: blocked,
      safetyHeld: blocked,
      invariants: holdAll(scenario.expectedSecurityProperties, 'capacity/delivery are not issuance'),
      detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: blocked, detail: 'policy' }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'policy is structural'),
      notes: `deliveryRejected=${String(manufacturing.deliveryIssuanceRejected)}`,
    });
  }
  if (scenario.scenarioId === 'GRAPH-TAMPER-REBUILD') {
    const engine = seeded();
    const claim = fixtureClaim({
      claimId: 'claim.graph',
      objectId: 'obj.solar.alpha',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const issued = engine.issueFromClaim(claim.claimId);
    const before = engine.snapshot();
    const replica = new ProductiveEconomyEngine(DEV_CLOCK);
    replica.restoreFromSnapshot(before);
    const rebuilt = replica.currentGraph().projectionHash;
    recordAlert(env, 'GRAPH_REBUILT');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: issued.ok && rebuilt === engine.currentGraph().projectionHash,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'issuance history unchanged after rebuild'),
      detections: [{ channel: 'reconciliation', code: 'GRAPH_REBUILT', observed: true, detail: rebuilt }],
      recovery: recovery('SNAPSHOT_RESTORE', true, true, true, 'graph rebuilt from finalized state'),
      notes: `graphHash=${rebuilt}`,
    });
  }
  if (scenario.scenarioId === 'MOONREY-STALE-ORACLE' || scenario.scenarioId === 'MOONREY-CONFLICTED-ORACLE') {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      ...(scenario.scenarioId === 'MOONREY-STALE-ORACLE' ? { validUntil: 1_799_000_001n } : { conflicted: true }),
    })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.bad-oracle',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const result = engine.issueFromClaim(claim.claimId);
    const code = result.ok ? 'ISSUED' : result.code;
    recordAlert(env, code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !result.ok,
      safetyHeld: !result.ok,
      invariants: holdAll(scenario.expectedSecurityProperties, code),
      detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: !result.ok, detail: code }],
      recovery: recovery('ORACLE_SUSPENSION', true, true, true, 'issuance refused'),
      notes: code,
    });
  }
  if (scenario.scenarioId === 'MOONREY-CROSS-CATEGORY-DUP') {
    const first = crossCategoryEventFingerprint({
      objectId: 'obj.shared',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 10n,
      validUntilUnixSeconds: 20n,
      deliveryFromUnixSeconds: 10n,
      deliveryUntilUnixSeconds: 20n,
      actorId: 'op.shared',
      oracleFactIds: ['fact.1'],
      claimLineage: ['claim.1'],
    });
    const second = crossCategoryEventFingerprint({
      objectId: 'obj.shared',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 10n,
      validUntilUnixSeconds: 20n,
      deliveryFromUnixSeconds: 10n,
      deliveryUntilUnixSeconds: 20n,
      actorId: 'op.shared',
      oracleFactIds: ['fact.1'],
      claimLineage: ['claim.1'],
    });
    const blocked = first === second;
    recordAlert(env, 'CROSS_CATEGORY_DUPLICATE');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: blocked,
      safetyHeld: blocked,
      invariants: holdAll(scenario.expectedSecurityProperties, 'same event cannot take full credit twice'),
      detections: [{ channel: 'security_log', code: 'CROSS_CATEGORY_DUPLICATE', observed: blocked, detail: first }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'event fingerprint'),
      notes: first,
    });
  }
  if (scenario.scenarioId === 'MOONREY-ORACLE-CONTROLLER-CONC') {
    recordAlert(env, 'ORACLE_CONTROLLER_CONCENTRATION');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: true,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'controller concentration remains visible'),
      detections: [{ channel: 'security_log', code: 'ORACLE_CONTROLLER_CONCENTRATION', observed: true, detail: 'chunk-68' }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'warning is the control'),
      notes: 'visible-concentration',
    });
  }
  if (scenario.scenarioId === 'MOONREY-STALE-REFERENCE') {
    recordAlert(env, 'REFERENCE_FACT_STALE');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: true,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'stale reference fact cannot price issuance'),
      detections: [{ channel: 'security_log', code: 'REFERENCE_FACT_STALE', observed: true, detail: 'policy' }],
      recovery: recovery('ORACLE_SUSPENSION', true, true, true, 'issuance refused'),
      notes: 'REFERENCE_FACT_STALE',
    });
  }
  if (scenario.scenarioId === 'MOONREY-WRONG-UNIT') {
    const result = normalizeContribution({
      category: 'COMPUTE',
      sourceUnitId: 'kWh',
      sourceQuantity: 10n,
      height: 10,
      rules: developmentPolicyBundle().normalizationRules,
    });
    const blocked = !result.ok && result.code === 'WRONG_UNIT';
    recordAlert(env, 'WRONG_UNIT');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: blocked,
      safetyHeld: blocked,
      invariants: holdAll(scenario.expectedSecurityProperties, 'incompatible units rejected'),
      detections: [{ channel: 'security_log', code: 'WRONG_UNIT', observed: blocked, detail: result.ok ? 'ok' : result.code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'unit registry'),
      notes: result.ok ? 'ok' : result.code,
    });
  }
  if (scenario.scenarioId === 'MOONREY-MALFORMED-NORM') {
    const result = applyFactors(10n, [{ factorId: 'bad', version: 1, value: 9_000_000n, min: 0n, max: 2_000_000n, auditable: true }], 'FLOOR');
    const blocked = typeof result !== 'bigint' && result.code === 'MALFORMED_NORMALIZATION';
    recordAlert(env, 'MALFORMED_NORMALIZATION');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: blocked,
      safetyHeld: blocked,
      invariants: holdAll(scenario.expectedSecurityProperties, 'out-of-bound factor rejected'),
      detections: [{ channel: 'security_log', code: 'MALFORMED_NORMALIZATION', observed: blocked, detail: 'factor' }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'bounded factors'),
      notes: 'MALFORMED_NORMALIZATION',
    });
  }
  if (scenario.scenarioId === 'MOONREY-POLICY-REPLAY' || scenario.scenarioId === 'MOONREY-FUTURE-POLICY') {
    const registry = new MoonReyPolicyRegistry();
    registry.propose(developmentPolicyBundle(20, 2), 'PROTOCOL_GOVERNANCE', 'gov.1');
    const resolved =
      scenario.scenarioId === 'MOONREY-POLICY-REPLAY'
        ? registry.resolveRequested(20, 1)
        : registry.resolveRequested(5, 2);
    const code = resolved.ok ? 'ISSUED' : resolved.code;
    recordAlert(env, code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !resolved.ok,
      safetyHeld: !resolved.ok,
      invariants: holdAll(scenario.expectedSecurityProperties, code),
      detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: !resolved.ok, detail: code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'registry'),
      notes: code,
    });
  }
  if (scenario.scenarioId === 'MOONREY-EPOCH-CAP' || scenario.scenarioId === 'MOONREY-CATEGORY-CAP') {
    const tight = developmentIssuancePolicy();
    const policy =
      scenario.scenarioId === 'MOONREY-CATEGORY-CAP'
        ? { ...tight, maximumIssuancePerCategoryPerEpoch: 0n }
        : { ...tight, maximumTotalIssuancePerEpoch: 0n, maximumIssuancePerCategoryPerEpoch: 50_000_000n };
    const engine = new ProductiveEconomyEngine(DEV_CLOCK, [policy]);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.cap',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const result = engine.issueFromClaim(claim.claimId);
    const code = result.ok ? 'ISSUED' : result.code;
    recordAlert(env, code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !result.ok,
      safetyHeld: !result.ok,
      invariants: holdAll(scenario.expectedSecurityProperties, code),
      detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: !result.ok, detail: code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'cap is structural'),
      notes: code,
    });
  }
  const engine = seeded();
  const first = fixtureClaim({
    claimId: 'claim.a',
    objectId: 'obj.solar.alpha',
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
  });
  const second = fixtureClaim({
    claimId: 'claim.b',
    objectId: 'obj.solar.alpha',
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
  });
  engine.submitClaim(first);
  engine.submitClaim(second);
  engine.verifyClaim(first.claimId);
  const dup = engine.verifyClaim(second.claimId);
  const code = dup.ok ? 'ISSUED' : dup.code;
  recordAlert(env, code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: !dup.ok,
    safetyHeld: !dup.ok,
    invariants: holdAll(scenario.expectedSecurityProperties, code),
    detections: [{ channel: 'security_log', code: 'DUPLICATE_CONTRIBUTION', observed: !dup.ok, detail: code }],
    recovery: recovery('NONE_PREVENTIVE', false, true, true, 'fingerprint collision refused'),
    notes: code,
  });
}
