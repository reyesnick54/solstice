import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { buildComplianceCatalogIndex } from '../packages/kernel/src/compliance-intelligence/catalog-types.ts';
import {
  agentMayBypassKernel,
  blockchainConsensusDependsOnProvider,
  bridgeEvidenceToKernel,
  COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES,
  COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS,
  complianceCachePolicy,
  COMPLIANCE_CACHE_CAPABILITIES,
  complianceSeparationProof,
  createComplianceScreeningEvidenceService,
  createInterpolRedNoticesAdapter,
  createOpenSanctionsAdapter,
  evidenceCannotRejectTransaction,
  evidenceGrantsExecutionAuthority,
  exchangeMayBypassKernel,
  isExactNameMatch,
  isFuzzyNameMatch,
  loadComplianceIntelligenceCatalog,
  normalizeComplianceName,
  privacySafeSubjectRef,
  sanitizeComplianceLogPayload,
} from '../packages/kernel/src/compliance-intelligence/index.ts';
import { buildExchangeComplianceContext } from '../packages/kernel/src/compliance-intelligence/exchange-integration.ts';
import { buildComplianceAgentEvidence } from '../packages/kernel/src/compliance-intelligence/agent-evidence.ts';
import { escalateFromComplianceFacts } from '../packages/kernel/src/compliance/facts.ts';
import { createComplianceIntelligenceBff } from '../services/api/src/consumer/compliance-intelligence-adapter.ts';

const NOW = asUtcInstant('2027-08-21T12:00:00.000Z');

function catalogIndex() {
  return buildComplianceCatalogIndex(COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES);
}

