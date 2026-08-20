/**
 * Rehearsal fixtures for the SunRey issuance parameter package.
 * Labeled REHEARSAL_FIXTURE / NO_PRODUCTION_ECONOMIC_MEANING.
 */

import {
  rehearsalValuationPolicyCandidate,
  unconfiguredValuationPolicyCandidate,
} from '../../../../../human-economic-contribution/src/valuation/production-candidate/fixtures.ts';
import {
  rehearsalConversionPolicyCandidate,
  unconfiguredConversionPolicyCandidate,
} from '../../human-contribution-bridge/production-candidate/fixtures.ts';

import { bindExact, configuredNumeric, createSunReyProductionIssuanceParameterPackage } from './package.ts';
import { createPostGenesisIssuancePolicyCandidate } from './issuance-policy.ts';
import { NO_PRODUCTION_ECONOMIC_MEANING, REHEARSAL_FIXTURE, type SunReyProductionIssuanceParameterPackage } from './types.ts';

/** Fixture supplies. Not recommended tokenomics. */
export const FIXTURE_MAXIMUM_SUPPLY = 10_000n;
export const FIXTURE_GENESIS_SUPPLY = 100n;
export const FIXTURE_PER_PERIOD_CAP = 200n;
export const FIXTURE_PER_CLASS_CAP = 80n;
export const FIXTURE_GLOBAL_GUARD = 400n;

export const FIXTURE_LABEL = Object.freeze({
  kind: REHEARSAL_FIXTURE,
  economicMeaning: NO_PRODUCTION_ECONOMIC_MEANING,
});

export function unconfiguredSunReyIssuancePackage(): SunReyProductionIssuanceParameterPackage {
  return createSunReyProductionIssuanceParameterPackage({
    valuationPolicy: unconfiguredValuationPolicyCandidate(),
    contributionToSettlementConversion: unconfiguredConversionPolicyCandidate(),
    sourceClass: 'UNCONFIGURED',
    fixture: false,
  });
}

export function rehearsalSunReyIssuancePackage(): SunReyProductionIssuanceParameterPackage {
  return createSunReyProductionIssuanceParameterPackage({
    maximumSupply: configuredNumeric(FIXTURE_MAXIMUM_SUPPLY),
    genesisSupply: configuredNumeric(FIXTURE_GENESIS_SUPPLY),
    postGenesisIssuancePolicy: createPostGenesisIssuancePolicyCandidate(),
    contributionToSettlementConversion: rehearsalConversionPolicyCandidate(),
    valuationPolicy: rehearsalValuationPolicyCandidate(),
    perPeriodCaps: configuredNumeric(FIXTURE_PER_PERIOD_CAP),
    perClassCaps: configuredNumeric(FIXTURE_PER_CLASS_CAP),
    globalSupplyGuards: configuredNumeric(FIXTURE_GLOBAL_GUARD),
    genesisAllocationManifestRef: bindExact('GENESIS_ALLOCATION_MANIFEST', 'rehearsal.genesis.unconfigured'),
    feePolicyRef: bindExact('FEE_POLICY', 'rehearsal.fee.unconfigured'),
    burnPolicyRef: bindExact('BURN_POLICY', 'rehearsal.burn.unconfigured'),
    sourceClass: 'FIXTURE',
    fixture: true,
  });
}
