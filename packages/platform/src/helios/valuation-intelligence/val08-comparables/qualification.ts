import { HELIOS_VAL08_COMPARABLES_BLOCKED, HELIOS_VAL08_COMPARABLES_QUALIFIED } from './taxonomy.ts';

export { HELIOS_VAL08_COMPARABLES_QUALIFIED, HELIOS_VAL08_COMPARABLES_BLOCKED };

export function evaluateVal08ComparablesQualification(input: {
  readonly peerDistributionPresent: boolean;
  readonly pointInTimePeers: boolean;
  readonly simulationOnly: boolean;
}) {
  const blockers: string[] = [];
  if (!input.peerDistributionPresent) blockers.push('peer_distribution');
  if (!input.pointInTimePeers) blockers.push('point_in_time_peers');
  if (!input.simulationOnly) blockers.push('simulation_only');
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL08_COMPARABLES_QUALIFIED : HELIOS_VAL08_COMPARABLES_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
