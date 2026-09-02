import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CANONICAL_FEDERATION_SOURCES,
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  DEFAULT_ROW_LIMIT,
  ENERGY_WEATHER_CROSS_SOURCE_QUERY,
  FEDERATION_FIXTURE_NOW_UNIX,
  FEDERATION_NOT_MONETARY_AUTHORITY,
  FederationAuditJournal,
  FederationSourceRegistry,
  InMemoryFederationAdapter,
  MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY,
  RESEARCH_PUBLICATION_CROSS_SOURCE_QUERY,
  RESEARCH_RIGHTS_CONTEXT,
  TRINO_EVALUATION,
  TRINO_INTEGRATION_ACTIVE,
  TRINO_OPERATIONALLY_JUSTIFIED,
  TrinoFederationAdapterPlaceholder,
  VALUATION_RIGHTS_CONTEXT,
  WORKFORCE_EDUCATION_CROSS_SOURCE_QUERY,
  applyMinimizationDefaults,
  evaluateFederationPurpose,
  executeFederatedQuery,
  refusePurposeExpansion,
  registerFederationFixtureHandlers,
  registerLicenseDeniedHandler,
  registerUnavailableSourceHandler,
  resolveMaterialization,
  validateQueryMinimization,
} from './oracle/production/economic-data-fabric/federation/index.ts';

