/**
 * Three ACCESS-15 economic modes.
 * Exchange/clearing remains responsible for TOKEN_ONLY and ACCESS_PLUS payment.
 */

import type { AccessEconomicMode } from './types.ts';

export type AccessModeDescriptor = {
  readonly mode: AccessEconomicMode;
  readonly description: string;
  readonly issuesIncludedAllocation: boolean;
  readonly permitsTokenTopUp: boolean;
  readonly convertsSrToMr: false;
};

export const ACCESS_ECONOMIC_MODE_DESCRIPTORS: Readonly<Record<AccessEconomicMode, AccessModeDescriptor>> =
  Object.freeze({
    INCLUDED_ACCESS: Object.freeze({
      mode: 'INCLUDED_ACCESS',
      description: 'Recurring allocation from the Access epoch based on token participation and verified capacity.',
      issuesIncludedAllocation: true,
      permitsTokenTopUp: false,
      convertsSrToMr: false,
    }),
    ACCESS_PLUS_TOKEN: Object.freeze({
      mode: 'ACCESS_PLUS_TOKEN',
      description:
        'Included Access allocation plus permitted SunRey or MoonRey consideration for a premium upgrade through canonical Exchange clearing.',
      issuesIncludedAllocation: true,
      permitsTokenTopUp: true,
      convertsSrToMr: false,
    }),
    TOKEN_ONLY_ACCESS: Object.freeze({
      mode: 'TOKEN_ONLY_ACCESS',
      description:
        'Additional capacity purchased through permitted SunRey, MoonRey, or fiat consideration after included Access is exhausted.',
      issuesIncludedAllocation: false,
      permitsTokenTopUp: true,
      convertsSrToMr: false,
    }),
  });

export function modeAllowsEpochAllocation(mode: AccessEconomicMode): boolean {
  return mode === 'INCLUDED_ACCESS' || mode === 'ACCESS_PLUS_TOKEN';
}
