import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  filterKnowableObservations,
  ingestSecFundamentalSubmissions,
  mapSecObservationsToHeliosFacts,
  mapSecObservationsToAafFilingSources,
  SIMCORP_ENTITY_ID,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_SUBMISSION_TIMELINE,
} from './index.ts';

describe('SEC fundamentals external-data plane', () => {
  it('materializes canonical observation kinds from EDGAR submissions', () => {
    const result = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    assert.ok(result.observationCount > 0);
    const kinds = new Set(result.observations.map((o) => o.observationKind));
    assert.ok(kinds.has('company_filing'));
    assert.ok(kinds.has('financial_fact'));
    assert.ok(kinds.has('financial_statement'));
    assert.ok(kinds.has('guidance'));
    assert.ok(kinds.has('corporate_action'));
  });

  it('retains filing provenance fields on every observation', () => {
    const result = ingestSecFundamentalSubmissions([SIMCORP_Q2_2024_10Q]);
    for (const obs of result.observations) {
      assert.equal(obs.filingId, SIMCORP_Q2_2024_10Q.filingId);
      assert.ok(obs.accessionNumber);
      assert.ok(obs.form);
      assert.ok(obs.filingDate);
      assert.ok(obs.knowableAt);
      assert.equal(obs.canonicalEntityId, SIMCORP_ENTITY_ID);
      assert.ok(obs.evidenceRef.startsWith('sec-edgar:'));
    }
  });

  it('filters observations by knowableAt for point-in-time evaluation', () => {
    const result = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const atAug = filterKnowableObservations(result.observations, asUtcInstant('2024-08-15T12:00:00.000Z'));
    const filingIds = new Set(atAug.map((o) => o.filingId));
    assert.ok(filingIds.has(SIMCORP_Q2_2024_10Q.filingId));
    assert.equal(filingIds.has('simcorp-fy2024q3-10q'), false);
  });

  it('maps financial facts for HELIOS feature fabric ingestion', () => {
    const result = ingestSecFundamentalSubmissions([SIMCORP_Q2_2024_10Q]);
    const facts = mapSecObservationsToHeliosFacts(result.observations);
    assert.ok(facts.length > 0);
    assert.ok(facts.every((f) => f.knowableAt && f.concept.startsWith('us-gaap:')));
  });

  it('maps company filings for AAF revision ledger sources', () => {
    const result = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const sources = mapSecObservationsToAafFilingSources(result.observations);
    assert.ok(sources.length >= SIMCORP_SUBMISSION_TIMELINE.length);
    assert.ok(sources.every((s) => s.rootFilingId && s.evidenceRef));
  });
});
