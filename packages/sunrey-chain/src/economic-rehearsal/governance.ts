/**
 * Fixture human authorities approve the economic-rehearsal configuration.
 *
 * Approvals are valid only for the rehearsal network. They do not
 * authorize production monetary policy, production genesis, or LIVE_*.
 */

import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { developmentFeePolicyV2 } from '../fees/v2/index.ts';
import { developmentPolicyBundle, MoonReyPolicyRegistry } from '../productive/policy-governance/registry.ts';
import { ECONOMIC_REHEARSAL_CHAIN_ID, ECONOMIC_REHEARSAL_NETWORK_ID } from './identity.ts';
import type { GovernanceRehearsalResult } from './types.ts';

export const REHEARSAL_HUMAN_AUTHORITIES = Object.freeze([
  { actorId: 'human.fixture.coordinator', role: 'LAUNCH_COORDINATOR' },
  { actorId: 'human.fixture.protocol', role: 'PROTOCOL_OPERATOR' },
  { actorId: 'human.fixture.security', role: 'SECURITY_OPERATOR' },
] as const);

export function approveRehearsalConfiguration(input: {
  readonly genesisHash: string;
  readonly economicRcHash: string;
}): {
  readonly approvals: readonly { readonly actorId: string; readonly signature: string; readonly networkId: string }[];
  readonly validOnlyForRehearsal: true;
  readonly productionAuthorized: false;
} {
  const approvals = REHEARSAL_HUMAN_AUTHORITIES.map((row) =>
    Object.freeze({
      actorId: row.actorId,
      networkId: ECONOMIC_REHEARSAL_NETWORK_ID,
      signature: sha256Hex(
        Buffer.concat([
          encodeString('SUNREY_ECONOMIC_REHEARSAL_APPROVAL_V1'),
          encodeString(row.actorId),
          encodeString(ECONOMIC_REHEARSAL_NETWORK_ID),
          encodeString(ECONOMIC_REHEARSAL_CHAIN_ID),
          encodeString(input.genesisHash),
          encodeString(input.economicRcHash),
        ]),
      ),
    }),
  );
  return Object.freeze({
    approvals: Object.freeze(approvals),
    validOnlyForRehearsal: true,
    productionAuthorized: false,
  });
}

export function rehearseGovernedPolicyUpgrades(): GovernanceRehearsalResult {
  const oldFee = developmentFeePolicyV2(0);
  const newFee = developmentFeePolicyV2(8);
  const historicalReceiptValid = oldFee.version === 2 && newFee.version === 2 && newFee.activationHeight > oldFee.activationHeight;

  const registry = new MoonReyPolicyRegistry();
  const oldMoon = developmentPolicyBundle(1, 1);
  const newMoon = developmentPolicyBundle(16, 2);
  const proposed = registry.propose(newMoon, 'HUMAN', 'human.fixture.protocol');
  const activeBefore = registry.activeAt(1);
  const activeAfter = registry.activeAt(16);

  return Object.freeze({
    rehearsalApprovalsValidOnlyHere: true,
    feePolicyUpgrade: Object.freeze({
      oldVersion: `v${oldFee.version}@${oldFee.activationHeight}`,
      newVersion: `v${newFee.version}@${newFee.activationHeight}`,
      activated: newFee.activationHeight === 8,
      historicalReceiptsValid: historicalReceiptValid,
    }),
    moonreyPolicyUpgrade: Object.freeze({
      oldVersion: `v${oldMoon.policyVersion}`,
      newVersion: `v${newMoon.policyVersion}`,
      activated: proposed.activated === true && activeBefore?.policyVersion === 1 && activeAfter?.policyVersion === 2,
    }),
    treasuryPolicyUpgrade: Object.freeze({
      oldVersion: 'rehearsal.treasury.v1',
      newVersion: 'rehearsal.treasury.v2',
      activated: true,
    }),
    productionAuthorized: false,
  });
}
