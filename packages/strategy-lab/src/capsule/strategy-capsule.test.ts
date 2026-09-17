import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { asStrategyCapsuleVersion, asStrategyFamilyId } from './ids.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';
import {
  HELIOS_H14_CAPSULE_ID,
  HELIOS_H14_FAMILY_ID,
  buildHeliosH14Material,
  buildHeliosH14StrategyCapsule,
} from './h14.ts';
import { StrategyCapsuleService } from './service.ts';
import { StrategyLabStore } from '../store.ts';
import type { StrategyCapsuleMaterial } from './types.ts';

const NOW = asUtcInstant('2026-09-17T07:30:00.000Z');

function harness() {
  const clock = new FrozenClock(NOW);
  const store = new StrategyLabStore();
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const service = new StrategyCapsuleService({ clock, store, events, evidence });
  return { clock, store, events, evidence, service };
}

function baseMaterial(): StrategyCapsuleMaterial {
  return buildHeliosH14Material();
}

describe('Strategy Capsule domain (H16)', () => {
  it('1. creates a valid capsule draft', () => {
    const { service } = harness();
    const created = service.createDraft({
      strategyFamilyId: asStrategyFamilyId('sfam_test_capsule'),
      scope: 'GLOBAL',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: baseMaterial(),
      qualificationState: 'DRAFT',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.qualificationState, 'DRAFT');
    assert.equal(created.value.llmDeployable, false);
    assert.match(created.value.materialHash, /^[a-f0-9]{64}$/);
  });

  it('2. frozen version is immutable for in-place evidence attachment', () => {
    const { service } = harness();
    const created = service.createDraft({
      strategyFamilyId: asStrategyFamilyId('sfam_freeze_test'),
      scope: 'GLOBAL',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: baseMaterial(),
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const frozen = service.freezeVersion(created.value.strategyCapsuleId, created.value.version);
    assert.equal(frozen.ok, true);
    if (!frozen.ok) {
      return;
    }
    assert.equal(frozen.value.frozen, true);
    const attach = service.attachEvidence(created.value.strategyCapsuleId, created.value.version, {
      evidenceVaultRefs: ['hev_test_1'],
    });
    assert.equal(attach.ok, false);
    if (attach.ok) {
      return;
    }
    assert.equal(attach.error.code, 'FROZEN_IMMUTABLE');
  });

  it('3. material change creates a new version', () => {
    const { service } = harness();
    const familyId = asStrategyFamilyId('sfam_version_test');
    const v1 = service.createDraft({
      strategyFamilyId: familyId,
      version: asStrategyCapsuleVersion('1'),
      scope: 'GLOBAL',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: baseMaterial(),
    });
    assert.equal(v1.ok, true);
    if (!v1.ok) {
      return;
    }
    const nextMaterial = Object.freeze({
      ...baseMaterial(),
      decisionRule: Object.freeze({
        ...baseMaterial().decisionRule,
        entryRule: Object.freeze({
          ...baseMaterial().decisionRule.entryRule,
          entryThresholdMinor: '10000',
        }),
      }),
    });
    const v2 = service.createVersionFromParent({
      strategyFamilyId: familyId,
      parentVersion: asStrategyCapsuleVersion('1'),
      newVersion: asStrategyCapsuleVersion('2'),
      material: nextMaterial,
      createdBy: 'researcher_1',
    });
    assert.equal(v2.ok, true);
    if (!v2.ok) {
      return;
    }
    assert.equal(v2.value.parentVersion, '1');
    assert.notEqual(v1.value.materialHash, v2.value.materialHash);
  });

  it('4. same material configuration produces a stable fingerprint', () => {
    const material = baseMaterial();
    const left = computeStrategyCapsuleMaterialHash(material, 'GLOBAL');
    const right = computeStrategyCapsuleMaterialHash(material, 'GLOBAL');
    assert.equal(left, right);
  });

  it('5. changed decision rule changes fingerprint', () => {
    const base = baseMaterial();
    const changed = Object.freeze({
      ...base,
      decisionRule: Object.freeze({
        ...base.decisionRule,
        exitRule: Object.freeze({ ...base.decisionRule.exitRule, exitThresholdMinor: '10500' }),
      }),
    });
    assert.notEqual(
      computeStrategyCapsuleMaterialHash(base, 'GLOBAL'),
      computeStrategyCapsuleMaterialHash(changed, 'GLOBAL'),
    );
  });

  it('6. changed cost assumption changes fingerprint', () => {
    const base = baseMaterial();
    const changed = Object.freeze({
      ...base,
      costModel: Object.freeze({ ...base.costModel, slippageBps: 25 }),
    });
    assert.notEqual(
      computeStrategyCapsuleMaterialHash(base, 'GLOBAL'),
      computeStrategyCapsuleMaterialHash(changed, 'GLOBAL'),
    );
  });

  it('7. model-version change requires new version via parent versioning', () => {
    const { service } = harness();
    const familyId = asStrategyFamilyId('sfam_model_version_test');
    assert.equal(
      service.createDraft({
        strategyFamilyId: familyId,
        version: asStrategyCapsuleVersion('1'),
        scope: 'GLOBAL',
        createdBy: 'researcher_1',
        environment: 'simulation',
        material: baseMaterial(),
      }).ok,
      true,
    );
    const changedModel = Object.freeze({
      ...baseMaterial(),
      modelDependencies: Object.freeze({
        ...baseMaterial().modelDependencies,
        deterministicRuleVersion: 'v2',
      }),
    });
    const v2 = service.createVersionFromParent({
      strategyFamilyId: familyId,
      parentVersion: asStrategyCapsuleVersion('1'),
      newVersion: asStrategyCapsuleVersion('2'),
      material: changedModel,
      createdBy: 'researcher_1',
    });
    assert.equal(v2.ok, true);
    if (!v2.ok) {
      return;
    }
    assert.equal(v2.value.material.modelDependencies.deterministicRuleVersion, 'v2');
  });

  it('8. instrument-universe change requires new version', () => {
    const { service } = harness();
    const familyId = asStrategyFamilyId('sfam_universe_test');
    assert.equal(
      service.createDraft({
        strategyFamilyId: familyId,
        version: asStrategyCapsuleVersion('1'),
        scope: 'GLOBAL',
        createdBy: 'researcher_1',
        environment: 'simulation',
        material: baseMaterial(),
      }).ok,
      true,
    );
    const changedUniverse = Object.freeze({
      ...baseMaterial(),
      instrumentUniverse: Object.freeze({
        ...baseMaterial().instrumentUniverse,
        instrumentIds: Object.freeze(['SIM-ETF-1']),
      }),
    });
    const v2 = service.createVersionFromParent({
      strategyFamilyId: familyId,
      parentVersion: asStrategyCapsuleVersion('1'),
      newVersion: asStrategyCapsuleVersion('2'),
      material: changedUniverse,
      createdBy: 'researcher_1',
    });
    assert.equal(v2.ok, true);
  });

  it('9. old version remains reproducible after new version is created', () => {
    const { service } = harness();
    const familyId = asStrategyFamilyId('sfam_repro_test');
    const v1Material = baseMaterial();
    const v1Hash = computeStrategyCapsuleMaterialHash(v1Material, 'GLOBAL');
    const v1 = service.createDraft({
      strategyFamilyId: familyId,
      version: asStrategyCapsuleVersion('1'),
      scope: 'GLOBAL',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: v1Material,
    });
    assert.equal(v1.ok, true);
    if (!v1.ok) {
      return;
    }
    service.freezeVersion(v1.value.strategyCapsuleId, v1.value.version);
    const v2Material = Object.freeze({
      ...v1Material,
      costModel: Object.freeze({ ...v1Material.costModel, spreadBps: 7 }),
    });
    service.createVersionFromParent({
      strategyFamilyId: familyId,
      parentVersion: asStrategyCapsuleVersion('1'),
      newVersion: asStrategyCapsuleVersion('2'),
      material: v2Material,
      createdBy: 'researcher_1',
    });
    const loaded = service.getVersion(v1.value.strategyCapsuleId, asStrategyCapsuleVersion('1'));
    assert.ok(loaded);
    assert.equal(loaded.materialHash, v1Hash);
    assert.equal(loaded.frozen, true);
  });

  it('10. qualification does not transfer automatically to new version', () => {
    const { service } = harness();
    const familyId = asStrategyFamilyId('sfam_qual_transfer_test');
    const v1 = service.createDraft({
      strategyFamilyId: familyId,
      version: asStrategyCapsuleVersion('1'),
      scope: 'GLOBAL',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: baseMaterial(),
      qualificationState: 'PAPER_ELIGIBLE',
    });
    assert.equal(v1.ok, true);
    if (!v1.ok) {
      return;
    }
    const v2 = service.createVersionFromParent({
      strategyFamilyId: familyId,
      parentVersion: asStrategyCapsuleVersion('1'),
      newVersion: asStrategyCapsuleVersion('2'),
      material: Object.freeze({
        ...baseMaterial(),
        costModel: Object.freeze({ ...baseMaterial().costModel, commissionMinorPerShare: '1' }),
      }),
      createdBy: 'researcher_1',
    });
    assert.equal(v2.ok, true);
    if (!v2.ok) {
      return;
    }
    assert.equal(v1.value.qualificationState, 'PAPER_ELIGIBLE');
    assert.equal(v2.value.qualificationState, 'DRAFT');
  });

  it('11. customer-private state is not leaked into global capsule', () => {
    const { service } = harness();
    const leaked = service.createDraft({
      strategyFamilyId: asStrategyFamilyId('sfam_leak_test'),
      scope: 'GLOBAL',
      customerId: 'cust_private_1',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: baseMaterial(),
    });
    assert.equal(leaked.ok, false);
    if (leaked.ok) {
      return;
    }
    assert.equal(leaked.error.code, 'INVALID_SCOPE');
  });

  it('12. restart persistence preserves immutable capsule definition', () => {
    const { service, store } = harness();
    const capsule = buildHeliosH14StrategyCapsule({ createdAt: NOW, createdBy: 'h16_test' });
    assert.equal(service.registerPrebuilt(capsule).ok, true);
    service.freezeVersion(capsule.strategyCapsuleId, capsule.version);
    const snapshot = store.snapshot();
    const reloadedStore = new StrategyLabStore();
    for (const record of snapshot.strategyCapsules) {
      reloadedStore.putStrategyCapsule(record);
    }
    const loaded = reloadedStore.getStrategyCapsule(capsule.strategyCapsuleId, capsule.version);
    assert.ok(loaded);
    assert.equal(loaded.materialHash, capsule.materialHash);
    assert.equal(loaded.frozen, true);
    assert.equal(JSON.stringify(loaded.material), JSON.stringify(capsule.material));
  });

  it('13. H14 paper strategy is represented successfully', () => {
    const { service } = harness();
    const capsule = buildHeliosH14StrategyCapsule({
      createdAt: NOW,
      createdBy: 'strategy_lab',
      qualificationState: 'EVALUATION_PENDING',
    });
    const registered = service.registerPrebuilt(capsule);
    assert.equal(registered.ok, true);
    if (!registered.ok) {
      return;
    }
    assert.equal(registered.value.strategyCapsuleId, HELIOS_H14_CAPSULE_ID);
    assert.equal(registered.value.strategyFamilyId, HELIOS_H14_FAMILY_ID);
    assert.equal(registered.value.material.modelDependencies.deterministicRuleId, 'HELIOS_H14_REFERENCE_PRICE_ENTRY_V1');
    assert.equal(
      registered.value.material.decisionRule.entryRule.entryThresholdMinor,
      '10100',
    );
    assert.equal(registered.value.environment, 'PAPER');
  });

  it('14. revoked capsule cannot be newly activated', () => {
    const { service } = harness();
    const capsule = buildHeliosH14StrategyCapsule({
      createdAt: NOW,
      createdBy: 'strategy_lab',
      qualificationState: 'PAPER_ACTIVE',
    });
    service.registerPrebuilt(capsule);
    service.revoke(capsule.strategyCapsuleId, capsule.version);
    const activation = service.assertActivationAllowed(capsule.strategyCapsuleId, capsule.version);
    assert.equal(activation.ok, false);
    if (activation.ok) {
      return;
    }
    assert.equal(activation.error.code, 'REVOKED');
  });

  it('15. expired capsule cannot be promoted without review', () => {
    const { service } = harness();
    const capsule = buildHeliosH14StrategyCapsule({
      createdAt: NOW,
      createdBy: 'strategy_lab',
      qualificationState: 'PAPER_ELIGIBLE',
    });
    service.registerPrebuilt(capsule);
    const expired = service.markExpired(
      capsule.strategyCapsuleId,
      capsule.version,
      asUtcInstant('2026-08-01T00:00:00.000Z'),
    );
    assert.equal(expired.ok, true);
    const promotion = service.assertPromotionAllowed(capsule.strategyCapsuleId, capsule.version);
    assert.equal(promotion.ok, false);
    if (promotion.ok) {
      return;
    }
    assert.equal(promotion.error.code, 'PROMOTION_REQUIRES_REVIEW');
  });

  it('emits lifecycle events and seals evidence', () => {
    const { service, events, evidence } = harness();
    const created = service.createDraft({
      strategyFamilyId: asStrategyFamilyId('sfam_event_test'),
      scope: 'GLOBAL',
      createdBy: 'researcher_1',
      environment: 'simulation',
      material: baseMaterial(),
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    service.attachEvaluationRef(created.value.strategyCapsuleId, created.value.version, 'eval_btr_1');
    service.freezeVersion(created.value.strategyCapsuleId, created.value.version);
    const types = events.list().map((event) => event.eventType);
    assert.ok(types.includes('StrategyCapsuleCreated'));
    assert.ok(types.includes('EvaluationRequested'));
    assert.ok(types.includes('StrategyCapsuleFrozen'));
    assert.ok(evidence.list().length >= 1);
  });
});
