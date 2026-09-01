/**
 * Wave 7 — accepted program gaps for the 126-provider Wave 0 target.
 *
 * The authoritative Wave 0 master list was never supplied. These category slots
 * document honest accounting — not fabricated provider integrations.
 */

export type Wave7ProgramGap = {
  readonly gapId: string;
  readonly category: string;
  readonly waveScope: 'wave6';
  readonly slotCount: number;
  readonly status: 'MISSING_IMPLEMENTATION_ACCEPTED';
  readonly reason: string;
};

/** Accepted gaps totaling 24 slots (126 expected − 102 catalog entries). */
export const WAVE7_ACCEPTED_PROGRAM_GAPS: readonly Wave7ProgramGap[] = Object.freeze([
  gap('travel', 3, 'Wave 6 travel/geo scope — master list never supplied; access-economy simulation only.'),
  gap('jobs_skills', 3, 'Wave 6 jobs/career scope — no free/public catalog entries verified.'),
  gap('research', 3, 'Wave 6 research/open-data scope — master list never supplied.'),
  gap('health', 2, 'Wave 6 health reference scope — distinct from HIN/Vault; legal review required.'),
  gap('hin', 2, 'Wave 6 HIN public-reference scope — private Vault data never exposed to providers.'),
  gap('geolocation', 3, 'Wave 6 geolocation scope — minimum-necessary data policy pending catalog.'),
  gap('logistics', 2, 'Wave 6 logistics scope — oracle family stubs only.'),
  gap('ai_inference', 2, 'Wave 6 AI/open-model scope — S3M-primary; Grok reserved Chunk 103.'),
  gap('open_data_misc', 4, 'Wave 6 miscellaneous open-data slots — authoritative list pending.'),
]);

export const WAVE7_ACCEPTED_GAP_COUNT = WAVE7_ACCEPTED_PROGRAM_GAPS.reduce((sum, g) => sum + g.slotCount, 0);

export const WAVE7_EXPECTED_PROGRAM_TOTAL = 126 as const;

function gap(category: string, slotCount: number, reason: string): Wave7ProgramGap {
  return Object.freeze({
    gapId: `wave7-gap-${category}`,
    category,
    waveScope: 'wave6',
    slotCount,
    status: 'MISSING_IMPLEMENTATION_ACCEPTED',
    reason,
  });
}
