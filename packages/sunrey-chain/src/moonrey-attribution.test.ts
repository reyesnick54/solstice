import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WEIGHT_SCALE } from './productive/types.ts';
import {
  AI_CAN_ACTIVATE_POLICY,
  ATTRIBUTION_AUTHORIZES_MOONREY,
  ATTRIBUTION_DOES_FINAL_VALUATION,
  ATTRIBUTION_SHARE_SCALE,
  COMPANY_A,
  DUPLICATE_FULL_ATTRIBUTION_ALLOWED,
  ENERGY_CO,
  MoonReyPolicyRegistry,
  PRODUCTION_ACTIVE,
  compileCrossCategoryAllocation,
  computePair,
  developmentAttributionPolicy,
  evaluateAttribution,
  historicalAllocationCompatible,
  historicalAttributionPolicy,
  relationship,
  splitManufacturingMachinePolicy,
  subject,
  supplyChainSubjects,
  validateShare,
  validateShareSet,
} from './productive/policy-governance/index.ts';

describe('Chunk 121 MoonRey attribution policy', () => {
  it('1. manufacturing + machine output same event cannot both take 100%', () => {
    const policy = developmentAttributionPolicy();
    const manufacturing = subject({
      claimId: 'claim.mfg',
      economicEventId: 'pee.mfg.1',
      category: 'MANUFACTURING',
      controllerId: COMPANY_A,
    });
    const machine = subject({
      claimId: 'claim.robot',
      economicEventId: 'pee.mfg.1',
      category: 'AUTOMATED_MACHINE_OUTPUT',
      claimType: 'USAGE',
      eventClass: 'USAGE',
      controllerId: COMPANY_A,
      unitId: 'machine_h',
      measurementSemantics: 'machine_time',
    });
    const result = evaluateAttribution({
      height: 10,
      policy,
      subjects: [manufacturing, machine],
    });
    const mfg = result.decisions.find((item) => item.claimId === 'claim.mfg')!;
    const robot = result.decisions.find((item) => item.claimId === 'claim.robot')!;
    assert.equal(mfg.decision, 'FULL_ATTRIBUTION');
    assert.equal(mfg.attributionShare, ATTRIBUTION_SHARE_SCALE);
    assert.equal(robot.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.equal(robot.attributionShare, 0n);
    assert.ok(robot.reasonCodes.includes('MACHINE_ACTIVITY_NOT_NEW_OUTPUT'));
    assert.equal(mfg.attributionShare + robot.attributionShare <= policy.maximumAggregateShare, true);
    assert.equal(DUPLICATE_FULL_ATTRIBUTION_ALLOWED, false);
  });

  it('2. manufacturing + goods same output does not create a second full credit', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
          batchIdentity: 'batch.1',
        }),
        subject({
          claimId: 'claim.goods',
          economicEventId: 'pee.mfg.1',
          category: 'GOODS',
          controllerId: COMPANY_A,
          batchIdentity: 'batch.1',
          measurementSemantics: 'goods_identity',
        }),
      ],
    });
    const mfg = result.decisions.find((item) => item.claimId === 'claim.mfg')!;
    const goods = result.decisions.find((item) => item.claimId === 'claim.goods')!;
    assert.equal(mfg.decision, 'FULL_ATTRIBUTION');
    assert.equal(goods.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(goods.reasonCodes.includes('GOODS_IDENTITY_NOT_NEW_OUTPUT'));
  });

  it('3. manufacturing + independent logistics may both receive attribution', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
        subject({
          claimId: 'claim.freight',
          economicEventId: 'pee.freight.1',
          category: 'LOGISTICS_TRANSPORTATION',
          claimType: 'DELIVERY',
          eventClass: 'DELIVERY',
          controllerId: 'controller.freight',
          quantity: 40n,
          unitId: 't_km',
          measurementSemantics: 'tonne_km',
          evidenceRefs: ['ev.bol', 'delivery_completion'],
          lineageEventIds: ['pee.mfg.1'],
        }),
      ],
      relationships: [relationship('pee.mfg.1', 'pee.freight.1', 'DISTINCT_REALIZED_SERVICE')],
    });
    const mfg = result.decisions.find((item) => item.claimId === 'claim.mfg')!;
    const freight = result.decisions.find((item) => item.claimId === 'claim.freight')!;
    assert.equal(mfg.decision, 'FULL_ATTRIBUTION');
    assert.equal(freight.decision, 'SEPARATE_VALUE_EVENT');
    assert.equal(freight.attributionShare, ATTRIBUTION_SHARE_SCALE);
    assert.ok(freight.reasonCodes.includes('INDEPENDENT_LOGISTICS_SERVICE'));
  });

  it('4. goods + independent storage may be a distinct service', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.goods',
          economicEventId: 'pee.mfg.1',
          category: 'GOODS',
          controllerId: COMPANY_A,
          batchIdentity: 'batch.1',
        }),
        subject({
          claimId: 'claim.storage',
          economicEventId: 'pee.store.1',
          category: 'STORAGE',
          claimType: 'USAGE',
          eventClass: 'USAGE',
          controllerId: 'controller.warehouse',
          unitId: 'm3_h',
          measurementSemantics: 'volume_time',
          batchIdentity: 'batch.1',
          evidenceRefs: ['facility_use', 'realized_service_period'],
        }),
      ],
      relationships: [relationship('pee.mfg.1', 'pee.store.1', 'DISTINCT_REALIZED_SERVICE')],
    });
    const storage = result.decisions.find((item) => item.claimId === 'claim.storage')!;
    assert.equal(storage.decision, 'SEPARATE_VALUE_EVENT');
    assert.ok(storage.reasonCodes.includes('INDEPENDENT_STORAGE_SERVICE'));
  });

  it('5. compute + AI compute same GPU execution is not two full credits', () => {
    const pair = computePair(true);
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [pair.compute, pair.ai],
    });
    const compute = result.decisions.find((item) => item.category === 'COMPUTE')!;
    const ai = result.decisions.find((item) => item.category === 'AI_COMPUTE')!;
    assert.equal(compute.decision, 'FULL_ATTRIBUTION');
    assert.equal(ai.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(ai.reasonCodes.includes('COMPUTE_AI_SAME_EXECUTION'));
    assert.equal(compute.attributionShare + ai.attributionShare, ATTRIBUTION_SHARE_SCALE);
  });

  it('6. energy production and factory consumption remain distinct', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.energy',
          economicEventId: 'pee.energy.1',
          category: 'ENERGY',
          controllerId: ENERGY_CO,
          unitId: 'kWh',
          measurementSemantics: 'energy_output',
        }),
        subject({
          claimId: 'claim.factory.use',
          economicEventId: 'pee.factory.use.1',
          category: 'MANUFACTURING',
          claimType: 'USAGE',
          eventClass: 'CONSUMPTION',
          controllerId: COMPANY_A,
          unitId: 'kWh',
          measurementSemantics: 'energy_input',
          lineageEventIds: ['pee.energy.1'],
        }),
      ],
      relationships: [relationship('pee.energy.1', 'pee.factory.use.1', 'DEPENDENT_INPUT')],
    });
    const energy = result.decisions.find((item) => item.claimId === 'claim.energy')!;
    const use = result.decisions.find((item) => item.claimId === 'claim.factory.use')!;
    assert.equal(energy.decision, 'FULL_ATTRIBUTION');
    assert.equal(energy.attributionShare, ATTRIBUTION_SHARE_SCALE);
    assert.equal(use.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(use.reasonCodes.includes('ENERGY_CONSUMPTION_IS_LINEAGE'));
  });

  it('7. capacity + output are not double counted', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.capacity',
          economicEventId: 'pee.plant.1',
          category: 'MANUFACTURING',
          claimType: 'CAPACITY',
          eventClass: 'CAPACITY',
          controllerId: COMPANY_A,
        }),
        subject({
          claimId: 'claim.output',
          economicEventId: 'pee.plant.1',
          category: 'MANUFACTURING',
          claimType: 'OUTPUT',
          controllerId: COMPANY_A,
        }),
      ],
    });
    const capacity = result.decisions.find((item) => item.claimType === 'CAPACITY')!;
    const output = result.decisions.find((item) => item.claimType === 'OUTPUT')!;
    assert.equal(output.decision, 'FULL_ATTRIBUTION');
    assert.equal(capacity.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(capacity.reasonCodes.includes('CAPACITY_IS_NOT_OUTPUT'));
  });

  it('8. output + delivery are not automatically double counted', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.output',
          economicEventId: 'pee.plant.1',
          category: 'MANUFACTURING',
          claimType: 'OUTPUT',
          controllerId: COMPANY_A,
        }),
        subject({
          claimId: 'claim.delivery',
          economicEventId: 'pee.plant.1',
          category: 'MANUFACTURING',
          claimType: 'DELIVERY',
          eventClass: 'DELIVERY',
          controllerId: COMPANY_A,
        }),
      ],
    });
    const output = result.decisions.find((item) => item.claimType === 'OUTPUT')!;
    const delivery = result.decisions.find((item) => item.claimType === 'DELIVERY')!;
    assert.equal(output.decision, 'FULL_ATTRIBUTION');
    assert.equal(delivery.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(delivery.reasonCodes.includes('DELIVERY_NOT_AUTOMATIC_PRODUCTION'));
  });

  it('9. vertically integrated company keeps legitimate distinct stages', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.energy',
          economicEventId: 'pee.a.energy',
          category: 'ENERGY',
          controllerId: COMPANY_A,
          unitId: 'kWh',
          measurementSemantics: 'energy_output',
        }),
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.a.mfg',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
          lineageEventIds: ['pee.a.energy'],
        }),
        subject({
          claimId: 'claim.freight',
          economicEventId: 'pee.a.freight',
          category: 'LOGISTICS_TRANSPORTATION',
          claimType: 'DELIVERY',
          eventClass: 'DELIVERY',
          controllerId: COMPANY_A,
          unitId: 't_km',
          measurementSemantics: 'tonne_km',
          evidenceRefs: ['delivery_completion'],
          lineageEventIds: ['pee.a.mfg'],
        }),
      ],
      relationships: [
        relationship('pee.a.energy', 'pee.a.mfg', 'DEPENDENT_INPUT'),
        relationship('pee.a.mfg', 'pee.a.freight', 'DISTINCT_REALIZED_SERVICE'),
      ],
    });
    assert.equal(result.decisions.find((item) => item.claimId === 'claim.energy')?.decision, 'FULL_ATTRIBUTION');
    assert.equal(result.decisions.find((item) => item.claimId === 'claim.mfg')?.decision, 'FULL_ATTRIBUTION');
    assert.equal(result.decisions.find((item) => item.claimId === 'claim.freight')?.decision, 'SEPARATE_VALUE_EVENT');
    assert.ok(result.decisions.find((item) => item.claimId === 'claim.freight')?.reasonCodes.includes('VERTICAL_DISTINCT_STAGES'));
  });

  it('10. vertically integrated relabeling of the same event is not repeated full credit', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.a.one',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
        subject({
          claimId: 'claim.relabel',
          economicEventId: 'pee.a.one',
          category: 'AUTOMATED_MACHINE_OUTPUT',
          controllerId: COMPANY_A,
          measurementSemantics: 'machine_time',
        }),
      ],
    });
    const mfg = result.decisions.find((item) => item.claimId === 'claim.mfg')!;
    const relabel = result.decisions.find((item) => item.claimId === 'claim.relabel')!;
    assert.equal(mfg.decision, 'FULL_ATTRIBUTION');
    assert.equal(relabel.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(
      relabel.reasonCodes.includes('VERTICAL_RELABEL_SAME_EVENT')
        || relabel.reasonCodes.includes('MACHINE_ACTIVITY_NOT_NEW_OUTPUT'),
    );
  });

  it('11. different controllers claiming the same batch require review', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.a',
          economicEventId: 'pee.a.batch',
          category: 'GOODS',
          controllerId: COMPANY_A,
          batchIdentity: 'batch.shared',
        }),
        subject({
          claimId: 'claim.b',
          economicEventId: 'pee.b.batch',
          category: 'GOODS',
          controllerId: 'controller.rival',
          batchIdentity: 'batch.shared',
        }),
      ],
    });
    assert.equal(result.reviewRequired, true);
    assert.ok(result.decisions.every((item) => item.decision === 'REVIEW_REQUIRED'));
    assert.ok(result.decisions[0]?.reasonCodes.includes('CONTROLLER_CONFLICT_SAME_OUTPUT'));
  });

  it('12. split attribution sums to the policy bound', () => {
    const policy = splitManufacturingMachinePolicy(1);
    const result = evaluateAttribution({
      height: 10,
      policy,
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
        subject({
          claimId: 'claim.robot',
          economicEventId: 'pee.mfg.1',
          category: 'AUTOMATED_MACHINE_OUTPUT',
          controllerId: COMPANY_A,
          measurementSemantics: 'machine_time',
        }),
      ],
    });
    const mfg = result.decisions.find((item) => item.claimId === 'claim.mfg')!;
    const robot = result.decisions.find((item) => item.claimId === 'claim.robot')!;
    assert.equal(mfg.decision, 'PARTIAL_ATTRIBUTION');
    assert.equal(robot.decision, 'PARTIAL_ATTRIBUTION');
    assert.equal(mfg.attributionShare, 700_000n);
    assert.equal(robot.attributionShare, 300_000n);
    assert.equal(mfg.attributionShare + robot.attributionShare, policy.maximumAggregateShare);
    const compiled = compileCrossCategoryAllocation(
      policy,
      'event.mfg.1',
      { MANUFACTURING: mfg.attributionShare, AUTOMATED_MACHINE_OUTPUT: robot.attributionShare },
    );
    assert.equal(compiled.governed, true);
    assert.equal(compiled.attributionPolicyVersion, 2);
    assert.equal(historicalAllocationCompatible(compiled), true);
  });

  it('13. share greater than the bound is rejected', () => {
    const policy = developmentAttributionPolicy();
    assert.equal(validateShare(policy.maximumAggregateShare + 1n, policy.maximumAggregateShare).ok, false);
    const result = evaluateAttribution({
      height: 10,
      policy,
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
      ],
      requestedShares: { 'claim.mfg': policy.maximumAggregateShare + 1n },
    });
    assert.equal(result.rejected, true);
    assert.equal(result.decisions[0]?.decision, 'REJECTED');
    assert.ok(result.decisions[0]?.reasonCodes.includes('SHARE_EXCEEDS_BOUND'));
  });

  it('14. negative share is rejected', () => {
    assert.equal(validateShare(-1n).ok, false);
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
      ],
      requestedShares: { 'claim.mfg': -5n },
    });
    assert.equal(result.decisions[0]?.decision, 'REJECTED');
    assert.ok(result.decisions[0]?.reasonCodes.includes('NEGATIVE_SHARE'));
  });

  it('15. ambiguous lineage returns review and does not guess', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.freight',
          economicEventId: 'pee.freight.1',
          category: 'LOGISTICS_TRANSPORTATION',
          claimType: 'DELIVERY',
          eventClass: 'DELIVERY',
          controllerId: 'controller.freight',
          lineageComplete: false,
          measurementSemantics: 'tonne_km',
        }),
      ],
      relationships: [relationship('pee.unknown', 'pee.freight.1', 'AMBIGUOUS', 'AMBIGUOUS')],
    });
    assert.equal(result.reviewRequired, true);
    assert.equal(result.decisions[0]?.decision, 'REVIEW_REQUIRED');
    assert.ok(
      result.decisions[0]?.reasonCodes.includes('AMBIGUOUS_LINEAGE')
        || result.decisions[0]?.reasonCodes.includes('AMBIGUOUS_RELATIONSHIP'),
    );
  });

  it('16. attribution policy version is retained on the decision', () => {
    const policy = developmentAttributionPolicy({ version: 1 });
    const result = evaluateAttribution({
      height: 10,
      policy,
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
      ],
    });
    assert.equal(result.policyVersion, 1);
    assert.equal(result.decisions[0]?.policyVersion, 1);
    assert.equal(result.decisions[0]?.policyId, policy.policyId);
    assert.ok(result.decisions[0]?.reasonCodes.includes('POLICY_VERSION_RETAINED'));
    assert.equal(result.decisions[0]?.decisionDigest.length, 64);
  });

  it('17. historical attribution policy is preserved after a later version', () => {
    const registry = new MoonReyPolicyRegistry();
    const v1 = historicalAttributionPolicy();
    const v2 = splitManufacturingMachinePolicy(50);
    const activated = registry.proposeAttribution(v2, 'PROTOCOL_GOVERNANCE', 'gov.1');
    assert.equal(activated.activated, true);
    assert.equal(registry.getAttribution(v1.policyId, 1)?.version, 1);
    assert.equal(registry.attributionActiveAt(10)?.version, 1);
    assert.equal(registry.attributionActiveAt(50)?.version, 2);
    const historical = evaluateAttribution({
      height: 10,
      policy: registry.attributionActiveAt(10)!,
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
        subject({
          claimId: 'claim.robot',
          economicEventId: 'pee.mfg.1',
          category: 'AUTOMATED_MACHINE_OUTPUT',
          controllerId: COMPANY_A,
          measurementSemantics: 'machine_time',
        }),
      ],
    });
    assert.equal(historical.policyVersion, 1);
    assert.equal(historical.decisions.find((item) => item.claimId === 'claim.mfg')?.decision, 'FULL_ATTRIBUTION');
    assert.equal(
      historical.decisions.find((item) => item.claimId === 'claim.robot')?.decision,
      'ZERO_DUPLICATE_ATTRIBUTION',
    );
  });

  it('18. AI cannot activate attribution policy', () => {
    const registry = new MoonReyPolicyRegistry();
    const proposed = registry.proposeAttribution(
      splitManufacturingMachinePolicy(80),
      'AI_PROPOSAL',
      'ai.researcher',
    );
    assert.equal(AI_CAN_ACTIVATE_POLICY, false);
    assert.equal(proposed.activated, false);
    assert.equal(proposed.rejection, 'AI_CANNOT_ACTIVATE_POLICY');
    assert.equal(registry.attributionActiveAt(80)?.version, 1);
  });

  it('19. attribution decision cannot mint', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
      ],
    });
    assert.equal(result.authorizesIssuance, false);
    assert.equal(result.decisions[0]?.authorizesIssuance, false);
    assert.equal(ATTRIBUTION_AUTHORIZES_MOONREY, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(developmentAttributionPolicy().productionActivated, false);
    assert.ok(!('moonreyQuantity' in result.decisions[0]!));
  });

  it('20. attribution decision does not determine final MoonRey quantity', () => {
    const result = evaluateAttribution({
      height: 10,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: 'pee.mfg.1',
          category: 'MANUFACTURING',
          controllerId: COMPANY_A,
        }),
      ],
    });
    assert.equal(result.performsFinalValuation, false);
    assert.equal(result.decisions[0]?.performsFinalValuation, false);
    assert.equal(ATTRIBUTION_DOES_FINAL_VALUATION, false);
    assert.equal(developmentAttributionPolicy().performsFinalValuation, false);
    assert.equal(ATTRIBUTION_SHARE_SCALE, WEIGHT_SCALE);
    assert.equal(validateShareSet([700_000n, 300_000n]).ok, true);
    assert.equal(validateShareSet([700_000n, 400_000n]).ok, false);
  });
});
