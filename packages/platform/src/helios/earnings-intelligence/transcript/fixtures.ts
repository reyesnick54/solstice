import type { UtcInstant } from '@solstice/domain';

import { parseStructuredSegments } from './segmentation.ts';
import type {
  ExternalFactRecord,
  PointInTimeEarningsTranscript,
  TranscriptSegmentInput,
} from './types.ts';

const AS_OF = '2026-05-15T21:00:00.000Z' as UtcInstant;

export const EARN05_FIXTURE_SEGMENTS: readonly TranscriptSegmentInput[] = Object.freeze([
  Object.freeze({
    segmentId: 'prep_1',
    kind: 'PREPARED_REMARKS',
    speakerLabel: 'Jane Doe, CEO',
    sequence: 1,
    text:
      'We delivered record revenue growth of 12% year over year with strong demand across enterprise. ' +
      'Operating margin expanded 80 bps. We expect continued momentum next quarter and plan to increase capex for AI infrastructure.',
  }),
  Object.freeze({
    segmentId: 'prep_2',
    kind: 'PREPARED_REMARKS',
    speakerLabel: 'John Smith, CFO',
    sequence: 2,
    text:
      'We returned $400 million to shareholders via buybacks and remain focused on cost efficiency. ' +
      'Guidance for EPS is $1.45 to $1.55.',
  }),
  Object.freeze({
    segmentId: 'op_1',
    kind: 'OPERATOR',
    speakerLabel: 'Operator',
    sequence: 3,
    text: 'We will now begin the question-and-answer session.',
  }),
  Object.freeze({
    segmentId: 'q_1',
    kind: 'ANALYST_QUESTION',
    speakerLabel: 'Alex Analyst, Morgan Stanley',
    sequence: 4,
    text: 'Can you quantify pricing impact on gross margin this quarter and provide demand trends by region?',
  }),
  Object.freeze({
    segmentId: 'a_1',
    kind: 'MANAGEMENT_ANSWER',
    speakerLabel: 'John Smith, CFO',
    sequence: 5,
    text:
      'Pricing contributed roughly 150 bps to gross margin. Demand remained robust in North America, up 9%, ' +
      'while EMEA was softer at 2% growth.',
  }),
  Object.freeze({
    segmentId: 'q_2',
    kind: 'ANALYST_QUESTION',
    speakerLabel: 'Sam Research, Goldman Sachs',
    sequence: 6,
    text: 'What is your updated full-year capex outlook?',
  }),
  Object.freeze({
    segmentId: 'a_2',
    kind: 'MANAGEMENT_ANSWER',
    speakerLabel: 'Jane Doe, CEO',
    sequence: 7,
    text: 'We are not prepared to disclose an updated full-year capex number on this call.',
  }),
]);

export function earn05FixtureTranscript(): PointInTimeEarningsTranscript {
  return Object.freeze({
    transcriptId: 'earn05.fixture.q1fy2026',
    companyTicker: 'ACME',
    companyName: 'Acme Example Corp.',
    fiscalPeriodLabel: 'Q1 FY2026',
    callInstant: AS_OF,
    knowableAt: AS_OF,
    provenanceRef: 'fixture:earn05:q1fy2026',
    segments: EARN05_FIXTURE_SEGMENTS,
  });
}

export function earn05PriorQuarterSegments() {
  return parseStructuredSegments(
    Object.freeze([
      Object.freeze({
        segmentId: 'prior_prep_1',
        kind: 'PREPARED_REMARKS',
        speakerLabel: 'Jane Doe, CEO',
        sequence: 1,
        text: 'Revenue grew 8% year over year with stable demand and modest pricing actions.',
      }),
    ]),
  );
}

export function earn05ExternalFacts(): readonly ExternalFactRecord[] {
  return Object.freeze([
    Object.freeze({
      recordId: 'release_eps_mid',
      sourceKind: 'EARNINGS_RELEASE',
      metricHint: 'eps',
      valueText: '1.50',
      normalizedValue: 1.5,
      unitHint: null,
      asOf: AS_OF,
    }),
    Object.freeze({
      recordId: 'guidance_eps_low',
      sourceKind: 'CURRENT_GUIDANCE',
      metricHint: 'eps',
      valueText: '1.45',
      normalizedValue: 1.45,
      unitHint: null,
      asOf: AS_OF,
    }),
  ]);
}
