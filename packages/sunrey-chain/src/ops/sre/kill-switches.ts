import { KILL_SWITCH_DOMAINS, type KillSwitchReference } from './types.ts';

const CATALOG: readonly KillSwitchReference[] = Object.freeze([
  {
    domain: 'PROVIDER',
    owner: 'packages/treasury + packages/sunrey-chain provider runtime',
    scopes: Object.freeze(['PROVIDER', 'RAIL', 'CORRIDOR']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'PAYMENTS',
    owner: 'packages/treasury',
    scopes: Object.freeze(['RAIL', 'CORRIDOR', 'SETTLEMENT_ACCOUNT', 'HALT_RESERVATIONS']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'FX',
    owner: 'packages/treasury',
    scopes: Object.freeze(['CURRENCY_ROUTE']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'CARDS',
    owner: 'packages/treasury provider/rail scopes (packages/cards has no local kill switch)',
    scopes: Object.freeze(['PROVIDER', 'RAIL']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'AGENT',
    owner: 'packages/sunrey-agent',
    scopes: Object.freeze(['ALL_AGENT_USAGE', 'MODEL', 'TOOL', 'FINANCIAL_PROPOSAL_TOOLS', 'JURISDICTION', 'SPECIFIC_AGENT']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'EXCHANGE_MARKET',
    owner: 'packages/sunrey-exchange',
    scopes: Object.freeze(['MARKET', 'ASSET', 'MARKET_FAMILY', 'ORDER_ENTRY', 'SETTLEMENT']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'WITHDRAWALS',
    owner: 'packages/custody + packages/sunrey-exchange',
    scopes: Object.freeze(['WITHDRAWAL_HALT', 'WITHDRAWAL']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
  {
    domain: 'DATA_MARKETPLACE',
    owner: 'packages/information-market',
    scopes: Object.freeze(['LICENSEE_CREDENTIAL']),
    globalDestructiveOff: false,
    controlRoomCanEngage: false,
  },
]);

export function killSwitchCatalog(): readonly KillSwitchReference[] {
  return CATALOG;
}

export function killSwitchFor(domain: KillSwitchReference['domain']): KillSwitchReference {
  const found = CATALOG.find((row) => row.domain === domain);
  if (!found) {
    throw new Error(`missing kill switch reference for ${domain}`);
  }
  return found;
}

export function globalKillSwitchExists(): false {
  return false;
}

export function controlRoomEngagesKillSwitches(): false {
  return false;
}

export function killSwitchCatalogComplete(): boolean {
  return CATALOG.length === KILL_SWITCH_DOMAINS.length && CATALOG.every((row) => row.globalDestructiveOff === false);
}
