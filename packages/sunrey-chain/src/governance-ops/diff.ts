import { commitGovernance } from './hash.ts';
import type { CanonicalPolicyDiff, PolicyParameterMap, PolicySnapshot } from './types.ts';

function keysOf(map: PolicyParameterMap): readonly string[] {
  return Object.keys(map).sort();
}

function changedKeys(left: PolicyParameterMap, right: PolicyParameterMap): readonly string[] {
  const names = new Set([...keysOf(left), ...keysOf(right)]);
  return [...names].filter((name) => left[name] !== right[name]).sort();
}

export function diffPolicySnapshots(current: PolicySnapshot, proposed: PolicySnapshot): CanonicalPolicyDiff {
  const currentParams = keysOf(current.parameters);
  const proposedParams = keysOf(proposed.parameters);
  const addedParameters = proposedParams.filter((name) => !(name in current.parameters));
  const removedParameters = currentParams.filter((name) => !(name in proposed.parameters));
  const changedParameters = currentParams.filter(
    (name) => name in proposed.parameters && current.parameters[name] !== proposed.parameters[name],
  );
  const draft = {
    schemaVersion: 1 as const,
    fromVersion: current.version,
    toVersion: proposed.version,
    addedParameters,
    removedParameters,
    changedParameters,
    changedAuthority: current.authority !== proposed.authority,
    changedCaps: changedKeys(current.caps, proposed.caps),
    changedFormulas: changedKeys(current.formulas, proposed.formulas),
    changedEligibility: changedKeys(current.eligibility, proposed.eligibility),
    changedActivationConditions: changedKeys(current.activation, proposed.activation),
  };
  return Object.freeze({
    ...draft,
    diffHash: commitGovernance(draft),
  });
}

export function assertUntamperedDiff(
  current: PolicySnapshot,
  proposed: PolicySnapshot,
  claimed: CanonicalPolicyDiff,
): boolean {
  const actual = diffPolicySnapshots(current, proposed);
  return (
    actual.diffHash === claimed.diffHash &&
    actual.fromVersion === claimed.fromVersion &&
    actual.toVersion === claimed.toVersion &&
    actual.changedAuthority === claimed.changedAuthority &&
    actual.addedParameters.join('|') === claimed.addedParameters.join('|') &&
    actual.removedParameters.join('|') === claimed.removedParameters.join('|') &&
    actual.changedParameters.join('|') === claimed.changedParameters.join('|') &&
    actual.changedCaps.join('|') === claimed.changedCaps.join('|') &&
    actual.changedFormulas.join('|') === claimed.changedFormulas.join('|') &&
    actual.changedEligibility.join('|') === claimed.changedEligibility.join('|') &&
    actual.changedActivationConditions.join('|') === claimed.changedActivationConditions.join('|')
  );
}
