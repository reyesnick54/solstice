import type { FormalProfile, FormalProfileName } from './types.ts';

export const FORMAL_SMOKE_PROFILE: FormalProfile = Object.freeze({
  name: 'FORMAL_SMOKE',
  consensusValidators: 3,
  consensusMaxHeight: 1,
  consensusMaxRound: 1,
  byzantineValidators: 0,
  maxQuantity: 2,
  maxOrders: 1,
  maxPackets: 2,
  maxEpochs: 2,
});

export const FORMAL_EXTENDED_PROFILE: FormalProfile = Object.freeze({
  name: 'FORMAL_EXTENDED',
  consensusValidators: 4,
  consensusMaxHeight: 2,
  consensusMaxRound: 2,
  byzantineValidators: 1,
  maxQuantity: 3,
  maxOrders: 2,
  maxPackets: 3,
  maxEpochs: 3,
});

export function resolveFormalProfile(name?: string): FormalProfile {
  const resolved = (name ?? process.env.FORMAL_PROFILE ?? 'FORMAL_SMOKE') as FormalProfileName;
  if (resolved === 'FORMAL_EXTENDED') {
    return FORMAL_EXTENDED_PROFILE;
  }
  return FORMAL_SMOKE_PROFILE;
}
