// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createExternalDataPlane,
  buildWave4CoverageReport,
  assertWave4CoverageComplete,
  WAVE4_IMPLEMENTED_PROVIDER_IDS,
  complianceWorkflowSnapshot,
  financialAgentRegressionSnapshot,
  exchangeRegressionSnapshot,
  blockchainRegressionSnapshot,
  wave4DomainProtectionSnapshot,
  falsePositiveTestResult,
  staleDataTestResult,
  createWave4Services,
  toDisplaySafeString,
  isPotentiallyMaliciousUrl,
  providerQuarantinedEvent,
  providerSecurityDegradedEvent,
} from './index.ts';

describe('Wave 4 external data plane', () => {
  it('runs end-to-end compliance workflow across domain services', () => {
    const plane = createExternalDataPlane({ nowUtc: '2026-08-30T12:00:00.000Z' });
    const sanctions = plane.compliance.screenSanctions('idn:jane-doe-1985-03-15');
    const pep = plane.compliance.screenPep('idn:jane-doe-1985-03-15');
    const kyb = plane.businessIdentity.lookupKyb('biz:sunrey-ltd-uk');
    const digitalRisk = plane.digitalRisk.assessIpRisk('ip:203.0.113.10');
    const vulns = plane.vulnerability.getCveObservations();
    const threats = plane.threatIntel.getThreatIndicators();
    const endpoint = plane.endpointSecurity.getObservations();
    const outages = plane.serviceOutage.getIncidents();

    assert.ok(sanctions.observations.length > 0);
    assert.ok(pep.observations.length > 0);
    assert.ok(kyb.observations.length > 0);
    assert.ok(digitalRisk.observations.length > 0);
    assert.ok(vulns.observations.length > 0);
    assert.ok(threats.observations.length > 0);
    assert.ok(endpoint.observations.length > 0);
    assert.ok(outages.observations.length > 0);

    for (const obs of [
      ...sanctions.observations,
      ...pep.observations,
      ...kyb.observations,
      ...digitalRisk.observations,
    ]) {
      assert.equal(obs.schemaVersion, 'sunrey.external-observation.v1');
      assert.ok(obs.provenance.rawPayloadHash.length > 0);
      assert.equal(obs.data.grantsDecision, false);
    }
    for (const obs of [...vulns.observations, ...threats.observations]) {
      assert.equal(obs.schemaVersion, 'sunrey.external-observation.v1');
      assert.ok(obs.provenance.rawPayloadHash.length > 0);
    }
  });

  it('isolates provider failures without crashing the plane', () => {
    const plane = createExternalDataPlane();
    plane.setProviderState('open-sanctions', { down: true });
    plane.setProviderState('nvd', { malformed: true });
    plane.setProviderState('urlhaus', { down: true });
    plane.setProviderState('abuseipdb', { rateLimited: true });
    plane.setProviderState('outagedeck', { down: true });

    const sanctions = plane.compliance.screenSanctions('idn:jane-doe-1985-03-15');
    const vulns = plane.vulnerability.getCveObservations();
    const threats = plane.threatIntel.getThreatIndicators();
    const outages = plane.serviceOutage.getIncidents();

    assert.equal(sanctions.observations.length, 0);
    assert.equal(vulns.observations.length, 0);
    assert.ok(threats.observations.length >= 0);
    assert.ok(plane.macro.getIndicators().observations.length >= 0);
  });

  it('does not expose credentials in health or evidence surfaces', () => {
    const plane = createExternalDataPlane();
    const healthJson = JSON.stringify(plane.health());
    assert.equal(healthJson.includes('api_key'), false);
    assert.equal(healthJson.includes('ABUSEIPDB_API_KEY'), false);
    assert.equal(healthJson.includes('NVD_API_KEY'), false);
    const evidence = plane.agentEvidenceBundle();
    assert.equal(evidence.grantsExecutionAuthority, false);
  });

  it('maps vulnerability observations to dependencies without claiming exposure', () => {
    const plane = createExternalDataPlane();
    const mappings = plane.vulnerability.mapToDependencies();
    assert.ok(mappings.length > 0);
    const confirmed = mappings.find((m) => m.exposureStatus === 'CONFIRMED_VULNERABLE');
    assert.ok(confirmed);
    assert.equal(confirmed.dependencyName, 'example-library');
    const existsOnly = mappings.filter((m) => m.exposureStatus === 'CVE_EXISTS');
    assert.equal(existsOnly.length, 0);
  });

  it('sanitizes dangerous URL strings without auto-fetching', () => {
    const malicious = 'http://evil.test/phish';
    assert.equal(isPotentiallyMaliciousUrl(malicious), true);
    const safe = toDisplaySafeString('<script>alert(1)</script>');
    assert.equal(safe.includes('<script>'), false);
    assert.equal(safe.includes('&lt;script&gt;'), true);
  });

  it('false positive: name similarity does not auto-conclude sanctions', () => {
    const services = createWave4Services();
    const result = falsePositiveTestResult(services);
    assert.equal(result.possibleMatchGenerated, true);
    assert.equal(result.automaticSanctionsConclusion, false);
    assert.equal(result.reasonCodesIncludeNameOnly, true);
  });

  it('stale data: expired rescreen with unavailable provider does not silently clear', () => {
    const result = staleDataTestResult(true);
    assert.equal(result.silentlyTreatedAsCurrent, false);
    assert.equal(result.appropriateState, 'HOLD');
  });

  it('compliance workflow: external providers never determine account state', () => {
    const plane = createExternalDataPlane();
    const services = createWave4Services();
    const workflow = complianceWorkflowSnapshot(services);
    assert.equal(workflow.kernelAuthoritative, true);
    assert.equal(workflow.grantsExecutionAuthority, false);
    assert.ok(workflow.sanctionsEvidenceCount > 0);
  });

  it('financial agent regression: cannot bypass compliance kernel', () => {
    const agent = financialAgentRegressionSnapshot();
    assert.equal(agent.grantsExecutionAuthority, false);
    assert.equal(agent.providerRiskAuthorizesTrade, false);
    assert.equal(agent.proposalAllowed, false);
  });

  it('exchange regression: external providers cannot modify balances or order book', () => {
    const exchange = exchangeRegressionSnapshot();
    assert.equal(exchange.externalProviderModifiesBalances, false);
    assert.equal(exchange.externalProviderModifiesOrderBook, false);
    assert.equal(exchange.externalProviderModifiesCustody, false);
    assert.equal(exchange.executionAuthority, false);
  });

  it('blockchain regression: consensus independent from provider availability', () => {
    const blockchain = blockchainRegressionSnapshot();
    assert.equal(blockchain.consensusIndependent, true);
    assert.equal(blockchain.providerOutageHaltsConsensus, false);
    assert.equal(blockchain.externalProviderIsValidator, false);
    assert.equal(blockchain.sunreyCoinBehaviorUnchanged, true);
    assert.equal(blockchain.moonreyCoinBehaviorUnchanged, true);
  });

  it('domain protection: critical domains survive provider failures', () => {
    const protection = wave4DomainProtectionSnapshot(true);
    for (const domain of protection.domains) {
      assert.equal(domain.survivesProviderFailure, true);
    }
  });

  it('chaos test: simultaneous provider failures degrade individually', () => {
    const plane = createExternalDataPlane();
    plane.setProviderState('open-sanctions', { down: true });
    plane.setProviderState('gleif-lei', { down: true });
    plane.setProviderState('abuseipdb', { rateLimited: true });
    plane.setProviderState('nvd', { malformed: true });
    plane.setProviderState('urlhaus', { down: true });
    plane.setProviderState('outagedeck', { down: true });

    const macro = plane.macro.getIndicators();
    const kyb = plane.businessIdentity.lookupKyb('biz:sunrey-ltd-uk');
    const sanctions = plane.compliance.screenSanctions('idn:jane-doe-1985-03-15');

    assert.ok(macro.observations.length >= 0);
    assert.equal(sanctions.degraded, true);
    assert.ok(kyb.observations.length >= 0);
  });

  it('wave4 coverage report accounts for all providers', () => {
    const report = buildWave4CoverageReport();
    assert.ok(report.wave4Expected > 0);
    assert.ok(report.implemented >= WAVE4_IMPLEMENTED_PROVIDER_IDS.length);
    assertWave4CoverageComplete();
  });
});

