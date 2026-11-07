/**
 * HELIOS MD09 qualification — multi-venue crypto real-time market fabric.
 */

import type { UtcInstant } from '@solstice/domain';
import { LIVE_TRADING_ENABLED } from '@solstice/config';
import { HELIOS_OS04_VENUE_IDS } from '@solstice/provider-sdk';
import { assertOs04VenueRegistryComplete } from '@solstice/external-data';
import { HELIOS_MD09_SCHEMA, MD09_MARKET_DATA_KINDS } from './taxonomy.ts';
import { Md09CryptoMarketFabric } from './fabric.ts';

export const HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED =
  'HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED' as const;
export const HELIOS_MD09_CRYPTO_MARKET_DATA_BLOCKED =
  'HELIOS_MD09_CRYPTO_MARKET_DATA_BLOCKED' as const;

export type Md09QualificationCheck = Readonly<{
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
}>;

export type Md09QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED
    | typeof HELIOS_MD09_CRYPTO_MARKET_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly checks: readonly Md09QualificationCheck[];
  readonly blockers: readonly string[];
}>;

export function runMd09CryptoMarketQualification(input: {
  readonly nowUtc: UtcInstant;
}): Md09QualificationResult {
  const fabric = new Md09CryptoMarketFabric();
  const snapshot = fabric.refresh(input.nowUtc);
  const checks: Md09QualificationCheck[] = [];

  checks.push({
    id: 'venue_registry_complete',
    passed: assertOs04VenueRegistryComplete(),
    message: 'all OS04 reference venues registered',
  });
  checks.push({
    id: 'all_reference_venues_ingested',
    passed: snapshot.venueSessions.length === HELIOS_OS04_VENUE_IDS.length,
    message: `sessions=${snapshot.venueSessions.length}`,
  });
  checks.push({
    id: 'no_execution_activation',
    passed:
      snapshot.grantsExecutionAuthority === false &&
      snapshot.liveExecutionEnabled === false &&
      LIVE_TRADING_ENABLED === false,
    message: 'research plane only',
  });
  checks.push({
    id: 'quote_normalization_present',
    passed: snapshot.observations.some((row) => row.kind === 'quote' && row.quote),
    message: 'normalized quotes emitted',
  });
  checks.push({
    id: 'l2_book_normalization_present',
    passed: snapshot.observations.some((row) => row.kind === 'l2_book' && row.l2Book),
    message: 'L2 book normalized',
  });
  checks.push({
    id: 'sequence_gap_detection',
    passed: snapshot.venueSessions.some((row) => row.sequenceIntegrity.gapDetected),
    message: 'sequence gap surfaced for monotonic venues',
  });
  checks.push({
    id: 'hyperliquid_no_forced_sequence',
    passed: snapshot.venueSessions
      .find((row) => row.venueId === 'hyperliquid')
      ?.observations.every((obs) => obs.synchronization.sequenceField === 'none') ?? false,
    message: 'Hyperliquid does not use forced sequence semantics',
  });
  checks.push({
    id: 'cross_venue_spread_computed',
    passed: snapshot.crossVenue.crossVenueSpread !== null,
    message: `spread=${snapshot.crossVenue.crossVenueSpread}`,
  });
  checks.push({
    id: 'executable_opportunity_not_claimed',
    passed: snapshot.crossVenue.executableOpportunity.claimed === false,
    message: snapshot.crossVenue.executableOpportunity.reason,
  });
  checks.push({
    id: 'derivatives_plane_present',
    passed: snapshot.observations.some(
      (row) => row.kind === 'funding' || row.kind === 'mark_price' || row.kind === 'index_price',
    ),
    message: 'funding/mark/index observations for supported venues',
  });
  checks.push({
    id: 'schema_version',
    passed: snapshot.observations.every((row) => row.schemaVersion === HELIOS_MD09_SCHEMA),
    message: HELIOS_MD09_SCHEMA,
  });
  checks.push({
    id: 'market_data_kind_taxonomy',
    passed: MD09_MARKET_DATA_KINDS.length >= 10,
    message: `${MD09_MARKET_DATA_KINDS.length} kinds declared`,
  });

  const blockers = checks.filter((row) => !row.passed).map((row) => `${row.id}: ${row.message}`);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED
      : HELIOS_MD09_CRYPTO_MARKET_DATA_BLOCKED,
    qualified,
    checks: Object.freeze(checks),
    blockers: Object.freeze(blockers),
  });
}
