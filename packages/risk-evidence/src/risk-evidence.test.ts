import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  businessesAreDistinct,
  createDefaultRiskAdapterStates,
  createRiskEvidencePlane,
  evaluateFromEvidence,
  extractRiskFeatures,
  fetchDigitalRiskEvidence,
  FIXTURE_BUSINESSES,
  lookupBusinessEvidence,
  normalizeProviderScore,
  searchBusinessEvidence,
  wave4CoverageSummary,
  WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS,
  assertRiskEvidencePayloadMinimized,
  buildProviderOutboundPayload,
  redactEmailForLog,
  redactIpForLog,
  sessionEvidenceExpired,
} from './index.ts';

const NOW = '2026-08-30T12:00:00.000Z';

function ctx() {
  return { nowUtc: NOW, states: createDefaultRiskAdapterStates() };
}

describe('risk-evidence unit tests', () => {
  it('catalog has exactly one eligible Wave 0 provider', () => {
    assert.equal(WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS.length, 1);
    assert.equal(WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS[0], 'sec-edgar');
  });

  it('searches business by registration number', () => {
    const results = searchBusinessEvidence(ctx(), {
      registrationNumber: '12345678',
      jurisdiction: 'GB',
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.legalName, 'ABC Holdings Ltd');
    assert.equal(results[0]!.jurisdiction, 'GB');
  });

  it('resolves US business via sec-edgar', () => {
    const result = lookupBusinessEvidence(ctx(), {
      registrationNumber: '0000320193',
      jurisdiction: 'US',
    });
    assert.ok(result);
    assert.equal(result!.legalName, 'Apple Inc.');
    assert.equal(result!.providerId, 'sec-edgar');
  });

  it('distinguishes duplicate business names across jurisdictions', () => {
    const gb = FIXTURE_BUSINESSES.find((b) => b.jurisdiction === 'GB')!;
    const us = FIXTURE_BUSINESSES.find((b) => b.jurisdiction === 'US' && b.legalName === 'ABC Holdings Ltd')!;
    assert.equal(gb.legalName, us.legalName);
    assert.ok(businessesAreDistinct(gb, us));
  });

  it('preserves inactive business status without fraud inference', () => {
    const dissolved = FIXTURE_BUSINESSES.find((b) => b.status === 'DISSOLVED')!;
    assert.equal(dissolved.status, 'DISSOLVED');
    assert.equal(dissolved.providerNativeStatus, 'Dissolved');
    const decision = evaluateFromEvidence([dissolved], [], NOW);
    assert.equal(decision.outcome, 'REVIEW');
    assert.ok(decision.reasonCodes.includes('INACTIVE_BUSINESS_STATUS'));
    assert.notEqual(decision.outcome, 'REJECT');
  });

  it('handles provider disagreement via deterministic policy', () => {
    const active = FIXTURE_BUSINESSES.find((b) => b.status === 'ACTIVE' && b.jurisdiction === 'GB')!;
    const dissolved = FIXTURE_BUSINESSES.find((b) => b.status === 'DISSOLVED')!;
    const features = extractRiskFeatures([active, dissolved], []);
    assert.ok(features.some((f) => f.code === 'BUSINESS_INACTIVE'));
  });

  it('normalizes IP reputation', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'ip-clean',
      riskType: 'IP_REPUTATION',
      sessionId: 'sess_1',
    });
    assert.ok(evidence);
    assert.equal(evidence!.riskType, 'IP_REPUTATION');
    assert.ok(evidence!.ipIntelligence);
    assert.equal(evidence!.ipIntelligence!.vpn, false);
    assert.equal(evidence!.ipIntelligence!.tor, false);
  });

  it('normalizes VPN signal without auto-reject', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'session-vpn',
      riskType: 'VPN',
    });
    assert.ok(evidence);
    assert.equal(evidence!.ipIntelligence!.vpn, true);
    const decision = evaluateFromEvidence([], [evidence!], NOW);
    assert.equal(decision.outcome, 'STEP_UP_AUTH');
    assert.notEqual(decision.outcome, 'REJECT');
  });

  it('normalizes Tor signal', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'session-tor',
      riskType: 'TOR',
    });
    assert.ok(evidence);
    assert.equal(evidence!.ipIntelligence!.tor, true);
  });

  it('normalizes proxy signal', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'session-proxy',
      riskType: 'PROXY',
    });
    assert.ok(evidence);
    assert.equal(evidence!.ipIntelligence!.proxy, true);
  });

  it('normalizes email reputation', () => {
    const evidence = fetchDigitalRiskEvidence(ctx(), {
      subjectRef: 'email-suspicious',
      riskType: 'EMAIL_REPUTATION',
    });
    assert.ok(evidence);
    assert.ok(evidence!.emailReputation);
    assert.equal(evidence!.emailReputation!.suspicious, true);
  });

  it('rejects malformed provider score', () => {
    assert.equal(normalizeProviderScore(Number.MAX_VALUE), null);
    assert.equal(normalizeProviderScore('bad'), null);
    assert.equal(normalizeProviderScore(50), 50);
  });

  it('treats stale session evidence', () => {
    const staleAt = '2026-08-20T12:00:00.000Z';
    assert.equal(sessionEvidenceExpired(staleAt, NOW), true);
  });

  it('handles provider unavailable', () => {
    const c = ctx();
    c.states.set('fixture-aml', {
      enabled: true,
      down: true,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
    });
    const evidence = fetchDigitalRiskEvidence(c, { subjectRef: 'test', riskType: 'VPN' });
    assert.equal(evidence, null);
  });

  it('handles rate limit', () => {
    const c = ctx();
    c.states.set('fixture-aml', {
      enabled: true,
      down: false,
      rateLimited: true,
      malformed: false,
      lastSuccess: null,
      lastError: null,
    });
    const evidence = fetchDigitalRiskEvidence(c, { subjectRef: 'test', riskType: 'VPN' });
    assert.equal(evidence, null);
  });

  it('risk evidence does not automatically reject on VPN alone', () => {
    const vpn = fetchDigitalRiskEvidence(ctx(), { subjectRef: 'vpn', riskType: 'VPN' })!;
    const decision = evaluateFromEvidence([], [vpn], NOW);
    assert.notEqual(decision.outcome, 'REJECT');
    assert.equal(decision.providerScoreUsed, false);
  });

  it('deterministic policy receives evidence features', () => {
    const plane = createRiskEvidencePlane(ctx());
    const digital = plane.collectSessionRisk({ sessionId: 's1', subjectRef: 'tor-travel' });
    const decision = plane.evaluatePolicy([], digital);
    assert.ok(decision.reasonCodes.length > 0);
    assert.equal(decision.providerScoreUsed, false);
  });

  it('enforces data minimization on outbound payload', () => {
    const payload = buildProviderOutboundPayload({
      ipHash: 'hash:ip',
      companyName: 'Test Co',
      jurisdiction: 'GB',
    });
    assert.equal(payload.ipHash, 'hash:ip');
    assert.throws(() => assertRiskEvidencePayloadMinimized({ vaultContents: 'secret' }));
  });

  it('redacts sensitive data in logs', () => {
    assert.equal(redactIpForLog('192.168.1.100'), '192.168.xxx.xxx');
    assert.equal(redactEmailForLog('user@example.com'), '***@example.com');
  });

  it('coverage summary reports zero kyb/fraud catalog providers', () => {
    const summary = wave4CoverageSummary();
    assert.equal(summary.eligibleCatalogCount, 1);
    assert.ok(summary.providers.some((p) => p.category === 'kyb_identity' && p.status === 'NOT_IN_CATALOG'));
  });
});
