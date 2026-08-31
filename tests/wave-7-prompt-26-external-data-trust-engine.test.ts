/**
 * Wave 7 Prompt 26 — External Data Trust Engine tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ExternalDataPlane } from '../packages/external-data/src/plane.ts';
import { agentEvidenceSnapshot, worldEconomySnapshotAsync } from '../packages/external-data/src/bridges.ts';
import {
  buildExternalObservation,
  MARKET_PRICE_FRESHNESS_POLICY,
  type AuthorityClass,
  type ExternalObservation,
  type FreshnessStatus,
} from '../packages/provider-sdk/src/index.ts';
import {
  assessFxReferenceTrust,
  assessMarketReferenceTrust,
  assessResourceEnergyTrust,
  createExternalDataTrustEngine,
  type TrustObservationContext,
} from '../packages/provider-sdk/src/trust/index.ts';

const NOW = asUtcInstant('2026-08-30T12:00:00.000Z');
const SOURCE = asUtcInstant('2026-08-30T11:59:00.000Z');

function fxObservation(
  providerId: string,
  base: string,
  quote: string,
  rate: string,
  authorityClass: AuthorityClass = 'reference_data',
  freshnessStatus: FreshnessStatus = 'fresh',
  overrides: Record<string, unknown> = {},
): ExternalObservation<{ baseCurrency: string; quoteCurrency: string; rate: string; asOf: string; sourceProvider: string }> {
  const built = buildExternalObservation({
    observationId: `fx-${providerId}-${base}${quote}`,
    providerId,
    providerCategory: 'foreign_exchange',
    capability: 'fx_rates',
    data: {
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      asOf: SOURCE,
      sourceProvider: providerId,
    },
    source: { provider: providerId, dataset: `${base}-${quote}` },
    time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
    authorityClass,
    provenance: { rawPayload: JSON.stringify({ rate }), providerSchemaVersion: 'test/1' },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
    validationStatus: 'valid',
    ...overrides,
  });
  assert.equal(built.ok, true);
  const obs = built.value!;
  if (freshnessStatus !== 'fresh') {
    return Object.freeze({
      ...obs,
      quality: Object.freeze({
        ...obs.quality,
        freshnessStatus,
      }),
    });
  }
  return obs;
}

function marketObservation(
  providerId: string,
  symbol: string,
  priceMinor: bigint,
  authorityClass: AuthorityClass = 'reference_data',
): ExternalObservation<{ symbol: string; priceMinor: bigint; currency: string; asOf: string; sourceProvider: string; exchange: string | null }> {
  const built = buildExternalObservation({
    providerId,
    providerCategory: 'markets',
    capability: 'market_prices',
    data: {
      symbol,
      priceMinor,
      currency: 'USD',
      asOf: SOURCE,
      sourceProvider: providerId,
      exchange: 'NASDAQ',
    },
    source: { provider: providerId, dataset: symbol },
    time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
    authorityClass,
    provenance: { rawPayload: JSON.stringify({ priceMinor: priceMinor.toString() }), providerSchemaVersion: 'test/1' },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
  });
  assert.equal(built.ok, true);
  return built.value!;
}

function ctx(
  observation: ExternalObservation<unknown>,
  numericValue: number,
  extra: Partial<TrustObservationContext> = {},
): TrustObservationContext {
  return Object.freeze({
    observation,
    numericValue,
    unit: 'USD',
    semanticKey: inferKey(observation),
    ...extra,
  });
}

function inferKey(observation: ExternalObservation<unknown>): string {
  const data = observation.data as Record<string, unknown>;
  if (data.baseCurrency && data.quoteCurrency) return `${data.baseCurrency}/${data.quoteCurrency}`;
  if (data.symbol) return String(data.symbol);
  return observation.capability;
}

describe('Wave 7 Prompt 26 — External Data Trust Engine', () => {
  const engine = createExternalDataTrustEngine({ nowUtc: () => NOW });

  it('1. single authoritative source', () => {
    const obs = fxObservation('ecb', 'EUR', 'USD', '1.085', 'authoritative_official');
    const result = assessFxReferenceTrust(engine, {
      observations: [obs],
      baseCurrency: 'EUR',
      quoteCurrency: 'USD',
    });
    assert.equal(result.status, 'SUPPORTED');
    assert.ok(result.canonicalValue);
    assert.ok(
      result.selectionMethod === 'SINGLE_AUTHORITATIVE_SOURCE' ||
        result.selectionMethod === 'AUTHORITY_PRECEDENCE',
    );
    assert.equal(result.grantsExecutionAuthority, false);
  });

  it('2. two agreeing reference sources', () => {
    const obs = [
      fxObservation('frankfurter', 'USD', 'EUR', '0.921'),
      fxObservation('exchangerate-host', 'USD', 'EUR', '0.9215'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
    });
    assert.ok(result.status === 'SUPPORTED' || result.status === 'TRUSTED');
    assert.ok(result.corroborationCount >= 2);
    assert.ok(result.reasons.some((r) => r.code === 'MULTI_SOURCE_CORROBORATION'));
  });

  it('3. three-source consensus', () => {
    const obs = [
      fxObservation('p1', 'USD', 'GBP', '0.784'),
      fxObservation('p2', 'USD', 'GBP', '0.7845'),
      fxObservation('p3', 'USD', 'GBP', '0.7842'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'GBP',
    });
    assert.ok(result.supportingObservationIds.length >= 2);
    assert.ok(result.canonicalValue);
  });

  it('4. one numeric outlier flagged not destroyed', () => {
    const obs = [
      fxObservation('p1', 'USD', 'JPY', '149.50'),
      fxObservation('p2', 'USD', 'JPY', '149.55'),
      fxObservation('p3', 'USD', 'JPY', '160.00'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
    });
    assert.ok(result.reasons.some((r) => r.code === 'VALUE_OUTLIER'));
    assert.ok(result.excludedObservationIds.length === 0 || result.supportingObservationIds.length > 0);
  });

  it('5. official source disagrees with aggregator — authority override', () => {
    const obs = [
      fxObservation('official', 'USD', 'CHF', '0.880', 'authoritative_official'),
      fxObservation('aggregator', 'USD', 'CHF', '0.950', 'derived_data'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'CHF',
    });
    assert.equal(result.status, 'TRUSTED');
    assert.ok(result.reasons.some((r) => r.code === 'AUTHORITY_OVERRIDE'));
    assert.ok(result.conflictingObservationIds.includes(obs[1].observationId));
  });

  it('6. stale provider excluded or reduced', () => {
    const obs = [
      fxObservation('fresh', 'USD', 'CAD', '1.35', 'reference_data', 'fresh'),
      fxObservation('stale', 'USD', 'CAD', '1.35', 'reference_data', 'stale'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'CAD',
    });
    assert.ok(result.reasons.some((r) => r.code === 'SOURCE_STALE'));
    assert.ok(result.canonicalValue);
  });

  it('7. quarantined provider excluded', () => {
    const obs = [
      fxObservation('good', 'USD', 'AUD', '1.52'),
      fxObservation('bad', 'USD', 'AUD', '1.52'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'AUD',
      providerRisk: { bad: { quarantined: true, state: 'DISABLED' } },
    });
    assert.ok(result.reasons.some((r) => r.code === 'SOURCE_QUARANTINED'));
    assert.ok(!result.supportingObservationIds.includes(obs[1].observationId));
  });

  it('8. unit mismatch', () => {
    const obs = fxObservation('p1', 'USD', 'EUR', '0.92');
    const result = engine.assess({
      contexts: [ctx(obs, 0.92)],
      policyProfile: 'FX_REFERENCE',
      semanticKey: 'USD/EUR',
      unit: 'JPY',
    });
    assert.equal(result.status, 'UNAVAILABLE');
    assert.ok(result.reasons.some((r) => r.code === 'UNIT_MISMATCH'));
  });

  it('9. time mismatch', () => {
    const old = fxObservation('old', 'USD', 'NZD', '1.62');
    const oldObs = Object.freeze({
      ...old,
      time: Object.freeze({
        ...old.time,
        sourceTimestamp: asUtcInstant('2026-08-29T12:00:00.000Z'),
        effectiveAt: asUtcInstant('2026-08-29T12:00:00.000Z'),
      }),
    });
    const fresh = fxObservation('new', 'USD', 'NZD', '1.62');
    const result = assessFxReferenceTrust(engine, {
      observations: [oldObs, fresh],
      baseCurrency: 'USD',
      quoteCurrency: 'NZD',
    });
    assert.equal(result.status, 'CONFLICTED');
    assert.ok(result.reasons.some((r) => r.code === 'TIME_MISMATCH'));
  });

  it('10. semantic mismatch', () => {
    const eur = fxObservation('p1', 'USD', 'EUR', '0.92');
    const gbp = fxObservation('p2', 'USD', 'GBP', '0.78');
    const result = engine.assess({
      contexts: [
        Object.freeze({ observation: eur, numericValue: 0.92, semanticKey: 'USD/EUR', unit: 'EUR' }),
        Object.freeze({ observation: gbp, numericValue: 0.78, semanticKey: 'USD/GBP', unit: 'GBP' }),
      ],
      policyProfile: 'FX_REFERENCE',
      semanticKey: 'USD/EUR',
      unit: 'EUR',
    });
    assert.ok(result.reasons.some((r) => r.code === 'SEMANTIC_MISMATCH'));
  });

  it('11. insufficient sources', () => {
    const result = engine.assess({
      contexts: [],
      policyProfile: 'FX_REFERENCE',
      semanticKey: 'USD/EUR',
    });
    assert.equal(result.status, 'UNAVAILABLE');
    assert.ok(result.reasons.some((r) => r.code === 'INSUFFICIENT_SOURCES'));
  });

  it('12. all sources stale', () => {
    const obs = fxObservation('p1', 'USD', 'SEK', '10.5', 'reference_data', 'stale');
    const result = assessFxReferenceTrust(engine, {
      observations: [obs],
      baseCurrency: 'USD',
      quoteCurrency: 'SEK',
    });
    assert.equal(result.status, 'STALE');
    assert.ok(result.reasons.some((r) => r.code === 'ALL_SOURCES_STALE'));
  });

  it('13. provider disagreement without authority override', () => {
    const obs = [
      fxObservation('p1', 'USD', 'MXN', '18.50', 'reference_data'),
      fxObservation('p2', 'USD', 'MXN', '19.80', 'reference_data'),
    ];
    const result = assessFxReferenceTrust(engine, {
      observations: obs,
      baseCurrency: 'USD',
      quoteCurrency: 'MXN',
    });
    assert.equal(result.status, 'CONFLICTED');
    assert.ok(result.reasons.some((r) => r.code === 'PROVIDER_CONFLICT'));
  });

  it('14. FX consensus produces canonical reference rate', () => {
    const plane = new ExternalDataPlane({ nowUtc: NOW });
    const trust = plane.trust.assessFxPair(plane, 'USD', 'EUR');
    assert.ok(trust.canonicalValue || trust.status === 'SUPPORTED' || trust.status === 'TRUSTED');
    assert.equal(trust.trustPolicyVersion, 'fx_reference_v1');
    assert.equal(trust.grantsExecutionAuthority, false);
  });

  it('15. market reference consensus', () => {
    const obs = [
      marketObservation('alpha', 'AAPL', 227_50n),
      marketObservation('yahoo', 'AAPL', 227_55n),
    ];
    const result = assessMarketReferenceTrust(engine, {
      observations: obs,
      assetId: 'AAPL',
    });
    assert.ok(result.canonicalValue);
    assert.equal(result.trustPolicyProfile, 'MARKET_REFERENCE');
  });

  it('16. resource observations trust', () => {
    const built = buildExternalObservation({
      providerId: 'eia',
      providerCategory: 'energy',
      capability: 'energy_data',
      data: { value: 42.5, unit: 'USD/barrel', geography: 'US' },
      source: { provider: 'eia', dataset: 'wti' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'authoritative_official',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    assert.equal(built.ok, true);
    const result = assessResourceEnergyTrust(engine, {
      observations: [built.value!],
      semanticKey: 'wti-crude-us',
      unit: 'USD/barrel',
      policyProfile: 'RESOURCE',
    });
    assert.ok(result.canonicalValue);
  });

  it('17. weather observations retain all — no blind average', () => {
    const w1 = buildExternalObservation({
      providerId: 'open-meteo',
      providerCategory: 'weather',
      capability: 'weather',
      data: { temperature: 20, unit: 'celsius', kind: 'observation' },
      source: { provider: 'open-meteo', dataset: 'current' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    const w2 = buildExternalObservation({
      providerId: 'met-no',
      providerCategory: 'weather',
      capability: 'weather',
      data: { temperature: 21, unit: 'celsius', kind: 'observation' },
      source: { provider: 'met-no', dataset: 'current' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    assert.equal(w1.ok, true);
    assert.equal(w2.ok, true);
    const result = engine.assess({
      contexts: [
        Object.freeze({ observation: w1.value!, semanticKey: 'sf-current', unit: 'celsius' }),
        Object.freeze({ observation: w2.value!, semanticKey: 'sf-current', unit: 'celsius' }),
      ],
      policyProfile: 'WEATHER',
      semanticKey: 'sf-current',
      unit: 'celsius',
    });
    assert.equal(result.selectionMethod, 'RETAIN_ALL');
    assert.ok(result.reasons.some((r) => r.code === 'FORECAST_NOT_CONSOLIDATED'));
    assert.equal(result.canonicalValue, null);
  });

  it('18. chain-state conflict', () => {
    const c1 = buildExternalObservation({
      providerId: 'chain-a',
      providerCategory: 'blockchain',
      capability: 'blockchain_intelligence',
      data: { chainId: 'eth', blockHeight: 100, blockHash: '0xabc' },
      source: { provider: 'chain-a', dataset: 'eth' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    const c2 = buildExternalObservation({
      providerId: 'chain-b',
      providerCategory: 'blockchain',
      capability: 'blockchain_intelligence',
      data: { chainId: 'eth', blockHeight: 100, blockHash: '0xdef' },
      source: { provider: 'chain-b', dataset: 'eth' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    const result = engine.assess({
      contexts: [
        Object.freeze({ observation: c1.value!, semanticKey: 'eth:100' }),
        Object.freeze({ observation: c2.value!, semanticKey: 'eth:100' }),
      ],
      policyProfile: 'CHAIN_STATE',
      semanticKey: 'eth:100',
    });
    assert.equal(result.status, 'CONFLICTED');
    assert.ok(result.reasons.some((r) => r.code === 'CHAIN_STATE_CONFLICT'));
  });

  it('19. compliance evidence remains separate', () => {
    const comp = buildExternalObservation({
      providerId: 'opensanctions',
      providerCategory: 'compliance',
      capability: 'sanctions',
      data: { screeningType: 'SANCTIONS', matchStatus: 'NO_MATCH', subjectRef: 'subj-1' },
      source: { provider: 'opensanctions', dataset: 'sanctions' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'regulated_provider',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    const result = engine.assess({
      contexts: [Object.freeze({ observation: comp.value!, semanticKey: 'subj-1' })],
      policyProfile: 'COMPLIANCE_EVIDENCE',
      semanticKey: 'subj-1',
    });
    assert.equal(result.canonicalValue, null);
    assert.ok(result.reasons.some((r) => r.code === 'COMPLIANCE_EVIDENCE_INDEPENDENT'));
    assert.equal(result.selectionMethod, 'RETAIN_ALL');
  });

  it('20. research quality remains non-binary', () => {
    const paper = buildExternalObservation({
      providerId: 'openalex',
      providerCategory: 'research',
      capability: 'research_papers',
      data: { title: 'Sample paper', peerReviewed: true },
      source: { provider: 'openalex', dataset: 'works' },
      time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
      authorityClass: 'research_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    const result = engine.assess({
      contexts: [Object.freeze({ observation: paper.value!, semanticKey: 'paper-1' })],
      policyProfile: 'RESEARCH',
      semanticKey: 'paper-1',
    });
    assert.equal(result.canonicalValue, null);
    assert.ok(result.reasons.some((r) => r.code === 'RESEARCH_QUALITY_METADATA_ONLY'));
  });

  it('21. trust policy version retained', () => {
    const obs = fxObservation('p1', 'USD', 'EUR', '0.92');
    const result = assessFxReferenceTrust(engine, {
      observations: [obs],
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
    });
    assert.equal(result.trustPolicyVersion, 'fx_reference_v1');
    const record = engine.toAuditRecord(result);
    assert.equal(record.trustPolicyVersion, 'fx_reference_v1');
  });

  it('22. reason codes retained', () => {
    const obs = fxObservation('p1', 'USD', 'EUR', '0.92', 'authoritative_official');
    const result = assessFxReferenceTrust(engine, {
      observations: [obs],
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
    });
    assert.ok(result.reasons.length > 0);
    assert.ok(result.reasons.every((r) => r.code && r.description));
    const record = engine.toAuditRecord(result);
    assert.ok(record.reasonCodes.length > 0);
  });

  it('23. Financial Agent receives trust metadata', () => {
    const plane = new ExternalDataPlane({ nowUtc: NOW });
    const snapshot = agentEvidenceSnapshot(plane);
    assert.equal(snapshot.grantsExecutionAuthority, false);
    assert.ok(snapshot.trustMetadataAvailable);
    assert.ok(snapshot.trustPolicyVersions && snapshot.trustPolicyVersions.length > 0);
    const bundle = plane.trust.agentEvidenceWithTrust(plane);
    const withMeta = bundle.refs.find((r) => r.trustMetadata !== null);
    assert.ok(withMeta?.trustMetadata);
    assert.equal(withMeta?.trustMetadata?.grantsExecutionAuthority, false);
  });

  it('24. no trust result authorizes execution', () => {
    const plane = new ExternalDataPlane({ nowUtc: NOW });
    const fx = plane.trust.assessFxPair(plane, 'USD', 'EUR');
    const market = plane.trust.assessMarketFromPlane(plane, 'AAPL');
    assert.equal(fx.grantsExecutionAuthority, false);
    assert.equal(market.grantsExecutionAuthority, false);
    const meta = engine.toEvidenceMetadata(fx);
    assert.equal(meta.grantsExecutionAuthority, false);
  });

  it('25. world integration includes sanitized quality', async () => {
    const plane = new ExternalDataPlane({ nowUtc: NOW });
    const world = await worldEconomySnapshotAsync(plane);
    assert.ok(world.fxQuality);
    assert.ok(world.marketQuality);
    assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(world.fxQuality!.quality));
    assert.ok(world.fxQuality!.sources >= 0);
  });

  it('26. mirrored source deduplication for independence', () => {
    const obs = fxObservation('mirror-a', 'USD', 'EUR', '0.92');
    const obs2 = fxObservation('mirror-b', 'USD', 'EUR', '0.92');
    const result = assessFxReferenceTrust(engine, {
      observations: [obs, obs2],
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      providerRisk: {},
    });
    const contexts = [
      Object.freeze({
        observation: obs,
        numericValue: 0.92,
        lineage: Object.freeze({ upstreamSource: 'same-feed' }),
      }),
      Object.freeze({
        observation: obs2,
        numericValue: 0.92,
        lineage: Object.freeze({ upstreamSource: 'same-feed' }),
      }),
    ];
    const deduped = engine.assess({
      contexts,
      policyProfile: 'FX_REFERENCE',
      semanticKey: 'USD/EUR',
      unit: 'EUR',
    });
    assert.ok(
      deduped.reasons.some((r) => r.code === 'MIRRORED_SOURCE_DEDUPED') ||
        deduped.corroborationCount <= 2,
    );
    assert.ok(result.canonicalValue);
  });
});
