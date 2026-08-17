/**
 * Testnet upgrade workflow. Protocol upgrades require the accountable
 * threshold. A newer binary does not change consensus rules.
 */

import { bftQuorumSatisfied, testnetGovernancePolicy } from './validators.ts';
import type { TestnetValidatorPublic } from './types.ts';

export type UpgradeStatus =
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'SCHEDULED'
  | 'ACTIVATED'
  | 'INCOMPATIBLE'
  | 'REJECTED';

export type TestnetUpgradePlan = {
  readonly upgradeId: string;
  readonly kind: 'PARAMETER_CHANGE';
  readonly currentProtocolVersion: string;
  readonly targetProtocolVersion: string;
  readonly activationHeight: number;
  readonly parameter: string;
  readonly nextValue: number;
  status: UpgradeStatus;
  readonly approvals: string[];
};

export type NodeUpgradeView = {
  readonly validatorId: string;
  readonly compatible: boolean;
  readonly activated: boolean;
  readonly mismatch: string | null;
  readonly caughtUp: boolean;
};

export function proposeParameterUpgrade(input: {
  readonly upgradeId: string;
  readonly activationHeight: number;
  readonly currentHeight: number;
  readonly minActivationLead: number;
  readonly parameter: string;
  readonly nextValue: number;
}): TestnetUpgradePlan | { readonly ok: false; readonly code: 'LEAD_TOO_SHORT' } {
  if (input.activationHeight < input.currentHeight + input.minActivationLead) {
    return { ok: false, code: 'LEAD_TOO_SHORT' };
  }
  return {
    upgradeId: input.upgradeId,
    kind: 'PARAMETER_CHANGE',
    currentProtocolVersion: '1',
    targetProtocolVersion: '1',
    activationHeight: input.activationHeight,
    parameter: input.parameter,
    nextValue: input.nextValue,
    status: 'PROPOSED',
    approvals: [],
  };
}

export function authorizeUpgrade(
  plan: TestnetUpgradePlan,
  voters: readonly string[],
  validators: readonly TestnetValidatorPublic[],
): TestnetUpgradePlan {
  const policy = testnetGovernancePolicy(validators);
  const power = BigInt(voters.length);
  const next: TestnetUpgradePlan = {
    ...plan,
    approvals: [...voters],
    status: bftQuorumSatisfied(power, policy.totalPower) ? 'AUTHORIZED' : 'PROPOSED',
  };
  return next;
}

export function scheduleUpgrade(plan: TestnetUpgradePlan): TestnetUpgradePlan {
  if (plan.status !== 'AUTHORIZED') {
    return plan;
  }
  return { ...plan, status: 'SCHEDULED' };
}

export function activateUpgrade(
  plan: TestnetUpgradePlan,
  height: number,
  nodes: readonly { readonly validatorId: string; readonly binaryVersion: string }[],
): {
  readonly plan: TestnetUpgradePlan;
  readonly nodes: readonly NodeUpgradeView[];
  readonly networkContinues: boolean;
} {
  if (plan.status !== 'SCHEDULED' || height < plan.activationHeight) {
    return {
      plan,
      nodes: nodes.map((node) => ({
        validatorId: node.validatorId,
        compatible: true,
        activated: false,
        mismatch: null,
        caughtUp: false,
      })),
      networkContinues: true,
    };
  }
  const views = nodes.map((node) => {
    const compatible = node.binaryVersion === plan.targetProtocolVersion || node.binaryVersion === 'compatible';
    return {
      validatorId: node.validatorId,
      compatible,
      activated: compatible,
      mismatch: compatible ? null : 'PROTOCOL_PARAMETER_MISMATCH',
      caughtUp: compatible,
    };
  });
  const activated = views.filter((row) => row.activated).length;
  return {
    plan: { ...plan, status: 'ACTIVATED' },
    nodes: views,
    networkContinues: bftQuorumSatisfied(BigInt(activated), BigInt(nodes.length)),
  };
}

export function catchUpIncompatible(node: NodeUpgradeView): NodeUpgradeView {
  return { ...node, compatible: true, activated: true, mismatch: null, caughtUp: true };
}
