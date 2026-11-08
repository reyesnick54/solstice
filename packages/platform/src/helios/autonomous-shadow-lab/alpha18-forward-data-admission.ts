/**
 * ALPHA18 — chronological forward data admission gate (simulation fixtures).
 */

export const HELIOS_ALPHA18_FORWARD_DATA_ADMISSION = 'HELIOS_ALPHA18_FORWARD_DATA_ADMISSION' as const;

export function admissionRequiresChronologicalSequence(seq: number, lastSeq: number): boolean {
  return seq > lastSeq;
}
