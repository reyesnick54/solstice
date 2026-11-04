import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyLeakageControls } from './leakage-control.ts';
import { parseRawTranscriptText } from './segmentation.ts';
import {
  HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED,
  evaluateEarn05Qualification,
  runEarn05SelfChecks,
} from './qualification.ts';
import { earn05FixtureTranscript } from './fixtures.ts';
import { analyzeEarningsTranscript } from './service.ts';

describe('HELIOS EARN05 transcript intelligence', () => {
  it('separates prepared remarks, Q&A, and operator segments', () => {
    const raw = `
Prepared Remarks
Jane Doe, CEO: We expect growth next quarter.
John Smith, CFO: Margin expanded 50 bps.
Q&A Session
Alex Analyst, Morgan Stanley: Can you quantify demand?
John Smith, CFO: Demand was up 7% in the US.
Operator: Thank you for joining.
`;
    const segments = parseRawTranscriptText(raw);
    const kinds = new Set(segments.map((segment) => segment.kind));
    assert.ok(kinds.has('PREPARED_REMARKS'));
    assert.ok(kinds.has('ANALYST_QUESTION'));
    assert.ok(kinds.has('MANAGEMENT_ANSWER'));
    assert.ok(kinds.has('OPERATOR'));
  });

  it('runs deterministic semantic analysis on fixture transcript', () => {
    const transcript = earn05FixtureTranscript();
    const analysis = analyzeEarningsTranscript({
      transcript,
      comparables: null,
      externalFacts: [],
      mode: Object.freeze({
        leakageMode: 'NON_CAUSAL_RESEARCH_ONLY',
        allowLlmEnrichment: false,
        redactCompanyIdentifiers: true,
      }),
      analyzedAt: transcript.callInstant,
    });
    assert.equal(analysis.baselineOnly, true);
    assert.ok(analysis.features.specificityScore > 0);
    assert.ok(analysis.answerQuality.perQuestion.length >= 2);
    assert.ok(analysis.inputEvidenceHash.length > 0);
    assert.ok(analysis.outputHash.length > 0);
  });

  it('redacts identifiers under anonymized evidence mode', () => {
    const transcript = earn05FixtureTranscript();
    const redacted = applyLeakageControls(transcript, {
      leakageMode: 'ANONYMIZED_EVIDENCE_MODEL',
      allowLlmEnrichment: false,
      redactCompanyIdentifiers: true,
    });
    assert.equal(redacted.transcript.companyTicker, null);
    assert.equal(redacted.transcript.companyName, null);
    assert.match(redacted.transcript.segments[0]!.text, /\[TICKER\]|\[COMPANY\]|record/i);
  });

  it('qualifies EARN05 transcript intelligence engine', () => {
    const checks = runEarn05SelfChecks();
    const result = evaluateEarn05Qualification(checks);
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED);
  });
});
