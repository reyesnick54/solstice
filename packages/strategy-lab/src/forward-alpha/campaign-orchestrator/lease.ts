import { addMs } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import type { ForwardAlphaCampaignId } from '../ids.ts';
import type { CampaignLease, CampaignOrchestratorFailure, CampaignRunContext } from './types.ts';

export function acquireCampaignLease(input: {
  readonly context: CampaignRunContext;
  readonly ownerId: string;
  readonly now: UtcInstant;
  readonly leaseMs: number;
}): CampaignRunContext | CampaignOrchestratorFailure {
  const lease = input.context.lease;
  if (
    lease &&
    lease.expiresAt > input.now &&
    lease.ownerId !== input.ownerId
  ) {
    return {
      code: 'LEASE_DENIED',
      message: `campaign leased by ${lease.ownerId} until ${lease.expiresAt}`,
    };
  }
  const generation = (lease?.leaseGeneration ?? 0) + (lease && lease.ownerId === input.ownerId ? 0 : 1);
  const nextLease: CampaignLease = Object.freeze({
    campaignId: input.context.campaignId,
    ownerId: input.ownerId,
    acquiredAt: input.now,
    expiresAt: addMs(input.now, input.leaseMs) as UtcInstant,
    leaseGeneration: generation,
  });
  return Object.freeze({
    ...input.context,
    lease: nextLease,
    updatedAt: input.now,
  });
}

export function renewCampaignLease(input: {
  readonly context: CampaignRunContext;
  readonly ownerId: string;
  readonly leaseGeneration: number;
  readonly now: UtcInstant;
  readonly leaseMs: number;
}): CampaignRunContext | CampaignOrchestratorFailure {
  const lease = input.context.lease;
  if (!lease || lease.ownerId !== input.ownerId || lease.leaseGeneration !== input.leaseGeneration) {
    return { code: 'LEASE_STALE', message: 'lease generation or owner mismatch' };
  }
  if (lease.expiresAt <= input.now) {
    return { code: 'LEASE_LOST', message: 'lease expired' };
  }
  const renewed: CampaignLease = Object.freeze({
    ...lease,
    acquiredAt: input.now,
    expiresAt: addMs(input.now, input.leaseMs) as UtcInstant,
  });
  return Object.freeze({
    ...input.context,
    lease: renewed,
    updatedAt: input.now,
  });
}

export function releaseCampaignLease(context: CampaignRunContext, ownerId: string, leaseGeneration: number): CampaignRunContext {
  const lease = context.lease;
  if (!lease || lease.ownerId !== ownerId || lease.leaseGeneration !== leaseGeneration) {
    return context;
  }
  return Object.freeze({
    ...context,
    lease: null,
  });
}

export function assertActiveLease(
  context: CampaignRunContext,
  ownerId: string,
  leaseGeneration: number,
): CampaignOrchestratorFailure | null {
  const lease = context.lease;
  if (!lease) {
    return { code: 'LEASE_LOST', message: 'no active lease' };
  }
  if (lease.ownerId !== ownerId || lease.leaseGeneration !== leaseGeneration) {
    return { code: 'LEASE_STALE', message: 'lease fencing failure' };
  }
  return null;
}

export function campaignLeaseKey(campaignId: ForwardAlphaCampaignId): string {
  return `fcamp-lease:${campaignId}`;
}
