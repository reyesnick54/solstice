import { GROW_EXECUTION_AUTHORITIES, CUSTODY_OUTBOUND_AUTHORITIES } from './taxonomy.ts';
import type { CustodyMovementGrant, CustodyMovementIsolationResult, CustodyMovementRequest } from './types.ts';

function grantIncludes(grant: CustodyMovementGrant, authority: CustodyMovementGrant['grantedAuthorities'][number]): boolean {
  return grant.grantedAuthorities.includes(authority);
}

/** Structural invariant: TRADE mandate never bundles WITHDRAW or TRANSFER. */
export function tradeGrantImpliesWithdraw(grant: CustodyMovementGrant): boolean {
  const hasTrade = grantIncludes(grant, 'TRADE');
  const hasWithdraw = grantIncludes(grant, 'WITHDRAW');
  if (!hasTrade) {
    return false;
  }
  return hasWithdraw;
}

export function defaultGrowTradingAgentGrant(grantId: string): CustodyMovementGrant {
  return Object.freeze({
    grantId,
    actorKind: 'GROW_TRADING_AGENT',
    productScope: 'GROW',
    grantedAuthorities: Object.freeze([...GROW_EXECUTION_AUTHORITIES]),
  });
}

export function outboundAuthoritiesPresent(grant: CustodyMovementGrant): readonly (typeof CUSTODY_OUTBOUND_AUTHORITIES)[number][] {
  return Object.freeze(CUSTODY_OUTBOUND_AUTHORITIES.filter((row) => grantIncludes(grant, row)));
}

export function evaluateCustodyMovementIsolation(request: CustodyMovementRequest): CustodyMovementIsolationResult {
  const { authority, grant } = request;
  const reasonCodes: string[] = [];

  if (tradeGrantImpliesWithdraw(grant) && authority === 'WITHDRAW' && grantIncludes(grant, 'TRADE')) {
    reasonCodes.push('TRADE_BUNDLED_WITHDRAW_FORBIDDEN');
  }

  const explicitlyGranted = grantIncludes(grant, authority);
  if (!explicitlyGranted) {
    if (authority === 'WITHDRAW' || authority === 'TRANSFER') {
      reasonCodes.push('OUTBOUND_AUTHORITY_NOT_GRANTED');
    } else {
      reasonCodes.push('AUTHORITY_NOT_GRANTED');
    }
    return Object.freeze({
      decision: 'DENIED',
      authority,
      reasonCodes: Object.freeze(reasonCodes),
      tradeAuthorityImpliesWithdraw: false,
      postsCustodyMovement: false,
    });
  }

  if (grant.actorKind === 'GROW_TRADING_AGENT' && (authority === 'WITHDRAW' || authority === 'TRANSFER')) {
    reasonCodes.push('GROW_AGENT_CANNOT_HOLD_OUTBOUND_AUTHORITY');
    return Object.freeze({
      decision: 'DENIED',
      authority,
      reasonCodes: Object.freeze(reasonCodes),
      tradeAuthorityImpliesWithdraw: false,
      postsCustodyMovement: false,
    });
  }

  const postsCustodyMovement = authority === 'WITHDRAW' || authority === 'TRANSFER';
  return Object.freeze({
    decision: postsCustodyMovement ? 'PERMITTED' : 'PERMITTED',
    authority,
    reasonCodes: Object.freeze(['AUTHORITY_EXPLICITLY_GRANTED']),
    tradeAuthorityImpliesWithdraw: false,
    postsCustodyMovement,
  });
}

export function growAgentMayPrepareWithdrawalOnly(grant: CustodyMovementGrant): boolean {
  return grant.actorKind === 'GROW_TRADING_AGENT' && !grantIncludes(grant, 'WITHDRAW');
}
