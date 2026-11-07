/**
 * MD05 simulation fixtures — no live vendor connectivity.
 */

import { asUtcInstant } from '@solstice/domain';
import type { FeedReplica, InboundMarketTick } from './types.ts';
import { HELIOS_MD05_SCHEMA } from './taxonomy.ts';

export const MD05_FIXTURE_FEED_ID = 'XNAS:SPY:CONSOLIDATED' as const;

export const MD05_FIXTURE_REPLICAS: readonly FeedReplica[] = Object.freeze([
  Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    replicaId: 'replica-primary-a',
    feedId: MD05_FIXTURE_FEED_ID,
    role: 'PRIMARY_A',
    providerId: 'vendor_alpha',
    venueId: 'XNYS',
    nativeFeedKey: 'alpha.spy.consolidated',
    health: 'ACTIVE',
    active: true,
  }),
  Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    replicaId: 'replica-primary-b',
    feedId: MD05_FIXTURE_FEED_ID,
    role: 'PRIMARY_B',
    providerId: 'vendor_beta',
    venueId: 'XNYS',
    nativeFeedKey: 'beta.spy.consolidated',
    health: 'ACTIVE',
    active: false,
  }),
  Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    replicaId: 'replica-sip',
    feedId: MD05_FIXTURE_FEED_ID,
    role: 'SIP_OR_CONSOLIDATED',
    providerId: 'sip_consolidated',
    venueId: 'XNYS',
    nativeFeedKey: 'sip.spy',
    health: 'ACTIVE',
    active: false,
  }),
]);

export function fixtureTick(input: Partial<InboundMarketTick> & Pick<InboundMarketTick, 'replicaId' | 'role' | 'providerId'>): InboundMarketTick {
  return Object.freeze({
    replicaId: input.replicaId,
    role: input.role,
    providerId: input.providerId,
    symbol: input.symbol ?? 'SPY',
    venueId: input.venueId ?? 'XNYS',
    currency: input.currency ?? 'USD',
    sourceTimestamp: input.sourceTimestamp ?? asUtcInstant('2026-09-16T14:30:00.000Z'),
    arrivalTimestamp: input.arrivalTimestamp ?? asUtcInstant('2026-09-16T14:30:00.050Z'),
    priceMinorUnits: input.priceMinorUnits ?? 450_25n,
    sizeMinorUnits: input.sizeMinorUnits ?? 100n,
    marketStatus: input.marketStatus ?? 'OPEN',
    nativeSequence: input.nativeSequence ?? '1001',
    nativeMessageId: input.nativeMessageId ?? 'msg-1001',
  });
}
