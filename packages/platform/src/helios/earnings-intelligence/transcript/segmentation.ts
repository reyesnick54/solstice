import { inferSpeakerRole } from './speaker-roles.ts';
import type {
  ParsedTranscriptSegment,
  PointInTimeEarningsTranscript,
  TranscriptSegmentInput,
  TranscriptSegmentKind,
} from './types.ts';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%$-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function normalizeKind(kind: TranscriptSegmentKind): TranscriptSegmentKind {
  return kind;
}

export function parseStructuredSegments(
  segments: readonly TranscriptSegmentInput[],
): readonly ParsedTranscriptSegment[] {
  const sorted = [...segments].sort((a, b) => a.sequence - b.sequence);
  return Object.freeze(
    sorted.map((segment) =>
      Object.freeze({
        segmentId: segment.segmentId,
        kind: normalizeKind(segment.kind),
        speakerLabel: segment.speakerLabel,
        speakerRole: inferSpeakerRole(segment.speakerLabel, segment.kind),
        text: segment.text.trim(),
        sequence: segment.sequence,
        tokenCount: tokenize(segment.text).length,
      }),
    ),
  );
}

const SPEAKER_LINE = /^([A-Za-z0-9 .,'()-]{2,80}):\s*(.+)$/;

export function parseRawTranscriptText(raw: string): readonly TranscriptSegmentInput[] {
  const lines = raw.split(/\r?\n/);
  const segments: TranscriptSegmentInput[] = [];
  let sequence = 0;
  let current: TranscriptSegmentInput | null = null;
  let inQa = false;

  const flush = (): void => {
    if (current && current.text.trim().length > 0) {
      segments.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (/^q\s*&\s*a\s*session$/i.test(trimmed) || /^question-and-answer/i.test(trimmed)) {
      flush();
      inQa = true;
      continue;
    }
    if (/^prepared remarks$/i.test(trimmed)) {
      flush();
      inQa = false;
      continue;
    }
    const match = SPEAKER_LINE.exec(trimmed);
    if (match) {
      flush();
      const speakerLabel = match[1]!.trim();
      const text = match[2]!.trim();
      const operator = /operator/i.test(speakerLabel);
      const analyst =
        inQa &&
        !operator &&
        (/\banalyst\b/i.test(speakerLabel) ||
          !/\b(chief|ceo|cfo|coo|president|executive|officer)\b/i.test(speakerLabel));
      const kind: TranscriptSegmentKind = operator
        ? 'OPERATOR'
        : inQa
          ? analyst
            ? 'ANALYST_QUESTION'
            : 'MANAGEMENT_ANSWER'
          : 'PREPARED_REMARKS';
      sequence += 1;
      current = Object.freeze({
        segmentId: `seg_${sequence}`,
        kind,
        speakerLabel,
        text,
        sequence,
      });
      continue;
    }
    if (current) {
      current = Object.freeze({
        ...current,
        text: `${current.text}\n${trimmed}`,
      });
    }
  }
  flush();
  return Object.freeze(segments);
}

export function parseEarningsTranscript(
  transcript: PointInTimeEarningsTranscript,
): readonly ParsedTranscriptSegment[] {
  if (transcript.segments.length === 0) {
    return Object.freeze([]);
  }
  return parseStructuredSegments(transcript.segments);
}
