import type { SubjectRecord } from '@solstice/compliance-kernel';
import { ActionType, openAccountIntent, type OpenAccountIntent } from '@solstice/permissions';

import { createAccountsRuntime, type AccountsRuntime } from './runtime.ts';

export function clearedSubject(actorId = 'actor-cleared'): SubjectRecord {
  return {
    actorId,
    identityAssurance: 'VERIFIED',
    capabilities: [ActionType.OPEN_ACCOUNT],
    jurisdiction: 'GB',
    kycState: 'VERIFIED',
    riskPosture: 'ACCEPTABLE',
    permittedPurposes: [ActionType.OPEN_ACCOUNT],
  };
}

export function blockedSubject(actorId = 'actor-blocked'): SubjectRecord {
  return {
    actorId,
    identityAssurance: 'VERIFIED',
    capabilities: [ActionType.OPEN_ACCOUNT],
    jurisdiction: 'GB',
    kycState: 'FAILED',
    riskPosture: 'UNACCEPTABLE',
    permittedPurposes: [ActionType.OPEN_ACCOUNT],
  };
}

export function runtimeWithClearedActor(
  actorId = 'actor-cleared',
): AccountsRuntime {
  const runtime = createAccountsRuntime();
  runtime.kernel.registerSubject(clearedSubject(actorId));
  return runtime;
}

export function openIntent(
  overrides: {
    intentId?: string;
    actorId?: string;
    accountId?: string;
    jurisdiction?: string;
    purpose?: string;
  } = {},
): OpenAccountIntent {
  const intentId = overrides.intentId ?? 'intent-open-001';
  return openAccountIntent({
    intentId,
    actorId: overrides.actorId ?? 'actor-cleared',
    requestedAt: '2026-08-13T12:00:00.000Z',
    payload: {
      accountId: overrides.accountId ?? 'acct-001',
      ownerId: 'cust-001',
      accountClass: 'INSURED_DEPOSIT',
      productId: 'prod-instant-access',
      legalEntityId: 'le_uk',
      jurisdiction: overrides.jurisdiction ?? 'GB',
      currency: 'GBP',
      purpose: overrides.purpose ?? ActionType.OPEN_ACCOUNT,
    },
  });
}
