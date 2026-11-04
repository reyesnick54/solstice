import {
  EARN05_BACKWARD_LEXICON,
  EARN05_EVASION_LEXICON,
  EARN05_FORWARD_LEXICON,
  EARN05_HEDGING_LEXICON,
  EARN05_TOPIC_LEXICON,
} from './taxonomy.ts';
import type { ParsedTranscriptSegment, ToneFeatureBundle } from './types.ts';

function normalize(text: string): string {
  return text.toLowerCase();
}

function countLexiconHits(text: string, lexicon: readonly string[]): number {
  const hay = normalize(text);
  let hits = 0;
  for (const term of lexicon) {
    if (hay.includes(term)) {
      hits += 1;
    }
  }
  return hits;
}

function sentimentProxy(text: string): number {
  const positive = countLexiconHits(text, [
    'strong',
    'record',
    'growth',
    'improve',
    'momentum',
    'confident',
    'pleased',
    'outperform',
    'robust',
  ]);
  const negative = countLexiconHits(text, [
    'weak',
    'decline',
    'pressure',
    'challenge',
    'headwind',
    'soft',
    'disappoint',
    'slow',
    'cautious',
  ]);
  const tokens = text.split(/\s+/).filter(Boolean).length || 1;
  const raw = (positive - negative) / Math.sqrt(tokens);
  return Math.max(-1, Math.min(1, raw));
}

function intensity(text: string, lexicon: readonly string[]): number {
  const tokens = text.split(/\s+/).filter(Boolean).length || 1;
  return Math.min(1, countLexiconHits(text, lexicon) / Math.max(8, tokens / 40));
}

function numericSpecificity(text: string): number {
  const numbers = text.match(/\b\d[\d,.]*(?:%|bps|bp|million|billion|m|b)?\b/gi) ?? [];
  const tokens = text.split(/\s+/).filter(Boolean).length || 1;
  return Math.min(1, numbers.length / Math.max(4, tokens / 50));
}

function specificityScore(text: string): number {
  const numbers = numericSpecificity(text);
  const proper = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? []).length;
  const tokens = text.split(/\s+/).filter(Boolean).length || 1;
  const properRate = Math.min(1, proper / Math.max(3, tokens / 30));
  return Math.min(1, numbers * 0.6 + properRate * 0.4);
}

function directnessScore(text: string): number {
  const hedges = countLexiconHits(text, EARN05_HEDGING_LEXICON);
  const evasion = countLexiconHits(text, EARN05_EVASION_LEXICON);
  const tokens = text.split(/\s+/).filter(Boolean).length || 1;
  const penalty = (hedges + evasion * 2) / Math.max(5, tokens / 35);
  return Math.max(0, Math.min(1, 1 - penalty));
}

function aggregateText(segments: readonly ParsedTranscriptSegment[]): string {
  return segments.map((segment) => segment.text).join('\n');
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: readonly number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function managementSegments(segments: readonly ParsedTranscriptSegment[]): readonly ParsedTranscriptSegment[] {
  return segments.filter(
    (segment) =>
      segment.kind === 'PREPARED_REMARKS' ||
      segment.kind === 'MANAGEMENT_ANSWER' ||
      (segment.speakerRole !== 'ANALYST' && segment.kind !== 'OPERATOR'),
  );
}

function analystSegments(segments: readonly ParsedTranscriptSegment[]): readonly ParsedTranscriptSegment[] {
  return segments.filter(
    (segment) => segment.kind === 'ANALYST_QUESTION' || segment.speakerRole === 'ANALYST',
  );
}

function qaSegments(segments: readonly ParsedTranscriptSegment[]): readonly ParsedTranscriptSegment[] {
  return segments.filter(
    (segment) => segment.kind === 'ANALYST_QUESTION' || segment.kind === 'MANAGEMENT_ANSWER',
  );
}

function preparedSegments(segments: readonly ParsedTranscriptSegment[]): readonly ParsedTranscriptSegment[] {
  return segments.filter((segment) => segment.kind === 'PREPARED_REMARKS');
}

export function computeLexicalToneFeatures(
  segments: readonly ParsedTranscriptSegment[],
): ToneFeatureBundle {
  const mgmt = managementSegments(segments);
  const analysts = analystSegments(segments);
  const qa = qaSegments(segments);
  const prepared = preparedSegments(segments);

  const mgmtText = aggregateText(mgmt);
  const analystText = aggregateText(analysts);
  const qaText = aggregateText(qa);
  const preparedText = aggregateText(prepared);
  const allText = aggregateText(segments);

  const managementTone = sentimentProxy(mgmtText);
  const analystTone = sentimentProxy(analystText);
  const qaTone = sentimentProxy(qaText);
  const preparedTone = sentimentProxy(preparedText);

  const perSegmentTone = segments.map((segment) => sentimentProxy(segment.text));
  const toneDispersion = Math.min(1, stdDev(perSegmentTone));

  const forwardLookingScore = intensity(allText, EARN05_FORWARD_LEXICON);
  const backwardLookingScore = intensity(allText, EARN05_BACKWARD_LEXICON);
  const denom = forwardLookingScore + backwardLookingScore || 1;
  const futurePastBalance = (forwardLookingScore - backwardLookingScore) / denom;

  return Object.freeze({
    managementTone,
    analystTone,
    qaTone,
    preparedTone,
    toneDispersion,
    managementAnalystToneGap: managementTone - analystTone,
    uncertaintyScore: intensity(allText, ['uncertain', 'uncertainty', 'volatile', 'unpredictable']),
    hedgingScore: intensity(allText, EARN05_HEDGING_LEXICON),
    specificityScore: specificityScore(allText),
    directnessScore: directnessScore(allText),
    answerEvasionScore: intensity(allText, EARN05_EVASION_LEXICON),
    forwardLookingScore,
    backwardLookingScore,
    futurePastBalance,
    numericalSpecificityScore: numericSpecificity(allText),
    riskTopicIntensity: intensity(allText, EARN05_TOPIC_LEXICON.risk),
    capitalAllocationIntensity: intensity(allText, EARN05_TOPIC_LEXICON.capitalAllocation),
    demandIntensity: intensity(allText, EARN05_TOPIC_LEXICON.demand),
    pricingIntensity: intensity(allText, EARN05_TOPIC_LEXICON.pricing),
    marginLanguageIntensity: intensity(allText, EARN05_TOPIC_LEXICON.margin),
    hiringIntensity: intensity(allText, EARN05_TOPIC_LEXICON.hiring),
    costControlIntensity: intensity(allText, EARN05_TOPIC_LEXICON.costControl),
  });
}
