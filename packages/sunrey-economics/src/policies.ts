/**
 * Policy consumption adapters over the final Chunk 71–74 owners.
 *
 * Chunk 71 monetary constitution, Chunk 72 validator economics,
 * Chunk 73 FeePolicyV2, and Chunk 74 MoonRey policy governance are
 * consumed from canonical owners. This laboratory does not invent
 * production parameters or activate them.
 */

import { MONETARY_POLICY_VERSION_ID } from '../../sunrey-chain/src/economics/types.ts';
import { developmentIssuancePolicy, type MoonReyIssuancePolicy } from '../../sunrey-chain/src/productive/policy.ts';
import { developmentPolicyBundle } from '../../sunrey-chain/src/productive/policy-governance/registry.ts';
import { WEIGHT_SCALE } from '../../sunrey-chain/src/productive/types.ts';
import {
  BRIDGE_FLOW_KINDS,
  BRIDGE_POLICY_VERSION,
  DUAL_ECONOMY_POLICY_CLASS,
  FEE_POLICY_VERSION,
  MOONREY_PRODUCTIVE_POLICY_VERSION,
  SUNREY_MONETARY_POLICY_VERSION,
  VALIDATOR_ECONOMICS_VERSION,
} from './ids.ts';
import { mulBps } from './seed.ts';
import type { DualEconomyScenario, EconomicBridgePolicy } from './types.ts';

export const DEFAULT_BRIDGE_POLICY: EconomicBridgePolicy = Object.freeze({
  policyVersion: BRIDGE_POLICY_VERSION,
  parameterClass: DUAL_ECONOMY_POLICY_CLASS,
  algorithmicPeg: false,
  permittedFlows: BRIDGE_FLOW_KINDS,
  notes: Object.freeze([
    'Flows describe legitimate activity between human and productive layers.',
    'SunRey/MoonRey conversion is Exchange order-flow only.',
    'No algorithmic peg and no intrinsic 1:N ratio.',
  ]),
});

export function sunreyMonetaryIssuance(input: {
  readonly scenario: DualEconomyScenario;
  readonly epoch: number;
  readonly humanActivity: bigint;
}): bigint {
  const base = 50n + input.humanActivity / 20_000n;
  return mulBps(base, input.scenario.policies.sunreyIssuanceScaleBps);
}

export function activeMonetaryPolicyVersion(): string {
  return MONETARY_POLICY_VERSION_ID;
}

export function activeMoonReyPolicyVersion(): number {
  return developmentPolicyBundle().policyVersion;
}

export function consumedPolicyVersions(): {
  readonly sunreyMonetary: typeof SUNREY_MONETARY_POLICY_VERSION;
  readonly moonreyProductive: typeof MOONREY_PRODUCTIVE_POLICY_VERSION;
  readonly fees: typeof FEE_POLICY_VERSION;
  readonly validators: typeof VALIDATOR_ECONOMICS_VERSION;
  readonly bridge: typeof BRIDGE_POLICY_VERSION;
} {
  return Object.freeze({
    sunreyMonetary: SUNREY_MONETARY_POLICY_VERSION,
    moonreyProductive: MOONREY_PRODUCTIVE_POLICY_VERSION,
    fees: FEE_POLICY_VERSION,
    validators: VALIDATOR_ECONOMICS_VERSION,
    bridge: BRIDGE_POLICY_VERSION,
  });
}

export function moonreyPolicyFor(scenario: DualEconomyScenario): MoonReyIssuancePolicy {
  const base = developmentIssuancePolicy(1);
  const capScale = scenario.policies.moonreyEpochCapScaleBps;
  return Object.freeze({
    ...base,
    policyVersion: base.policyVersion,
    parameterClass: base.parameterClass,
    maximumIssuancePerContribution: mulBps(base.maximumIssuancePerContribution, capScale),
    maximumIssuancePerCategoryPerEpoch: mulBps(base.maximumIssuancePerCategoryPerEpoch, capScale),
    maximumTotalIssuancePerEpoch: mulBps(base.maximumTotalIssuancePerEpoch, capScale),
    maximumIssuancePerObjectPerEpoch: mulBps(base.maximumIssuancePerObjectPerEpoch, capScale),
    maximumIssuancePerControllerPerEpoch: mulBps(base.maximumIssuancePerControllerPerEpoch, capScale),
    qualityMultiplier: WEIGHT_SCALE,
  });
}