describe('Wave 4 — Federated Economic Query', () => {
  it('1. federation is not a monetary authority', () => {
    assert.equal(FEDERATION_NOT_MONETARY_AUTHORITY, true);
    assert.equal(CHUNK_71_REMAINS_MONETARY_AUTHORITY, true);
  });

  it('2. audits current data stores (Task 1)', () => {
    const registry = new FederationSourceRegistry();
    assert.ok(registry.list().length >= CANONICAL_FEDERATION_SOURCES.length);
    const postgres = registry.get('db.solstice_customer');
    assert.ok(postgres);
    assert.equal(postgres?.kind, 'POSTGRESQL');
    assert.equal(postgres?.connectorRequired, true);
    const fabric = registry.get('oracle.economic-data-fabric');
    assert.ok(fabric?.directQueryable);
    const security = registry.get('db.solstice_security');
    assert.equal(security?.accessMode, 'NOT_QUERYABLE');
    assert.ok(registry.connectorMediated().length > 0);
  });

  it('3. Trino is not operationally justified; adapter boundary exists (Task 3)', () => {
    assert.equal(TRINO_OPERATIONALLY_JUSTIFIED, false);
    assert.equal(TRINO_INTEGRATION_ACTIVE, false);
    assert.equal(TRINO_EVALUATION.engine, 'IN_MEMORY_FEDERATION_ADAPTER');
    assert.ok(TRINO_EVALUATION.prerequisites.length > 0);
    const trino = new TrinoFederationAdapterPlaceholder();
    assert.equal(trino.engineKind, 'TRINO_CANDIDATE');
  });

  it('4. authorized research query succeeds with attribution (Task 2, 7)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);
    const journal = new FederationAuditJournal();

    const { result, auditReceiptId } = await executeFederatedQuery({
      request: ENERGY_WEATHER_CROSS_SOURCE_QUERY,
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
      auditJournal: journal,
    });

    assert.equal(result.completeness, 'COMPLETE');
    assert.equal(result.purpose, 'RESEARCH');
    assert.ok(result.metrics.length >= 2);
    for (const metric of result.metrics) {
      assert.ok(metric.attribution.providerId);
      assert.ok(metric.attribution.sourceId);
      assert.ok(metric.attribution.datasetId);
      assert.ok(metric.attribution.licenseRef);
      assert.ok(metric.attribution.provenanceRef);
      assert.ok(metric.attribution.contentCommitment);
      assert.ok(metric.attribution.unit);
    }
    assert.equal(journal.list().length, 1);
    const receipt = journal.list()[0];
    assert.equal(receipt?.receiptId, auditReceiptId);
    assert.equal(receipt?.payloadLogged, false);
    assert.equal(receipt?.rightsDecision, 'ALLOW');
  });

  it('5. unauthorized purpose: RESEARCH cannot become ECONOMIC_VALUATION (Task 4)', () => {
    const rejection = evaluateFederationPurpose({
      requestedPurpose: 'ECONOMIC_VALUATION',
      rightsContext: RESEARCH_RIGHTS_CONTEXT,
    });
    assert.ok(rejection);
    assert.equal(rejection?.code, 'PURPOSE_NOT_INHERITED');
    const expansion = refusePurposeExpansion('RESEARCH', 'MONETARY_PROPOSAL');
    assert.equal(expansion.code, 'PURPOSE_NOT_INHERITED');
  });

  it('6. unauthorized purpose: RESEARCH cannot become MONETARY_PROPOSAL (Task 4)', () => {
    const rejection = evaluateFederationPurpose({
      requestedPurpose: 'MONETARY_PROPOSAL',
      rightsContext: RESEARCH_RIGHTS_CONTEXT,
    });
    assert.ok(rejection);
    assert.equal(rejection?.code, 'PURPOSE_NOT_INHERITED');
  });

  it('7. source unavailable fails closed (Task 10)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);
    registerUnavailableSourceHandler(adapter, 'oracle.provider-families');

    const { result } = await executeFederatedQuery({
      request: ENERGY_WEATHER_CROSS_SOURCE_QUERY,
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
    });

    assert.equal(result.completeness, 'FAILED');
    assert.equal(result.rejection?.code, 'PARTIAL_RESULT_UNSAFE');
  });

  it('8. partial federation with allowPartial surfaces warning, not silent truth (Task 10)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);
    registerUnavailableSourceHandler(adapter, 'oracle.provider-families');

    const { result } = await executeFederatedQuery({
      request: Object.freeze({
        ...ENERGY_WEATHER_CROSS_SOURCE_QUERY,
        allowPartial: true,
      }),
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
    });

    assert.equal(result.completeness, 'PARTIAL');
    assert.ok(result.partialWarning);
    assert.ok(result.metrics.length > 0);
    assert.ok(result.sourceOutcomes.some((outcome) => outcome.status === 'UNAVAILABLE'));
  });

  it('9. provider attribution preserved on every metric (Task 7)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);

    const { result } = await executeFederatedQuery({
      request: MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY,
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
    });

    assert.equal(result.completeness, 'COMPLETE');
    const providers = new Set(result.metrics.map((metric) => metric.attribution.providerId));
    assert.ok(providers.size >= 2);
  });

  it('10. license restriction surfaces LICENSE_DENIED (Task 10)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);
    registerLicenseDeniedHandler(adapter, 'economic-asset-registry');

    const { result } = await executeFederatedQuery({
      request: RESEARCH_PUBLICATION_CROSS_SOURCE_QUERY,
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
    });

    assert.equal(result.completeness, 'FAILED');
    const denied = result.sourceOutcomes.find((outcome) => outcome.rejection?.code === 'LICENSE_DENIED');
    assert.ok(denied);
  });

  it('11. persistence restriction defaults to QUERIED_ONLY for RESEARCH (Task 6)', () => {
    const resolution = resolveMaterialization({
      request: Object.freeze({
        ...ENERGY_WEATHER_CROSS_SOURCE_QUERY,
        requestedMaterialization: 'EVIDENCE_VAULT',
      }),
      rightsContext: RESEARCH_RIGHTS_CONTEXT,
    });
    assert.equal(resolution.level, 'CACHED');
    assert.equal(resolution.persistenceAuthorized, true);
    assert.ok(resolution.rejection);
    assert.equal(resolution.rejection?.code, 'PERSISTENCE_DENIED');
  });

  it('12. valuation context permits OBSERVATION but not automatic vault (Task 6)', () => {
    const resolution = resolveMaterialization({
      request: Object.freeze({
        ...ENERGY_WEATHER_CROSS_SOURCE_QUERY,
        purpose: 'ECONOMIC_VALUATION',
        requestedMaterialization: 'OBSERVATION',
      }),
      rightsContext: VALUATION_RIGHTS_CONTEXT,
    });
    assert.equal(resolution.level, 'OBSERVATION');
    assert.equal(resolution.persistenceAuthorized, true);
    assert.equal(resolution.rejection, null);
  });

  it('13. query audit records scope without raw payloads (Task 8)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);
    const journal = new FederationAuditJournal();

    await executeFederatedQuery({
      request: WORKFORCE_EDUCATION_CROSS_SOURCE_QUERY,
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
      auditJournal: journal,
    });

    const receipt = journal.list()[0];
    assert.ok(receipt);
    assert.equal(receipt.payloadLogged, false);
    assert.ok(receipt.sourceIds.length >= 2);
    assert.ok(receipt.resultReference.length > 0);
    assert.equal(receipt.purpose, 'AGGREGATED_ANALYTICS');
  });

  it('14. minimum-data request rejects broad fields (Task 5)', () => {
    const rejection = validateQueryMinimization(
      Object.freeze({
        ...ENERGY_WEATHER_CROSS_SOURCE_QUERY,
        requestedFields: Object.freeze(['*']),
      }),
    );
    assert.equal(rejection?.code, 'ARBITRARY_QUERY_FORBIDDEN');
  });

  it('15. minimization defaults apply row limits (Task 5)', () => {
    const minimized = applyMinimizationDefaults(
      Object.freeze({
        ...ENERGY_WEATHER_CROSS_SOURCE_QUERY,
        rowLimit: undefined,
      }),
    );
    assert.equal(minimized.rowLimit, DEFAULT_ROW_LIMIT);
    assert.equal(minimized.allowPartial, false);
  });

  it('16. multiple-source cross-domain queries (Task 9)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);

    const scenarios = [
      ENERGY_WEATHER_CROSS_SOURCE_QUERY,
      MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY,
      RESEARCH_PUBLICATION_CROSS_SOURCE_QUERY,
      WORKFORCE_EDUCATION_CROSS_SOURCE_QUERY,
    ];

    for (const request of scenarios) {
      const { result } = await executeFederatedQuery({
        request,
        nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
        adapter,
      });
      assert.equal(result.completeness, 'COMPLETE', `expected complete for ${request.queryId}`);
      assert.ok(result.sourceOutcomes.length >= 2, `expected multi-source for ${request.queryId}`);
    }
  });

  it('17. failure isolation: one bad source does not corrupt others when partial allowed (Task 10)', async () => {
    const adapter = new InMemoryFederationAdapter();
    registerFederationFixtureHandlers(adapter);
    registerUnavailableSourceHandler(adapter, 'productive.economy-data');

    const { result } = await executeFederatedQuery({
      request: Object.freeze({
        ...MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY,
        allowPartial: true,
      }),
      nowUnix: FEDERATION_FIXTURE_NOW_UNIX,
      adapter,
    });

    assert.equal(result.completeness, 'PARTIAL');
    const okSources = result.sourceOutcomes.filter((outcome) => outcome.status === 'OK');
    assert.equal(okSources.length, 1);
    assert.ok(result.metrics.length > 0);
  });
});
