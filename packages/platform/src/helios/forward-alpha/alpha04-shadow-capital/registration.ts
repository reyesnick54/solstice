import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { ShadowCapitalRegistration, ShadowCampaignPolicy } from './types.ts';
import { SHADOW_RESEARCH_POSTURE, type ShadowCapitalAccount } from './types.ts';

function registrationFingerprint(input: {
  readonly registrationId: string;
  readonly startingNotionalMinor: string;
  readonly currency: string;
  readonly registeredAt: UtcInstant;
}): string {
  const payload = [
    input.registrationId,
    input.startingNotionalMinor,
    input.currency,
    input.registeredAt,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export function registerShadowCapitalAccount(input: {
  readonly accountId: string;
  readonly registrationId: string;
  readonly startingNotionalMinor: string;
  readonly currency: string;
  readonly registeredAt: UtcInstant;
  readonly campaignPolicy: ShadowCampaignPolicy;
  readonly strategyIds?: readonly string[];
}): ShadowCapitalAccount {
  if (BigInt(input.startingNotionalMinor) <= 0n) {
    throw new Error('starting notional must be positive');
  }
  const registration: ShadowCapitalRegistration = Object.freeze({
    schema: 'sunrey.helios.shadow-capital-registration.v1',
    registrationId: input.registrationId,
    startingNotionalMinor: input.startingNotionalMinor,
    currency: input.currency,
    registeredAt: input.registeredAt,
    registrationFingerprint: registrationFingerprint({
      registrationId: input.registrationId,
      startingNotionalMinor: input.startingNotionalMinor,
      currency: input.currency,
      registeredAt: input.registeredAt,
    }),
  });
  return Object.freeze({
    accountId: input.accountId,
    registration,
    posture: SHADOW_RESEARCH_POSTURE,
    campaignPolicy: Object.freeze({ ...input.campaignPolicy }),
    strategyIds: Object.freeze([...(input.strategyIds ?? ['DEFAULT'])]),
  });
}

export function assertRegistrationUnchanged(
  before: ShadowCapitalRegistration,
  after: ShadowCapitalRegistration,
): boolean {
  return (
    before.registrationId === after.registrationId &&
    before.startingNotionalMinor === after.startingNotionalMinor &&
    before.currency === after.currency &&
    before.registrationFingerprint === after.registrationFingerprint
  );
}
