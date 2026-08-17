export const EXCHANGE_KILL_SWITCH_SCOPES = [
  'MARKET',
  'ASSET',
  'MARKET_FAMILY',
  'ORDER_ENTRY',
  'SETTLEMENT',
  'WITHDRAWAL',
] as const;
export type ExchangeKillSwitchScope = (typeof EXCHANGE_KILL_SWITCH_SCOPES)[number];

export type ExchangeKillSwitch = {
  readonly scope: ExchangeKillSwitchScope;
  readonly targetId: string;
  readonly engaged: boolean;
  readonly actorKind: 'HUMAN' | 'SECURITY_AUTHORITY' | 'AI';
  readonly accepted: boolean;
  readonly reasonCodes: readonly string[];
};

export function engageExchangeKillSwitch(input: {
  readonly scope: ExchangeKillSwitchScope;
  readonly targetId: string;
  readonly actorKind: 'HUMAN' | 'SECURITY_AUTHORITY' | 'AI';
  readonly reason: string;
}): ExchangeKillSwitch {
  const authorized = input.actorKind === 'HUMAN' || input.actorKind === 'SECURITY_AUTHORITY';
  return Object.freeze({
    scope: input.scope,
    targetId: input.targetId,
    engaged: authorized,
    actorKind: input.actorKind,
    accepted: authorized,
    reasonCodes: Object.freeze(authorized ? [input.reason] : ['HUMAN_OR_SECURITY_AUTHORITY_REQUIRED']),
  });
}
