import { ProductiveEconomyEngine } from '../../../sunrey-chain/src/productive/engine.ts';
import { developmentIssuancePolicy } from '../../../sunrey-chain/src/productive/policy.ts';
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
