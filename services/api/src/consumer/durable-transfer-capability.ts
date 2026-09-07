import { assuranceAtLeast, isGrantActive } from '@solstice/identity';

import type { DurableSimulationRuntime } from '../../../accounts/src/product-durable-adapters.ts';

export type DurableTransferCapabilityReport = {
  readonly schema: 'sunrey.durable-transfer-capability.v1';
  readonly eligibleActors: number;
  readonly grantsAdded: number;
  readonly grantsPreserved: number;
};

/**
 * Restores the user-side INTERNAL_TRANSFER capability for hosted durable
 * sandbox personas that are active, verified, and strongly authenticated.
 *
 * This intentionally excludes restricted/suspended identities and KYC-pending
 * personas. The grant is persisted through the canonical Identity service; no
 * ActionType is trusted from the client and no production capability is enabled.
 */
export async function ensureDurableSandboxTransferCapability(
  durable: DurableSimulationRuntime,
): Promise<DurableTransferCapabilityReport> {
  const service = durable.runtime.identity.service;
  const now = durable.runtime.clock.now();
  let eligibleActors = 0;
  let grantsAdded = 0;
  let grantsPreserved = 0;

  for (const [actorId, identityId] of service.store.identityByActor.entries()) {
    if (!actorId.startsWith('actor_sandbox_')) {
      continue;
    }

    const identity = service.store.identities.get(identityId);
    const session = service.activeSessionForActor(actorId);
    const kyc = service.latestKyc(identityId);
    if (
      !identity ||
      identity.status !== 'ACTIVE' ||
      !session ||
      session.revocationState !== 'ACTIVE' ||
      !assuranceAtLeast(session.authenticationStrength, 'STRONG') ||
      !kyc ||
      kyc.verificationState !== 'VERIFIED'
    ) {
      continue;
    }

    eligibleActors += 1;
    const existing = [...service.store.grants.values()].find(
      (grant) =>
        grant.identityId === identityId &&
        grant.capability === 'TRANSFER_REQUEST' &&
        isGrantActive(grant, now),
    );
    if (existing) {
      grantsPreserved += 1;
      continue;
    }

    const granted = service.grantCapability(
      identityId,
      'TRANSFER_REQUEST',
      'IDENTITY_SERVICE',
      'operator_1',
    );
    if (!granted.ok) {
      throw new Error(
        `durable sandbox transfer capability failed for ${actorId}: ${granted.error.message}`,
      );
    }
    grantsAdded += 1;
  }

  if (grantsAdded > 0) {
    await durable.persistAuthentication();
  }

  return Object.freeze({
    schema: 'sunrey.durable-transfer-capability.v1',
    eligibleActors,
    grantsAdded,
    grantsPreserved,
  });
}
