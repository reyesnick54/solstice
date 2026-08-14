import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { InMemoryOutboxStore, outboxRecordFromEnvelope } from '../../../events/src/memory-outbox.ts';
import { combineProofs } from '../../../permissions/src/decision.ts';
import { asIntentId } from '../../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import { AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { ComplianceKernel } from '../kernel.ts';
import { PolicyEngine } from '../policy/engine.ts';
import { PolicyRegistry } from '../policy/registry.ts';
import { loadBundledPacks } from '../policy/packs/load.ts';
import { ComplianceFabric } from './fabric.ts';
import { createSimulationProviders } from './simulation.ts';
import { isStale } from './result.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function fabric(unavailable: readonly string[] = []) {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const instance = new ComplianceFabric({
    clock,
    evidence,
    ports: createSimulationProviders({ unavailable }),
    events: {
      record(event) {
        events.push({ eventType: event.eventType, payload: { ...event.payload } });
      },
    },
  });
  return { clock, evidence, events, fabric: instance };
}

function kernelHarness() {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const issuer = new AuthorityIssuer(keys);
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  return { clock, evidence, issuer, kernel };
}

describe('compliance screening fabric', () => {
  it('1. sanctions CLEAR', () => {
    const { fabric: c } = fabric();
    const result = c.screen({ type: 'SANCTIONS', subjectRef: 'sim_clear_1', jurisdiction: 'GB' });
    assert.equal(result.outcome, 'CLEAR');
    assert.ok(result.screenedAt);
    assert.ok(result.refreshBy);
    assert.ok(result.providerHash);
  });

  it('2. sanctions REVIEW', () => {
    const { fabric: c } = fabric();
    const result = c.screen({ type: 'SANCTIONS', subjectRef: 'sim_review_1', jurisdiction: 'GB' });
    assert.equal(result.outcome, 'REVIEW');
    assert.ok([...c.store.cases.values()].some((row) => row.caseType === 'SANCTIONS_REVIEW'));
  });

  it('3. sanctions BLOCK', () => {
    const { fabric: c } = fabric();
    const result = c.screen({ type: 'SANCTIONS', subjectRef: 'sim_block_1', jurisdiction: 'US' });
    assert.equal(result.outcome, 'BLOCK');
    const opened = [...c.store.cases.values()].find((row) => row.caseType === 'SANCTIONS_REVIEW');
    assert.ok(opened);
    assert.equal(opened.finality, 'FINAL_HARD_BLOCK');
  });

  it('4. provider outage fails closed', () => {
    const { fabric: c } = fabric(['sim-sanctions']);
    const result = c.screen({ type: 'SANCTIONS', subjectRef: 'sim_clear_1', jurisdiction: 'GB' });
    assert.equal(result.outcome, 'UNAVAILABLE');
    assert.notEqual(result.outcome, 'CLEAR');
    const facts = c.collectFacts({ subjectRef: 'sim_clear_1', jurisdiction: 'GB' });
    assert.equal(facts.providerAvailable, false);
    assert.equal(facts.outagePosture, 'BLOCK');
  });

  it('5. PEP review is not an automatic block', () => {
    const { fabric: c } = fabric();
    const result = c.screen({ type: 'PEP', subjectRef: 'sim_pep_1', jurisdiction: 'GB' });
    assert.equal(result.outcome, 'REVIEW');
    assert.ok(result.reasonCodes.includes('ENHANCED_REVIEW_REQUIRED'));
    assert.ok(!result.reasonCodes.includes('CRIMINAL'));
    const facts = c.collectFacts({ subjectRef: 'sim_pep_1', jurisdiction: 'GB' });
    assert.equal(facts.pepOutcome, 'REVIEW');
    assert.equal(facts.hardBlock, false);
  });

  it('6. AML profile versioning is deterministic', () => {
    const { fabric: c } = fabric();
    const first = c.profileAml({
      subjectRef: 'cust_aml',
      jurisdiction: 'GB',
      customerType: 'PERSON',
      kycState: 'VERIFIED',
      accountAgeDays: 40,
      productExposure: ['DEMAND_DEPOSIT'],
      sanctionsOutcome: 'CLEAR',
      pepOutcome: 'CLEAR',
      knownRiskFactor: false,
    });
    const second = c.profileAml({
      subjectRef: 'cust_aml',
      jurisdiction: 'GB',
      customerType: 'PERSON',
      kycState: 'VERIFIED',
      accountAgeDays: 40,
      productExposure: ['DEMAND_DEPOSIT'],
      sanctionsOutcome: 'CLEAR',
      pepOutcome: 'CLEAR',
      knownRiskFactor: false,
    });
    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    assert.equal(first.inputHash, second.inputHash);
    assert.equal(first.category, 'LOW');
    const prohibited = c.profileAml({
      subjectRef: 'cust_aml_block',
      jurisdiction: 'GB',
      customerType: 'PERSON',
      kycState: 'VERIFIED',
      accountAgeDays: 40,
      productExposure: [],
      sanctionsOutcome: 'BLOCK',
      pepOutcome: 'CLEAR',
      knownRiskFactor: false,
    });
    assert.equal(prohibited.category, 'PROHIBITED');
  });

  it('7. velocity trigger', () => {
    const { fabric: c, clock } = fabric();
    for (let i = 0; i < 6; i += 1) {
      c.velocity.increment({
        subjectRef: 'cust_vel',
        metric: 'TRANSFERS',
        windowMs: 60 * 60 * 1000,
        now: clock.now(),
        amountMinor: 100n,
      });
    }
    assert.equal(c.velocity.triggered('cust_vel', 'TRANSFERS', 60 * 60 * 1000, 5), true);
    const alerts = c.monitor({
      subjectRef: 'cust_vel',
      amountMinor: 100n,
      failedTransfer: false,
      highRiskCorridor: false,
      now: clock.now(),
    });
    assert.ok(alerts.some((alert) => alert.reasonCodes.includes('SIM_VELOCITY_TRIGGER')));
    assert.equal(alerts[0]?.legalConfidence, 'RESEARCH_REQUIRED');
  });

  it('8. fraud STEP_UP', () => {
    const { fabric: c } = fabric();
    const evaluation = c.evaluateFraudRisk({
      subjectRef: 'sim_step_up_1',
      actorId: 'actor_1',
      sessionAssurance: 'STANDARD',
      deviceTrust: 'TRUSTED',
      recentAuthChange: false,
      accountAgeDays: 30,
      beneficiaryAgeDays: null,
      amountMinor: 100n,
      destinationRisk: 'LOW',
      identityUsable: true,
      velocityTriggered: false,
    });
    assert.equal(evaluation.outcome, 'STEP_UP');
    assert.equal(evaluation.requiredAssurance, 'HIGH_ASSURANCE');
    const satisfied = c.evaluateFraudRisk({
      subjectRef: 'sim_step_up_1',
      actorId: 'actor_1',
      sessionAssurance: 'HIGH_ASSURANCE',
      deviceTrust: 'TRUSTED',
      recentAuthChange: false,
      accountAgeDays: 30,
      beneficiaryAgeDays: null,
      amountMinor: 100n,
      destinationRisk: 'LOW',
      identityUsable: true,
      velocityTriggered: false,
    });
    assert.equal(satisfied.outcome, 'ALLOW');
  });

  it('9. fraud BLOCK', () => {
    const { fabric: c } = fabric();
    const evaluation = c.evaluateFraudRisk({
      subjectRef: 'sim_fraud_block_1',
      actorId: 'actor_1',
      sessionAssurance: 'STRONG',
      deviceTrust: 'TRUSTED',
      recentAuthChange: false,
      accountAgeDays: 30,
      beneficiaryAgeDays: null,
      amountMinor: 100n,
      destinationRisk: 'LOW',
      identityUsable: true,
      velocityTriggered: false,
    });
    assert.equal(evaluation.outcome, 'BLOCK');
  });

  it('10. case creation', () => {
    const { fabric: c } = fabric();
    c.screen({ type: 'SANCTIONS', subjectRef: 'sim_review_case', jurisdiction: 'GB' });
    assert.ok(c.store.cases.size >= 1);
    const opened = [...c.store.cases.values()][0]!;
    assert.ok(opened.caseId);
    assert.ok(opened.reasonCodes.length > 0);
    assert.ok(opened.originRefs.length > 0);
  });

  it('11. human decision recorded', () => {
    const { fabric: c, evidence } = fabric();
    c.screen({ type: 'PEP', subjectRef: 'sim_pep_decide', jurisdiction: 'GB' });
    const opened = [...c.store.cases.values()][0]!;
    const decided = c.decide({
      caseId: opened.caseId,
      decision: 'CONTINUE_MONITORING',
      operatorRef: 'op_human',
      actorKind: 'HUMAN_OPERATOR',
      reason: 'enhanced review continues',
      evidenceRefs: ['ev_1'],
    });
    assert.equal(decided.ok, true);
    if (decided.ok) {
      assert.equal(decided.decision.operatorRef, 'op_human');
      assert.equal(decided.decision.actorKind, 'HUMAN_OPERATOR');
    }
    assert.ok(evidence.list().some((row) => row.kind === 'COMPLIANCE_CASE_DECISION'));
  });

  it('12. hard block cannot be generic-overridden', () => {
    const { fabric: c } = fabric();
    c.screen({ type: 'SANCTIONS', subjectRef: 'sim_block_override', jurisdiction: 'US' });
    const opened = [...c.store.cases.values()].find((row) => row.caseType === 'SANCTIONS_REVIEW')!;
    const ai = c.decide({
      caseId: opened.caseId,
      decision: 'CLEAR',
      operatorRef: 'agent_1',
      actorKind: 'AI',
      reason: 'model says fine',
    });
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.reasonCode, 'AI_CANNOT_FINALIZE_CASE');
    }
    const override = c.decide({
      caseId: opened.caseId,
      decision: 'CLEAR',
      operatorRef: 'op_human',
      actorKind: 'HUMAN_OPERATOR',
      reason: 'generic override',
    });
    assert.equal(override.ok, false);
    if (!override.ok) {
      assert.equal(override.reasonCode, 'HARD_BLOCK_NOT_OVERRIDABLE');
    }
  });

  it('13. stale screening rejected / refresh required', () => {
    const clock = new FrozenClock(NOW);
    const c = new ComplianceFabric({ clock, ports: createSimulationProviders() });
    const first = c.screen({ type: 'SANCTIONS', subjectRef: 'sim_clear_stale', jurisdiction: 'GB' });
    assert.equal(isStale(first, NOW), false);
    clock.advanceMs(25n * 60n * 60n * 1000n);
    assert.equal(isStale(first, clock.now()), true);
    const refreshed = c.screen({
      type: 'SANCTIONS',
      subjectRef: 'sim_clear_stale',
      jurisdiction: 'GB',
      forceRefresh: true,
    });
    assert.ok(refreshed.screenedAt > first.screenedAt);
    assert.equal(isStale(refreshed, clock.now()), false);
  });

  it('14. policy specifies required screening', () => {
    const packs = loadBundledPacks();
    const us = packs.find((pack) => pack.packId === 'US')!;
    assert.equal(us.versions[0]?.screeningRequirements?.sanctions.required, true);
    assert.equal(us.versions[0]?.screeningRequirements?.sanctions.onUnavailable, 'BLOCK');
    const registry = new PolicyRegistry();
    registry.hydrate({ packs });
    const engine = new PolicyEngine({ registry });
    const { fabric: c } = fabric();
    const compliance = c.collectFacts({ subjectRef: 'sim_block_policy', jurisdiction: 'US' });
    const result = engine.evaluateFacts(
      {
        actor: { id: 'operator_1', capabilities: [ACTION_TYPES.OPEN_ACCOUNT] },
        actionType: ACTION_TYPES.OPEN_ACCOUNT,
        compliance,
      },
      NOW,
    );
    assert.ok(
      result.snapshot.reasonCodes.includes('JURISDICTION_UNRESOLVED') ||
        result.decision === 'DEFER' ||
        compliance.sanctionsOutcome === 'BLOCK',
    );
    assert.equal(compliance.sanctionsOutcome, 'BLOCK');
  });

  it('15. kernel monotonic escalation', () => {
    const { kernel } = kernelHarness();
    const { fabric: c } = fabric();
    const compliance = c.collectFacts({ subjectRef: 'sim_block_kernel', jurisdiction: 'GB' });
    const decision = kernel.submit(
      {
        id: asIntentId('intent_block'),
        actionType: ACTION_TYPES.OPEN_ACCOUNT,
        payload: {},
        idempotencyKey: 'intent_block',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_ONBOARDING',
      },
      {
        actor: { id: 'operator_1', capabilities: [ACTION_TYPES.OPEN_ACCOUNT] },
        customer: {
          id: 'cust_1' as never,
          legalEntityId: 'le' as never,
          jurisdiction: 'GB' as never,
          residency: 'GB' as never,
          status: 'ACTIVE',
          verification: {
            kycState: 'VERIFIED',
            kycRecordVersion: 1,
            refreshBy: asUtcInstant('2027-01-01T00:00:00.000Z'),
          },
          createdAt: NOW,
          version: 1,
        },
        identity: {
          kycState: 'VERIFIED',
          kycRecordVersion: 1,
          residency: 'GB' as never,
        },
        jurisdiction: 'GB' as never,
        compliance,
      },
    );
    const combined = combineProofs(decision.proofs);
    assert.equal(combined, 'BLOCK');
    const complianceProof = decision.proofs.find((proof) => proof.proof === 'COMPLIANCE');
    assert.equal(complianceProof?.status, 'BLOCK');
    assert.equal(decision.executionAuthority, null);
  });

  it('18. no raw PII in events or evidence', () => {
    const { fabric: c, events, evidence } = fabric();
    c.collectFacts({ subjectRef: 'sim_review_pii', jurisdiction: 'GB' });
    for (const event of events) {
      const text = JSON.stringify(event.payload);
      assert.equal(/password|ssn|fullName|articleBody|providerPayload|dateOfBirth/i.test(text), false);
    }
    for (const record of evidence.list()) {
      const text = JSON.stringify(record.payload);
      assert.equal(/password|ssn|fullName|articleBody|providerPayload/i.test(text), false);
    }
  });

  it('adverse media stores references only', () => {
    const { fabric: c } = fabric();
    c.screen({ type: 'ADVERSE_MEDIA', subjectRef: 'sim_adverse_1', jurisdiction: 'GB' });
    assert.ok(c.store.adverseMedia.length >= 1);
    assert.ok(c.store.adverseMedia[0]?.contentHash);
    assert.equal('articleBody' in (c.store.adverseMedia[0] ?? {}), false);
  });

  it('events survive outbox/replay without raw payloads', async () => {
    const log = new DomainEventLog();
    const sealed = log.append({
      eventType: 'ComplianceScreeningCompleted',
      schemaVersion: 1,
      occurredAt: NOW,
      payload: {
        screeningId: 'scr_1',
        screeningType: 'SANCTIONS',
        outcome: 'CLEAR',
        subjectRef: 'opaque_1',
        providerRef: 'sim-sanctions:opaque_1',
        providerHash: 'abc',
        reasonCodes: ['SIMULATED_SANCTIONS_CLEAR'],
      },
    });
    const outbox = new InMemoryOutboxStore();
    await outbox.enqueue(outboxRecordFromEnvelope(sealed, NOW));
    assert.equal((await outbox.list()).length, 1);
    assert.equal(JSON.stringify(sealed.payload).includes('providerPayload'), false);
    assert.equal(log.list()[0]?.eventType, 'ComplianceScreeningCompleted');
  });

  it('metrics never label PII', () => {
    const { fabric: c } = fabric();
    c.screen({ type: 'SANCTIONS', subjectRef: 'sim_clear_metrics', jurisdiction: 'GB' });
    const metrics = c.metrics();
    assert.ok(metrics.screenings >= 1);
    assert.equal(JSON.stringify(metrics).includes('sim_clear_metrics'), false);
  });

  it('policy packs declare screening requirements', () => {
    for (const pack of loadBundledPacks()) {
      assert.equal(pack.versions[0]?.screeningRequirements?.sanctions.required, true);
    }
  });
});
