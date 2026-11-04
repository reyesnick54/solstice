import { shortEvidenceId } from './evidence-hash.ts';
import type {
  ContradictionAssessment,
  ContradictionClassification,
  ExternalFactRecord,
  ExtractedNumericClaim,
  ParsedTranscriptSegment,
} from './types.ts';

const NUMERIC_CLAIM =
  /\b(?<metric>revenue|sales|eps|earnings|margin|guidance|growth|capex|backlog|orders)?[^.\n]{0,40}?\b(?<value>-?\d[\d,.]*)\s*(?<unit>%|bps|bp|million|billion|m|b)?\b/gi;

function parseNormalizedValue(valueText: string, unitHint: string | null): number | null {
  const cleaned = valueText.replace(/,/g, '');
  const base = Number.parseFloat(cleaned);
  if (!Number.isFinite(base)) {
    return null;
  }
  if (!unitHint) {
    return base;
  }
  const unit = unitHint.toLowerCase();
  if (unit === '%' || unit === 'bps' || unit === 'bp') {
    return base;
  }
  if (unit === 'million' || unit === 'm') {
    return base * 1_000_000;
  }
  if (unit === 'billion' || unit === 'b') {
    return base * 1_000_000_000;
  }
  return base;
}

export function extractNumericClaims(
  segments: readonly ParsedTranscriptSegment[],
): readonly ExtractedNumericClaim[] {
  const claims: ExtractedNumericClaim[] = [];
  for (const segment of segments) {
    for (const match of segment.text.matchAll(NUMERIC_CLAIM)) {
      const valueText = match.groups?.value ?? match[1];
      if (!valueText) {
        continue;
      }
      const metricHint = match.groups?.metric?.trim().toLowerCase() ?? null;
      const unitHint = match.groups?.unit?.trim().toLowerCase() ?? null;
      claims.push(
        Object.freeze({
          claimId: shortEvidenceId([segment.segmentId, valueText, metricHint ?? '', unitHint ?? '']),
          segmentId: segment.segmentId,
          metricHint,
          valueText,
          normalizedValue: parseNormalizedValue(valueText, unitHint),
          unitHint,
        }),
      );
    }
  }
  return Object.freeze(claims);
}

function comparableUnits(a: string | null, b: string | null): boolean {
  if (!a || !b) {
    return true;
  }
  const normalize = (unit: string): string => {
    if (unit === 'm') return 'million';
    if (unit === 'b') return 'billion';
    if (unit === 'bp') return 'bps';
    return unit;
  };
  return normalize(a) === normalize(b);
}

function classifyPair(input: {
  readonly claim: ExtractedNumericClaim;
  readonly external: ExternalFactRecord;
}): ContradictionAssessment {
  const evidenceRefs = Object.freeze([
    shortEvidenceId(['claim', input.claim.claimId]),
    shortEvidenceId(['external', input.external.recordId]),
  ]);

  if (input.claim.normalizedValue === null || input.external.normalizedValue === null) {
    return Object.freeze({
      claimId: input.claim.claimId,
      externalRecordId: input.external.recordId,
      classification: 'INSUFFICIENT_EVIDENCE',
      rationale: 'Numeric normalization unavailable for one or both records.',
      evidenceRefs,
    });
  }

  if (
    input.claim.metricHint &&
    input.external.metricHint &&
    input.claim.metricHint !== input.external.metricHint
  ) {
    return Object.freeze({
      claimId: input.claim.claimId,
      externalRecordId: input.external.recordId,
      classification: 'NOT_COMPARABLE',
      rationale: 'Metric hints differ; no automatic contradiction inferred.',
      evidenceRefs,
    });
  }

  if (!comparableUnits(input.claim.unitHint, input.external.unitHint)) {
    return Object.freeze({
      claimId: input.claim.claimId,
      externalRecordId: input.external.recordId,
      classification: 'NOT_COMPARABLE',
      rationale: 'Units are not directly comparable.',
      evidenceRefs,
    });
  }

  const claim = input.claim.normalizedValue;
  const external = input.external.normalizedValue;
  const relative =
    external === 0 ? Math.abs(claim - external) : Math.abs(claim - external) / Math.abs(external);

  const percentUnits =
    input.claim.unitHint === '%' ||
    input.external.unitHint === '%' ||
    input.claim.unitHint === 'bps' ||
    input.external.unitHint === 'bps';

  const tolerance = percentUnits ? 0.05 : 0.03;
  const classification: ContradictionClassification =
    relative <= tolerance ? 'CONSISTENT' : 'APPARENT_CONFLICT';

  return Object.freeze({
    claimId: input.claim.claimId,
    externalRecordId: input.external.recordId,
    classification,
    rationale:
      classification === 'CONSISTENT'
        ? 'Values within deterministic tolerance.'
        : 'Values exceed deterministic tolerance; requires human review.',
    evidenceRefs,
  });
}

export function assessContradictions(input: {
  readonly claims: readonly ExtractedNumericClaim[];
  readonly externalFacts: readonly ExternalFactRecord[];
}): readonly ContradictionAssessment[] {
  const assessments: ContradictionAssessment[] = [];
  for (const claim of input.claims) {
    for (const external of input.externalFacts) {
      assessments.push(classifyPair({ claim, external }));
    }
  }
  return Object.freeze(assessments);
}