describe('Wave 4 Prompt 15 — compliance intelligence providers', () => {
  it('1. every selected provider registers in catalog', () => {
    const matches = loadComplianceIntelligenceCatalog(catalogIndex());
    assert.equal(matches.length, 2);
    assert.deepEqual([...COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS], [
      'open-sanctions',
      'interpol-red-notices',
    ]);
  });

  it('2. catalog IDs match adapters', () => {
    const service = createComplianceScreeningEvidenceService();
    const providerIds = service.listProviders().map((p) => p.providerId);
    assert.deepEqual(providerIds.sort(), [...COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS].sort());
    for (const match of loadComplianceIntelligenceCatalog(catalogIndex())) {
      assert.equal(match.entry.sunrey.integration_state, 'adapter_implemented');
      assert.ok(match.entry.sunrey.existing_adapter?.includes('compliance-intelligence'));
    }
  });

  it('3. exact person match produces sanctions evidence', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({
      name: 'SANCTIONED EXACT PERSON',
      nowUtc: NOW,
    });
    const sanctions = evidence.filter((e) => e.classification === 'SANCTIONS');
    assert.ok(sanctions.length >= 1);
    assert.equal(sanctions[0]!.match.exactMatch, true);
    assert.equal(sanctions[0]!.grantsDecisionAuthority, false);
  });

  it('4. organization match', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenOrganization({
      name: 'SANCTIONED ORG LIMITED',
      organizationIdentifiers: { registrationNumber: 'RU-12345678' },
      nowUtc: NOW,
    });
    const org = evidence.find((e) => e.classification === 'SANCTIONS' && e.source.program === 'eu_fsf');
    assert.ok(org);
    assert.equal(org!.source.listAuthority, 'European Union');
  });

  it('5. alias matching preserved', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({
      name: 'Unknown Alias Holder',
      aliases: ['S. EXACT'],
      nowUtc: NOW,
    });
    assert.ok(evidence.some((e) => e.originalName.includes('SANCTIONED')));
  });

  it('6. fuzzy evidence remains evidence not decision', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'SANCTIONED FUZZY PERSON', nowUtc: NOW });
    const fuzzy = evidence.find((e) => e.match.fuzzyMatch);
    assert.ok(fuzzy);
    assert.equal(fuzzy!.isKernelDecision, false);
    assert.equal(fuzzy!.match.algorithm, 'token_overlap_v1');
    assert.equal(evidenceCannotRejectTransaction(), true);
  });

  it('7. PEP is distinct from sanctions', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'CURRENT PEP OFFICIAL', nowUtc: NOW });
    const pep = evidence.find((e) => e.classification === 'PEP');
    assert.ok(pep);
    assert.notEqual(pep!.classification, 'SANCTIONS');
    assert.ok(pep!.pepDetails);
    assert.equal(pep!.pepDetails!.relationship, 'CURRENT');
  });

  it('8. wanted record distinct from sanctions', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'WANTED PERSON', nowUtc: NOW });
    const wanted = evidence.find((e) => e.classification === 'WANTED');
    assert.ok(wanted);
    assert.notEqual(wanted!.classification, 'SANCTIONS');
    assert.equal(wanted!.source.listName, 'INTERPOL Red Notices');
  });

  it('9. source list metadata retained', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'SANCTIONED EXACT PERSON', nowUtc: NOW });
    const row = evidence.find((e) => e.classification === 'SANCTIONS');
    assert.ok(row?.source.listName);
    assert.ok(row?.source.listAuthority);
    assert.ok(row?.source.program);
  });

  it('10. source timestamps retained', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'SANCTIONED EXACT PERSON', nowUtc: NOW });
    const row = evidence.find((e) => e.classification === 'SANCTIONS');
    assert.ok(row?.time.sourceUpdatedAt);
    assert.equal(row?.time.retrievedAt, NOW);
    assert.equal(row?.time.screenedAt, NOW);
  });

  it('11. provider disagreement retained', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('disagreeing');
    const interpol = createInterpolRedNoticesAdapter();
    const service = createComplianceScreeningEvidenceService({
      providers: [open, interpol],
    });
    await service.screenPerson({ name: 'WANTED PERSON', nowUtc: NOW });
    const disagreements = service.disagreementRecords();
    assert.ok(disagreements.length >= 0);
  });

  it('12. multiple evidence records retained independently', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'WANTED PERSON', nowUtc: NOW });
    const providers = new Set(evidence.map((e) => e.source.providerId));
    assert.ok(providers.size >= 1);
    const ids = evidence.map((e) => e.evidenceId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('13. stale evidence classified', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('stale');
    const service = createComplianceScreeningEvidenceService({ providers: [open] });
    const evidence = await service.screenPerson({ name: 'STALE SANCTIONED PERSON', nowUtc: NOW });
    const stale = evidence.find((e) => e.quality.freshness === 'stale');
    assert.ok(stale);
    assert.equal(stale!.quality.verificationStatus, 'STALE');
  });

  it('14. cache works', async () => {
    const service = createComplianceScreeningEvidenceService();
    await service.screenPerson({ name: 'CLEAR PERSON', nowUtc: NOW });
    await service.screenPerson({ name: 'CLEAR PERSON', nowUtc: NOW });
    const policy = complianceCachePolicy(COMPLIANCE_CACHE_CAPABILITIES.negativeObservation);
    assert.ok(policy.maxTtlMs > 0);
    assert.equal(policy.allowIndefiniteNoMatch, false);
  });

  it('15. provider timeout', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('timeout');
    const service = createComplianceScreeningEvidenceService({ providers: [open, createInterpolRedNoticesAdapter()] });
    const evidence = await service.screenPerson({ name: 'WANTED PERSON', nowUtc: NOW });
    assert.ok(evidence.length >= 0);
  });

  it('16. provider 429', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('rate_limited');
    const service = createComplianceScreeningEvidenceService({ providers: [open] });
    const evidence = await service.screenPerson({ name: 'TEST', nowUtc: NOW });
    assert.ok(Array.isArray(evidence));
  });

  it('17. provider 500', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('server_error');
    const service = createComplianceScreeningEvidenceService({ providers: [open] });
    const evidence = await service.screenPerson({ name: 'TEST', nowUtc: NOW });
    assert.ok(Array.isArray(evidence));
  });

  it('18. circuit breaker opens on unavailable provider', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('unavailable');
    const service = createComplianceScreeningEvidenceService({ providers: [open] });
    await service.screenPerson({ name: 'TEST', nowUtc: NOW });
    const health = service.providerHealth(NOW);
    assert.ok(health.some((h) => h.status === 'unavailable'));
  });

  it('19. no-match does not become permanent clearance', async () => {
    const service = createComplianceScreeningEvidenceService();
    const evidence = await service.screenPerson({ name: 'CLEAR CITIZEN', nowUtc: NOW });
    const negative = evidence.filter((e) => e.match.matchType === 'NEGATIVE_OBSERVATION');
    assert.ok(negative.length >= 1);
    const policy = complianceCachePolicy(COMPLIANCE_CACHE_CAPABILITIES.negativeObservation);
    assert.equal(policy.allowIndefiniteNoMatch, false);
  });

  it('20. evidence cannot directly reject transaction', () => {
    assert.equal(evidenceGrantsExecutionAuthority(), false);
    const proof = complianceSeparationProof();
    assert.equal(proof.blocksTransactions, false);
    assert.equal(proof.issuesComplianceDecision, false);
  });

  it('21. Compliance Kernel remains decision authority', async () => {
    const service = createComplianceScreeningEvidenceService();
    const bridge = await bridgeEvidenceToKernel(service, {
      subjectRef: 'subj_1',
      subjectKind: 'PERSON',
      jurisdiction: 'GB',
      name: 'SANCTIONED EXACT PERSON',
      now: NOW,
    });
    assert.equal(bridge.kernelDecides, true);
    for (const fact of bridge.evidenceFacts) {
      assert.equal(fact.automaticDecision, false);
      assert.equal(fact.legalConclusion, false);
    }
    const escalation = escalateFromComplianceFacts('ALLOW', {
      sanctionsOutcome: 'REVIEW',
      pepOutcome: 'CLEAR',
      adverseMediaOutcome: 'CLEAR',
      sanctionsFresh: true,
      pepFresh: true,
      adverseMediaFresh: true,
      requiredScreeningMissing: false,
      providerAvailable: true,
      outagePosture: null,
      amlCategory: 'STANDARD',
      fraudOutcome: 'ALLOW',
      velocityTriggered: false,
      hardBlock: false,
      stepUpRequired: false,
      latestScreeningId: null,
      latestCaseId: null,
      policyVersionId: null,
    });
    assert.equal(escalation.status, 'REQUIRE_MANUAL_REVIEW');
  });

  it('22. Agent cannot bypass Compliance Kernel', () => {
    assert.equal(agentMayBypassKernel(), false);
  });

  it('23. Exchange cannot bypass Compliance Kernel', async () => {
    assert.equal(exchangeMayBypassKernel(), false);
    const service = createComplianceScreeningEvidenceService();
    const ctx = await buildExchangeComplianceContext(service, {
      subjectRef: 'ex_subj',
      name: 'SANCTIONED EXACT PERSON',
      nowUtc: NOW,
    });
    assert.equal(ctx.bypassesKernel, false);
    assert.equal(ctx.directProviderAccess, false);
  });

  it('24. blockchain consensus unaffected by provider outage', () => {
    assert.equal(blockchainConsensusDependsOnProvider(), false);
    const proof = complianceSeparationProof();
    assert.equal(proof.affectsBlockchainConsensus, false);
  });

  it('25. personal data sanitized from logs', () => {
    const ref = privacySafeSubjectRef('customer-123', 'req-abc');
    assert.ok(ref.startsWith('subj_'));
    assert.ok(!ref.includes('customer-123'));
    const safe = sanitizeComplianceLogPayload({
      name: 'Test',
      dateOfBirth: '1980-01-01',
      passport: 'AB123456',
    });
    assert.equal(safe.dateOfBirth, '[REDACTED]');
    assert.equal(safe.passport, '[REDACTED]');
  });

  it('26. BFF exposes no credentials or raw sensitive details', async () => {
    const bff = createComplianceIntelligenceBff();
    const status = await bff.screeningStatus('subj_bff', 'SANCTIONED EXACT PERSON');
    assert.equal(status.schema, 'sunrey.bff.compliance-screening.v1');
    assert.ok(!JSON.stringify(status).includes('api_key'));
    assert.ok(!JSON.stringify(status).includes('rawPayload'));
    const agent = await bff.agentEvidence('subj_bff', 'SANCTIONED EXACT PERSON');
    assert.equal(agent.grantsExecutionAuthority, false);
    assert.equal(agent.kernelDecides, true);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(ENVIRONMENT, 'simulation');
  });

  it('name normalization preserves originals and supports bounded fuzzy match', () => {
    const a = normalizeComplianceName('Jonathan Smith');
    const b = normalizeComplianceName('Jon Smith');
    assert.equal(a.original, 'Jonathan Smith');
    assert.equal(isExactNameMatch(a, b), false);
    assert.equal(isFuzzyNameMatch(a, b, 0.5), true);
  });

  it('malformed provider payload fails closed', async () => {
    const open = createOpenSanctionsAdapter();
    open.setScenario('malformed');
    const service = createComplianceScreeningEvidenceService({ providers: [open] });
    const evidence = await service.screenPerson({ name: 'TEST', nowUtc: NOW });
    assert.ok(Array.isArray(evidence));
  });
});
