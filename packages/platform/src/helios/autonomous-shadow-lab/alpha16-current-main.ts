/**
 * ALPHA16 — current-main forward-alpha evidence qualification dependency.
 */

export const HELIOS_ALPHA16_CURRENT_MAIN = 'HELIOS_ALPHA16_CURRENT_MAIN' as const;

export const ALPHA16_PREREQUISITE_MARKER = 'HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED' as const;

export {
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
  evaluateForwardAlphaEvidenceQualification,
} from '../forward-alpha-evidence/alpha15-qualification.ts';