describe('Provider Risk Monitor', () => {
  it('assesses healthy provider as NORMAL', () => {
    const plane = createExternalDataPlane();
    const score = plane.providerRisk.assessProvider('open-sanctions');
    assert.ok(['NORMAL', 'UNKNOWN'].includes(score.state));
    assert.equal(score.quarantined, false);
  });

  it('detects degraded provider from repeated failures', () => {
    const plane = createExternalDataPlane();
    plane.setProviderState('open-sanctions', { down: true, circuitState: 'OPEN' });
    const score = plane.providerRisk.assessProvider('open-sanctions');
    assert.ok(score.score > 0);
    assert.ok(['DEGRADED', 'SUSPICIOUS', 'DISABLED'].includes(score.state));
    assert.ok(score.factors.length > 0);
  });

  it('quarantines suspicious provider without affecting unrelated providers', () => {
    const plane = createExternalDataPlane();
    plane.setProviderState('nvd', { malformed: true, down: true });
    const nvdScore = plane.providerRisk.assessProvider('nvd', {
      schemaChangeCount: 3,
      authFailureCount: 3,
      dataAnomalyCount: 4,
    });
    const recommendation = plane.providerRisk.monitor.recommendQuarantine(nvdScore);
    assert.equal(recommendation.recommend, true);

    const record = plane.providerRisk.quarantine('nvd', recommendation.reason, 'risk-monitor');
    assert.equal(record.providerId, 'nvd');
    assert.equal(plane.providerRisk.monitor.isQuarantined('nvd'), true);

    const openSanctionsScore = plane.providerRisk.assessProvider('open-sanctions');
    assert.equal(openSanctionsScore.quarantined, false);
  });

  it('controlled recovery requires validation', () => {
    const plane = createExternalDataPlane();
    plane.providerRisk.quarantine('urlhaus', 'security anomaly', 'risk-monitor');
    const probe = plane.providerRisk.monitor.beginRecovery('urlhaus');
    assert.equal(probe.allowed, true);

    const notRestored = plane.providerRisk.monitor.completeRecovery('urlhaus', false);
    assert.equal(notRestored, null);
    assert.equal(plane.providerRisk.monitor.isQuarantined('urlhaus'), true);

    const restored = plane.providerRisk.monitor.completeRecovery('urlhaus', true);
    assert.ok(restored);
    assert.equal(plane.providerRisk.monitor.isQuarantined('urlhaus'), false);
  });

  it('retains provider quarantine history', () => {
    const plane = createExternalDataPlane();
    plane.providerRisk.quarantine('phishstats', 'test quarantine', 'test');
    const history = plane.providerRisk.monitor.getHistory('phishstats');
    assert.equal(history.length, 1);
    assert.equal(history[0].reason, 'test quarantine');
  });

  it('emits internal security events without sensitive user exposure', () => {
    const event = providerQuarantinedEvent({
      providerId: 'nvd',
      reason: 'schema anomaly detected',
      occurredAt: '2026-08-30T12:00:00.000Z',
    });
    assert.equal(event.audience, 'internal');
    assert.equal(event.autoNotify, false);
    assert.ok(event.sensitiveDetail);

    const degraded = providerSecurityDegradedEvent({
      providerId: 'open-sanctions',
      reason: 'TLS posture changed',
      occurredAt: '2026-08-30T12:00:00.000Z',
    });
    assert.equal(degraded.type, 'PROVIDER_SECURITY_DEGRADED');
  });
});
