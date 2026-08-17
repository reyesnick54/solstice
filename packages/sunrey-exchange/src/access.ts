import type { ExchangeAccount } from './types.ts';
import type { EligibilityContext } from './types-universal.ts';
import type { ExchangeCounterpartyClass, MarketAccessPolicy, MarketFamily } from './taxonomy.ts';

export type AccountAccessProfile = {
  readonly accountId: string;
  readonly access: MarketAccessPolicy;
  readonly actorClass: ExchangeCounterpartyClass;
  readonly verified: boolean;
  readonly machineId: string | null;
  readonly families: readonly MarketFamily[];
};

export function profileForAccount(
  account: ExchangeAccount,
  input: {
    readonly access?: MarketAccessPolicy;
    readonly actorClass?: ExchangeCounterpartyClass;
    readonly machineId?: string | null;
  } = {},
): AccountAccessProfile {
  return Object.freeze({
    accountId: account.accountId,
    access: input.access ?? 'PUBLIC_DEVELOPMENT',
    actorClass: input.actorClass ?? 'HUMAN',
    verified: account.status === 'ACTIVE_SIMULATION',
    machineId: input.machineId ?? null,
    families: account.marketPermissions,
  });
}

export function enforceMarketAccess(
  profile: AccountAccessProfile,
  required: MarketAccessPolicy,
  family: MarketFamily,
): { readonly allowed: boolean; readonly code: string } {
  if (!profile.families.includes(family) && family !== 'INFORMATION_ASSET') {
    return { allowed: false, code: 'MARKET_ACCESS_DENIED' };
  }
  if (required === 'HUMAN_ONLY' && profile.actorClass === 'MACHINE') {
    return { allowed: false, code: 'HUMAN_ONLY_MARKET' };
  }
  if (required === 'INSTITUTIONAL_ONLY' && profile.actorClass !== 'INSTITUTION') {
    return { allowed: false, code: 'MARKET_ACCESS_DENIED' };
  }
  if (required === 'VERIFIED_ACCOUNT' && !profile.verified) {
    return { allowed: false, code: 'IDENTITY_INELIGIBLE' };
  }
  if (required === 'ELIGIBLE_COUNTERPARTY' && profile.actorClass !== 'ELIGIBLE_COUNTERPARTY' && profile.actorClass !== 'INSTITUTION') {
    return { allowed: false, code: 'MARKET_ACCESS_DENIED' };
  }
  if (required === 'MACHINE_ALLOWED' && profile.actorClass === 'MACHINE' && !profile.machineId) {
    return { allowed: false, code: 'MACHINE_NOT_ALLOWED' };
  }
  return { allowed: true, code: 'ELIGIBLE' };
}

export function contextFromProfile(
  profile: AccountAccessProfile,
  extras: Partial<EligibilityContext> & Pick<EligibilityContext, 'jurisdiction'>,
): EligibilityContext {
  return Object.freeze({
    actorClass: profile.actorClass,
    capabilities: extras.capabilities ?? [],
    jurisdiction: extras.jurisdiction,
    geography: extras.geography ?? null,
    machineId: profile.machineId,
    purpose: extras.purpose ?? null,
    recipientClass: extras.recipientClass ?? null,
    consentActive: extras.consentActive ?? false,
    consentRevoked: extras.consentRevoked ?? false,
    verifiedAccount: profile.verified,
    access: profile.access,
  });
}
