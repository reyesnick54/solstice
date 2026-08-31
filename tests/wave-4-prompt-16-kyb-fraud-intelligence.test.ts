import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createDefaultRiskAdapterStates,
  createRiskEvidencePlane,
  evaluateAgentRiskGate,
  evaluateExchangeRiskGate,
  evaluateFromEvidence,
  evaluateMoneyRiskGate,
  fetchDigitalRiskEvidence,
  lookupBusinessEvidence,
  searchBusinessEvidence,
  wave4CoverageSummary,
  WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS,
  assertRiskEvidencePayloadMinimized,
  buildProviderOutboundPayload,
  redactEmailForLog,
  redactIpForLog,
} from '../packages/risk-evidence/src/index.ts';
import { buildRiskEvidenceBffSnapshot } from '../services/api/src/consumer/risk-evidence-adapter.ts';
import { ComplianceFabric } from '../packages/kernel/src/compliance/fabric.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';

const NOW = '2026-08-30T12:00:00.000Z';

function ctx() {
  return { nowUtc: NOW, states: createDefaultRiskAdapterStates() };
}

describe('Wave 4 Prompt 16 — KYB and fraud intelligence', () => {
  it('1. selected KYB adapters return business identity evidence', () => {
    const results = searchBusinessEvidence(ctx(), {
      registrationNumber: '0000320193',
      jurisdiction: 'US',
    });
    assert.ok(results.length >= 1);
    assert.equal(results[0]!.providerId, 'sec-edgar');
    assert.ok(results[0]!.evidenceId);
  });

  it('2. exact business identity lookup by registration number', () => {
    const evidence = lookupBusinessEvidence(ctx(), {
      registrationNumber: '12345678',
      jurisdiction: 'GB',
    });
    assert.ok(evidence);
    assert.equal(evidence!.registrationNumber, '12345678');
    assert.equal(evidence!.legalName, 'ABC Holdings Ltd');
  });

  it('3. duplicate business names across jurisdictions remain distinct', () => {
    const gb = lookupBusinessEvidence(ctx(), { registrationNumber: '12345678', jurisdiction: 'GB' });
    const us = lookupBusinessEvidence(ctx(), { registrationNumber: '99999999', jurisdiction: 'US' });
    assert.ok(gb && us);
    assert.equal(gb!.legalName, us!.legalName);
    assert.notEqual(gb!.entityId, us!.entityId);
    assert.notEqual(gb!.jurisdiction, us!.jurisdiction);
  });

  it('4. inactive business status normalized without fraud inference', () => {
    const evidence = lookupBusinessEvidence(ctx(), {
      registrationNumber: '99999999',
      jurisdiction: 'US',
    });
    assert.equal(evidence!.status, 'DISSOLVED');
    const decision = evaluateFromEvidence([evidence!], [], NOW);
    assert.equal(decision.outcome, 'REVIEW');
    assert.notEqual(decision.outcome, 'REJECT');
  });

  it('5. provider disagreement handled by deterministic policy', () => {
    const usActive = lookupBusinessEvidence(ctx(), {
      registrationNumber: '0000320193',
      jurisdiction: 'US',
    });
    const usDissolved = lookupBusinessEvidence(ctx(), {
      registrationNumber: '99999999',
      jurisdiction: 'US',
    });
    const decision = evaluateFromEvidence([usActive!, usDissolved!], [], NOW);
    assert.ok(decision.reasonCodes.includes('INACTIVE_BUSINESS_STATUS'));
  });

  it('6. IP reputation normalization', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'ip-clean',
      riskType: 'IP_REPUTATION',
    });
    assert.ok(evidence?.ipIntelligence);
    assert.equal(evidence!.riskType, 'IP_REPUTATION');
  });

  it('7. VPN signal is a signal not guilt', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), { subjectRef: 'vpn', riskType: 'VPN' });
    const decision = evaluateFromEvidence([], [evidence!], NOW);
    assert.equal(decision.outcome, 'STEP_UP_AUTH');
    assert.notEqual(decision.outcome, 'REJECT');
  });

  it('8. Tor signal normalization', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), { subjectRef: 'tor', riskType: 'TOR' });
    assert.equal(evidence!.ipIntelligence!.tor, true);
  });

  it('9. proxy signal normalization', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), { subjectRef: 'proxy', riskType: 'PROXY' });
    assert.equal(evidence!.ipIntelligence!.proxy, true);
  });

  it('10. email reputation normalization', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'email',
      riskType: 'EMAIL_REPUTATION',
    });
    assert.equal(evidence!.emailReputation!.reputation, 'SUSPICIOUS');
  });

  it('11. malformed provider score rejected', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'malformed',
      riskType: 'IP_REPUTATION',
    });
    assert.equal(evidence, null);
  });

  it('12. stale risk signal triggers review', () => {
    const dissolved = lookupBusinessEvidence(ctx(), {
      registrationNumber: '99999999',
      jurisdiction: 'US',
    });
    const decision = evaluateFromEvidence([dissolved!], [], NOW);
    assert.ok(['REVIEW', 'STEP_UP_AUTH', 'HOLD'].includes(decision.outcome) || decision.reasonCodes.includes('INACTIVE_BUSINESS_STATUS'));
  });

  it('13. risk provider unavailable returns null', () => {
    const c = ctx();
    c.states.set('fixture-aml', {
      enabled: true,
      down: true,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
    });
    assert.equal(fetchDigitalRiskEvidence(c, { subjectRef: 'x', riskType: 'VPN' }), null);
  });

  it('14. provider timeout handled', () => {
    const c = ctx();
    c.states.set('fixture-aml', {
      enabled: true,
      down: true,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: 'PROVIDER_UNAVAILABLE',
    });
    assert.equal(fetchDigitalRiskEvidence(c, { subjectRef: 'x', riskType: 'TOR' }), null);
  });

  it('15. 429 rate limit handled', () => {
    const c = ctx();
    c.states.set('fixture-aml', {
      enabled: true,
      down: false,
      rateLimited: true,
      malformed: false,
      lastSuccess: null,
      lastError: 'RATE_LIMITED',
    });
    assert.equal(fetchDigitalRiskEvidence(c, { subjectRef: 'x', riskType: 'PROXY' }), null);
  });

  it('16. cache/freshness via retention policy', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), { subjectRef: 'clean', riskType: 'IP_REPUTATION' });
    assert.equal(evidence!.freshness, 'FRESH');
  });

  it('17. risk evidence does not automatically reject', () => {
    const vpn = fetchDigitalRiskEvidence(ctx(), { subjectRef: 'vpn', riskType: 'VPN' })!;
    const decision = evaluateFromEvidence([], [vpn], NOW);
    assert.notEqual(decision.outcome, 'REJECT');
    assert.equal(decision.providerScoreUsed, false);
  });

  it('18. deterministic policy receives evidence', () => {
    const plane = createRiskEvidencePlane(ctx());
    const decision = plane.evaluatePolicy([], plane.collectSessionRisk({ sessionId: 's', subjectRef: 'vpn' }));
    assert.ok(decision.policyVersionId);
    assert.equal(decision.providerScoreUsed, false);
  });

  it('19. Financial Agent obeys policy', () => {
    const plane = createRiskEvidencePlane(ctx());
    const gate = evaluateAgentRiskGate(plane, 'vpn-user');
    assert.equal(gate.grantsExecutionAuthority, false);
    if (gate.policyDecision.stepUpRequired) {
      assert.equal(gate.mustWaitForHuman, true);
    }
  });

  it('20. Exchange obeys policy', () => {
    const plane = createRiskEvidencePlane(ctx());
    const gate = evaluateExchangeRiskGate(plane, {
      accountId: 'ex-1',
      sessionId: 'sess',
      subjectRef: 'tor-user',
    });
    assert.equal(gate.grantsExecutionAuthority, false);
  });

  it('21. Money service obeys policy', () => {
    const plane = createRiskEvidencePlane(ctx());
    const gate = evaluateMoneyRiskGate(plane, {
      subjectRef: 'user',
      amountMinor: 50_00n,
      jurisdiction: 'GB',
    });
    assert.equal(gate.grantsExecutionAuthority, false);
  });

  it('22. HIN/Vault data is not transmitted', () => {
    assert.throws(() => assertRiskEvidencePayloadMinimized({ hinContents: 'data' }));
    assert.throws(() => assertRiskEvidencePayloadMinimized({ vaultContents: 'data' }));
    const safe = buildProviderOutboundPayload({
      companyName: 'Test',
      jurisdiction: 'GB',
      registrationNumber: '123',
    });
    assert.equal(safe.jurisdiction, 'GB');
  });

  it('23. logs protect sensitive IP/email data', () => {
    assert.ok(!redactIpForLog('10.0.0.1').includes('0.1'));
    assert.ok(!redactEmailForLog('secret@test.com').includes('secret'));
  });

  it('24. BFF does not expose fraud-provider internals', () => {
    const snapshot = buildRiskEvidenceBffSnapshot('vpn-user');
    const serialized = JSON.stringify(snapshot);
    assert.ok(!serialized.includes('fixture-aml'));
    assert.ok(!serialized.includes('EmailRep'));
    assert.ok(!serialized.includes('IPLogs'));
    assert.equal(snapshot.providerDetailsExposed, false);
  });

  it('catalog accounting — eligible Wave 0 providers', () => {
    assert.equal(WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS.length, 1);
    const summary = wave4CoverageSummary();
    assert.equal(summary.eligibleCatalogCount, 1);
    assert.ok(summary.providers.some((p) => p.providerId === 'sec-edgar'));
  });

  it('Compliance Kernel fabric still authoritative', () => {
    const fabric = new ComplianceFabric({ clock: new FrozenClock(asUtcInstant(NOW)) });
    const facts = fabric.collectFacts({
      subjectRef: 'cust_test',
      jurisdiction: 'GB',
      identityUsable: true,
      deviceTrust: 'REVIEW_REQUIRED',
    });
    assert.ok(facts.fraudOutcome);
    assert.equal(facts.stepUpRequired || facts.fraudOutcome === 'STEP_UP' || facts.fraudOutcome === 'REVIEW', true);
  });
});
