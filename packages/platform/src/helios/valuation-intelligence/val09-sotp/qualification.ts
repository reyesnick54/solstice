import { HELIOS_VAL09_SOTP_BLOCKED, HELIOS_VAL09_SOTP_QUALIFIED } from './taxonomy.ts';

export { HELIOS_VAL09_SOTP_QUALIFIED, HELIOS_VAL09_SOTP_BLOCKED };

export function evaluateVal09SotpQualification(input: {
  readonly segmentBreakdownPresent: boolean;
  readonly simulationOnly: boolean;
}) {
  const blockers: string[] = [];
  if (!input.segmentBreakdownPresent) blockers.push('segment_breakdown');
  if (!input.simulationOnly) blockers.push('simulation_only');
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL09_SOTP_QUALIFIED : HELIOS_VAL09_SOTP_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
