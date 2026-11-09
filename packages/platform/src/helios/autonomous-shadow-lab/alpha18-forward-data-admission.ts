/**
 * ALPHA18 — chronological forward data admission gate (simulation fixtures).
 * Canonical: `packages/platform/src/helios/forward-alpha/alpha18`.
 */

export const HELIOS_ALPHA18_FORWARD_DATA_ADMISSION = 'HELIOS_ALPHA18_FORWARD_DATA_ADMISSION' as const;

export {
  evaluateAlpha18ForwardDataAdmissionQualification,
  HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED,
} from '../forward-alpha/alpha18/index.ts';
