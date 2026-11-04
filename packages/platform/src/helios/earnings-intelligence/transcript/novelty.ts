import { EARN05_TOPIC_LEXICON } from './taxonomy.ts';
import type { NoveltyComparisonCorpus, NoveltyFeatures, ParsedTranscriptSegment } from './types.ts';

function tokenBag(text: string): Map<string, number> {
  const bag = new Map<string, number>();
  for (const token of text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)) {
    bag.set(token, (bag.get(token) ?? 0) + 1);
  }
  return bag;
}

function cosineDissimilarity(a: string, b: string): number {
  const bagA = tokenBag(a);
  const bagB = tokenBag(b);
  if (bagA.size === 0 && bagB.size === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, count] of bagA) {
    normA += count * count;
  }
  for (const [, count] of bagB) {
    normB += count * count;
  }
  for (const [token, countA] of bagA) {
    const countB = bagB.get(token) ?? 0;
    dot += countA * countB;
  }
  if (normA === 0 || normB === 0) {
    return 1;
  }
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, 1 - similarity));
}

function aggregateText(segments: readonly ParsedTranscriptSegment[] | null): string {
  if (!segments || segments.length === 0) {
    return '';
  }
  return segments.map((segment) => segment.text).join('\n');
}

function activeTopics(text: string): readonly string[] {
  const hay = text.toLowerCase();
  const topics: string[] = [];
  for (const [topic, lexicon] of Object.entries(EARN05_TOPIC_LEXICON)) {
    if (lexicon.some((term) => hay.includes(term))) {
      topics.push(topic);
    }
  }
  return Object.freeze(topics);
}

function topicDelta(current: readonly string[], prior: readonly string[]): {
  readonly emergence: readonly string[];
  readonly disappearance: readonly string[];
} {
  const currentSet = new Set(current);
  const priorSet = new Set(prior);
  const emergence = current.filter((topic) => !priorSet.has(topic));
  const disappearance = prior.filter((topic) => !currentSet.has(topic));
  return Object.freeze({
    emergence: Object.freeze(emergence),
    disappearance: Object.freeze(disappearance),
  });
}

export function computeNoveltyFeatures(input: {
  readonly currentSegments: readonly ParsedTranscriptSegment[];
  readonly comparables: NoveltyComparisonCorpus;
}): NoveltyFeatures {
  const currentText = aggregateText(input.currentSegments);
  const priorQuarter = aggregateText(input.comparables.priorQuarterTranscript);
  const priorYear = aggregateText(input.comparables.sameQuarterPriorYearTranscript);
  const filing = input.comparables.latestTenQOrTenKText ?? '';
  const guidance = input.comparables.latestGuidanceText ?? '';
  const priorMgmt = input.comparables.priorManagementLanguageText ?? '';

  const shifts = [
    priorQuarter ? cosineDissimilarity(currentText, priorQuarter) : null,
    priorYear ? cosineDissimilarity(currentText, priorYear) : null,
    filing ? cosineDissimilarity(currentText, filing) : null,
    priorMgmt ? cosineDissimilarity(currentText, priorMgmt) : null,
  ].filter((value): value is number => value !== null);

  const semanticNovelty =
    shifts.length === 0 ? 0 : shifts.reduce((sum, value) => sum + value, 0) / shifts.length;

  const referenceText = priorQuarter || priorYear || priorMgmt;
  const topicDeltaResult = topicDelta(activeTopics(currentText), activeTopics(referenceText));

  const guidanceLanguageShift = guidance
    ? cosineDissimilarity(currentText, guidance)
    : priorMgmt
      ? cosineDissimilarity(currentText, priorMgmt)
      : 0;

  return Object.freeze({
    semanticNovelty,
    topicEmergence: topicDeltaResult.emergence,
    topicDisappearance: topicDeltaResult.disappearance,
    languageShift: priorQuarter ? cosineDissimilarity(currentText, priorQuarter) : semanticNovelty,
    guidanceLanguageShift,
  });
}
