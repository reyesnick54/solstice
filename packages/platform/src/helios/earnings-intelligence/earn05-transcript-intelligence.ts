export const EARN05_TRANSCRIPT_INTELLIGENCE_MODULE =
  'packages/platform/src/helios/earnings-intelligence/transcript/service.ts' as const;

export { analyzeEarningsTranscript, EarningsTranscriptIntelligenceService } from './transcript/service.ts';
export {
  HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED,
  HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_BLOCKED,
  evaluateEarn05Qualification,
} from './transcript/qualification.ts';

export function scoreTranscriptTone(input: {
  readonly positiveTokenCount: number;
  readonly negativeTokenCount: number;
  readonly knowableBeforeDecision: boolean;
}): { readonly toneBps: number; readonly usable: boolean } {
  if (!input.knowableBeforeDecision) {
    return Object.freeze({ toneBps: 0, usable: false });
  }
  const total = input.positiveTokenCount + input.negativeTokenCount;
  if (total === 0) {
    return Object.freeze({ toneBps: 5_000, usable: true });
  }
  const toneBps = Math.round((input.positiveTokenCount * 10_000) / total);
  return Object.freeze({ toneBps, usable: true });
}
