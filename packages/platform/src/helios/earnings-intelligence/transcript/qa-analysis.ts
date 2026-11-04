import { EARN05_EVASION_LEXICON, EARN05_TOPIC_LEXICON } from './taxonomy.ts';
import type { AnalystQuestionAnalysis, ManagementAnswerQuality, ParsedTranscriptSegment } from './types.ts';

const FACT_REQUEST_PATTERNS = [
  /\bwhat (?:is|was|are|were)\b/i,
  /\bhow much\b/i,
  /\bhow many\b/i,
  /\bcan you quantify\b/i,
  /\bcan you provide\b/i,
  /\bgive us\b/i,
  /\bbreak(?:down| out)\b/i,
  /\bmargin\b/i,
  /\bguidance\b/i,
];

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function overlapCoefficient(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  return intersection / Math.min(setA.size, setB.size);
}

function extractTopics(text: string): readonly string[] {
  const hay = text.toLowerCase();
  const topics: string[] = [];
  for (const [topic, lexicon] of Object.entries(EARN05_TOPIC_LEXICON)) {
    if (lexicon.some((term) => hay.includes(term))) {
      topics.push(topic);
    }
  }
  return Object.freeze(topics);
}

function extractRequestedFacts(text: string): readonly string[] {
  const facts: string[] = [];
  for (const pattern of FACT_REQUEST_PATTERNS) {
    if (pattern.test(text)) {
      facts.push(pattern.source.replace(/\\b/g, '').slice(0, 40));
    }
  }
  if (facts.length === 0 && /\?/.test(text)) {
    facts.push('open_ended_question');
  }
  return Object.freeze(facts);
}

function numericContentScore(text: string): number {
  const numbers = text.match(/\b\d[\d,.]*(?:%|bps|bp|million|billion)?\b/gi) ?? [];
  const tokens = text.split(/\s+/).filter(Boolean).length || 1;
  return Math.min(1, numbers.length / Math.max(2, tokens / 45));
}

function specificityScore(text: string): number {
  const numbers = numericContentScore(text);
  const lengthFactor = Math.min(1, text.split(/\s+/).filter(Boolean).length / 120);
  return Math.min(1, numbers * 0.55 + lengthFactor * 0.45);
}

function evasionHits(text: string): number {
  const hay = text.toLowerCase();
  return EARN05_EVASION_LEXICON.filter((term) => hay.includes(term)).length;
}

function managementAnswered(input: {
  readonly question: string;
  readonly answer: string;
  readonly relevance: number;
  readonly specificity: number;
  readonly requestedFacts: readonly string[];
}): boolean {
  if (input.answer.trim().length < 12) {
    return false;
  }
  const evasion = evasionHits(input.answer);
  const hay = input.answer.toLowerCase();
  if (
    evasion > 0 &&
    (hay.includes('not prepared to') ||
      hay.includes('cannot comment') ||
      hay.includes('no comment') ||
      hay.includes('do not disclose'))
  ) {
    return false;
  }
  if (evasion >= 2 && input.relevance < 0.15) {
    return false;
  }
  if (input.requestedFacts.length > 0 && evasion > 0 && input.specificity < 0.2) {
    return false;
  }
  if (input.relevance >= 0.12 && input.specificity >= 0.15) {
    return true;
  }
  return numericContentScore(input.answer) >= 0.2;
}

function pairQuestionsWithAnswers(
  segments: readonly ParsedTranscriptSegment[],
): Array<{ readonly question: ParsedTranscriptSegment; readonly answers: ParsedTranscriptSegment[] }> {
  const pairs: Array<{ question: ParsedTranscriptSegment; answers: ParsedTranscriptSegment[] }> = [];
  let pendingQuestion: ParsedTranscriptSegment | null = null;
  let pendingAnswers: ParsedTranscriptSegment[] = [];

  const flush = (): void => {
    if (pendingQuestion) {
      pairs.push({ question: pendingQuestion, answers: [...pendingAnswers] });
    }
    pendingQuestion = null;
    pendingAnswers = [];
  };

  for (const segment of segments) {
    if (segment.kind === 'ANALYST_QUESTION') {
      flush();
      pendingQuestion = segment;
      continue;
    }
    if (segment.kind === 'MANAGEMENT_ANSWER' && pendingQuestion) {
      pendingAnswers.push(segment);
    }
  }
  flush();
  return pairs;
}

export function analyzeQuestionAnswerBlock(
  segments: readonly ParsedTranscriptSegment[],
): ManagementAnswerQuality {
  const pairs = pairQuestionsWithAnswers(segments);
  const perQuestion: AnalystQuestionAnalysis[] = pairs.map(({ question, answers }) => {
    const answerText = answers.map((segment) => segment.text).join('\n');
    const relevance = overlapCoefficient(question.text, answerText);
    const specificity = specificityScore(answerText);
    const numericContent = numericContentScore(answerText);
    const evasionLexiconHits = evasionHits(answerText);
    const requestedFacts = extractRequestedFacts(question.text);
    const answered = managementAnswered({
      question: question.text,
      answer: answerText,
      relevance,
      specificity,
      requestedFacts,
    });
    return Object.freeze({
      questionSegmentId: question.segmentId,
      answerSegmentIds: Object.freeze(answers.map((segment) => segment.segmentId)),
      questionTopics: extractTopics(question.text),
      requestedFacts,
      answerSemanticRelevance: relevance,
      answerSpecificity: specificity,
      answerNumericContent: numericContent,
      managementAnswered: answered,
      evasionLexiconHits,
      calibrationNote:
        'Evasion lexicon hits are evidence for calibration only; they are not treated as a negative signal by default.',
    });
  });

  const aggregate = (selector: (row: AnalystQuestionAnalysis) => number): number => {
    if (perQuestion.length === 0) {
      return 0;
    }
    return perQuestion.reduce((sum, row) => sum + selector(row), 0) / perQuestion.length;
  };

  const answeredQuestionRatio =
    perQuestion.length === 0
      ? 0
      : perQuestion.filter((row) => row.managementAnswered).length / perQuestion.length;

  return Object.freeze({
    aggregateRelevance: aggregate((row) => row.answerSemanticRelevance),
    aggregateSpecificity: aggregate((row) => row.answerSpecificity),
    aggregateNumericContent: aggregate((row) => row.answerNumericContent),
    answeredQuestionRatio,
    perQuestion: Object.freeze(perQuestion),
  });
}
