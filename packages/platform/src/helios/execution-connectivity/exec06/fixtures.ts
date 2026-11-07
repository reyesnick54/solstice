import { asCustomerId, asUtcInstant, type UtcInstant } from '@solstice/domain';
import { asDecisionValidityEnvelopeId } from '../../decision-validity/ids.ts';
import type { MarketState } from '../../multi-asset/market-state-types.ts';
import { equityTightSpreadMarketState, FIXTURE_NOW } from '../../multi-asset/m22/fixtures.ts';
import type {
  AlgorithmMarketContext,
  AuthorizedLimitConstraints,
  ExecutionParticipationLimits,
  ExecutionTimeHorizon,
  GovernedParentOrderAuthorization,
  RegisterParentOrderInput,
} from './types.ts';
import type { ExecutionAlgorithmKind } from './taxonomy.ts';

export const EXEC06_FIXTURE_NOW = FIXTURE_NOW;

function quote(minorUnits: string) {
  return Object.freeze({ minorUnits, currency: 'USD', scale: 2 });
}

export function exec06MarketState(now: UtcInstant = EXEC06_FIXTURE_NOW): MarketState {
  return equityTightSpreadMarketState(now);
}

export function exec06UntrustedMarketState(now: UtcInstant = EXEC06_FIXTURE_NOW): MarketState {
  return Object.freeze({
    ...exec06MarketState(now),
    dataQuality: Object.freeze({
      state: 'UNUSABLE',
      dimensions: Object.freeze({
        freshness: 'FAIL',
        completeness: 'FAIL',
        providerHealth: 'FAIL',
        entitlement: 'PASS',
        timestampConsistency: 'FAIL',
        spreadSanity: 'FAIL',
        corroboration: 'FAIL',
      }),
      flags: Object.freeze(['STALE_DATA']),
    }),
    freshness: 'STALE',
  });
}

export function baseExec06Authorization(now: UtcInstant, validUntil: UtcInstant): GovernedParentOrderAuthorization {
  return Object.freeze({
    envelopeId: asDecisionValidityEnvelopeId('dve_exec06_fixture'),
    authorityReference: 'auth_ref_exec06_fixture',
    validFrom: now,
    validUntil,
    grantsExecutionAuthority: false,
  });
}

export function baseExec06LimitConstraints(referenceMinor = 45_000n): AuthorizedLimitConstraints {
  return Object.freeze({
    minLimitPriceMinor: 44_500n,
    maxLimitPriceMinor: 45_500n,
    referenceArrivalPriceMinor: referenceMinor,
  });
}

export function baseExec06Participation(): ExecutionParticipationLimits {
  return Object.freeze({
    participationCapBps: 1_500,
    mandateParticipationCapBps: 1_200,
    riskParticipationCapBps: 1_000,
  });
}

export function baseExec06Horizon(now: UtcInstant, minutes = 5, intervalMs = 60_000): ExecutionTimeHorizon {
  const end = asUtcInstant(new Date(Date.parse(now) + minutes * 60_000).toISOString());
  return Object.freeze({
    startAt: now,
    endAt: end,
    sliceIntervalMs: intervalMs,
  });
}

export function registerParentFixture(
  overrides: Partial<RegisterParentOrderInput> & { readonly algorithmKind: ExecutionAlgorithmKind },
): RegisterParentOrderInput {
  const now = overrides.now ?? EXEC06_FIXTURE_NOW;
  const validUntil = asUtcInstant(new Date(Date.parse(now) + 3_600_000).toISOString());
  return Object.freeze({
    requestId: overrides.requestId ?? `req_exec06_${overrides.algorithmKind}`,
    now,
    customerId: overrides.customerId ?? asCustomerId('cust_exec06'),
    accountId: overrides.accountId ?? 'acct_exec06',
    instrumentId: overrides.instrumentId ?? 'SECURITY:US:SPY:ARCX',
    side: overrides.side ?? 'BUY',
    authorizedQuantityUnits: overrides.authorizedQuantityUnits ?? 500n,
    quantityScale: overrides.quantityScale ?? 0,
    currency: overrides.currency ?? 'USD',
    algorithmKind: overrides.algorithmKind,
    limitConstraints: overrides.limitConstraints ?? baseExec06LimitConstraints(),
    horizon: overrides.horizon ?? baseExec06Horizon(now),
    urgency: overrides.urgency ?? 'NORMAL',
    participation: overrides.participation ?? baseExec06Participation(),
    authorization: overrides.authorization ?? baseExec06Authorization(now, validUntil),
    maxAuthorizedNotionalMinor: overrides.maxAuthorizedNotionalMinor ?? 50_000_000n,
  });
}

export function algorithmMarketContext(
  overrides?: Partial<AlgorithmMarketContext> & { readonly now?: UtcInstant },
): AlgorithmMarketContext {
  const now = overrides?.now ?? EXEC06_FIXTURE_NOW;
  return Object.freeze({
    now,
    marketState: overrides?.marketState ?? exec06MarketState(now),
    authoritativeTrust: overrides?.authoritativeTrust ?? 'TRUSTED',
    intervalVolumeUnits: overrides?.intervalVolumeUnits ?? 10_000n,
    vwapProfileWeightsBps: overrides?.vwapProfileWeightsBps ?? Object.freeze([3000, 2500, 2000, 1500, 1000]),
  });
}

export function marketContextAt(now: UtcInstant, intervalVolumeUnits = 10_000n): AlgorithmMarketContext {
  return algorithmMarketContext({ now, intervalVolumeUnits });
}

export function quoteAt(minorUnits: string) {
  return quote(minorUnits);
}
