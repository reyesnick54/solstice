/**
 * HELIOS MD11 deterministic historical replay qualification harness.
 */

import { asUtcInstant } from '@solstice/domain';
import { MARKET_EVENT_INDEX_NAMES } from './indexes.ts';
import { loadMd11FixtureTape, MD11_FIXTURE_PARTITION } from './fixtures.ts';
import { createMarketReplayEngine, replayOrderingDiffersByMode } from './replay-engine.ts';
import { buildOhlcvBarsFromTrades, barRegistryBlocksSilentRewrite } from './bar-builder.ts';
import { createImmutableTickStore } from './tick-store.ts';
import {
  HELIOS_MD11,
  HELIOS_MD11_DETERMINISTIC_REPLAY_BLOCKED,
  HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED,
  MARKET_REPLAY_MODES,
} from './types.ts';

export type Md11QualificationCheck = Readonly<{
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
}>;

export type Md11QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED
    | typeof HELIOS_MD11_DETERMINISTIC_REPLAY_BLOCKED;
  readonly qualified: boolean;
  readonly checks: readonly Md11QualificationCheck[];
  readonly blockers: readonly string[];
}>;

const WINDOW_FROM = asUtcInstant('2026-06-02T14:00:00.000Z');
const WINDOW_TO = asUtcInstant('2026-06-02T14:00:10.000Z');

function check(id: string, passed: boolean, message: string): Md11QualificationCheck {
  return Object.freeze({ id, passed, message });
}

export function evaluateMd11DeterministicReplayQualification(): Md11QualificationResult {
  const checks: Md11QualificationCheck[] = [];
  const blockers: string[] = [];

  const { rawStore, normalizedStore, sessionManifest } = loadMd11FixtureTape();

  checks.push(
    check(
      'stores_both_raw_and_normalized',
      rawStore.list().length > 0 && normalizedStore.list().length > 0,
      'raw and normalized events are both retained',
    ),
  );

  checks.push(
    check(
      'never_bars_only',
      !createImmutableTickStore().retainsBarsOnly(),
      'tick store contract rejects bars-only retention',
    ),
  );

  const sample = rawStore.list()[0];
  if (sample) {
    for (const name of MARKET_EVENT_INDEX_NAMES) {
      const field =
        name === 'instrument'
          ? sample.index.instrument
          : name === 'venue'
            ? sample.index.venue
            : name === 'provider'
              ? sample.index.provider
              : name === 'exchangeTime'
                ? sample.index.exchangeTime
                : name === 'sunreyReceiveTime'
                  ? sample.index.sunreyReceiveTime
                  : name === 'knowableAt'
                    ? sample.index.knowableAt
                    : sample.index.sequence;
      const hasIndex = name === 'sequence' ? true : Boolean(field);
      checks.push(check(`index_${name}`, hasIndex, `index dimension ${name} populated`));
    }
  }

  const engine = createMarketReplayEngine(rawStore, normalizedStore);
  const replays = MARKET_REPLAY_MODES.map((mode) =>
    engine.replay({
      replayId: `qual_${mode}`,
      mode,
      partition: MD11_FIXTURE_PARTITION,
      windowFrom: WINDOW_FROM,
      windowTo: WINDOW_TO,
      sessionManifestIds: [sessionManifest.sessionId],
      checkpointEvery: 2,
      recordedAt: WINDOW_TO,
    }),
  );

  const arrival = replays.find((r) => r.manifest.mode === 'ARRIVAL_TIME')!;
  const source = replays.find((r) => r.manifest.mode === 'SOURCE_TIME')!;
  const lateBeforeEarlyOnArrival =
    arrival.entries.findIndex((e) => e.raw?.eventId === 'raw_md11_late') >
    arrival.entries.findIndex((e) => e.raw?.eventId === 'raw_md11_halt');
  checks.push(
    check(
      'arrival_time_orders_late_messages',
      lateBeforeEarlyOnArrival,
      'ARRIVAL_TIME places late message after earlier exchange-time halt',
    ),
  );
  checks.push(
    check(
      'source_arrival_differ_when_late',
      source.manifest.replayFingerprint !== arrival.manifest.replayFingerprint,
      'SOURCE_TIME and ARRIVAL_TIME fingerprints differ when late messages exist',
    ),
  );

  const features = {
    gap: arrival.entries.some((e) => e.raw?.rawKind === 'sequence_gap'),
    halt: arrival.entries.some((e) => e.raw?.rawKind === 'halt'),
    late: arrival.entries.some((e) => e.raw?.isLate),
    revision: arrival.entries.some((e) => e.raw?.isRevision),
    failure: arrival.entries.some((e) => e.raw?.providerFailure),
  };
  for (const [key, present] of Object.entries(features)) {
    checks.push(check(`replay_preserves_${key}`, present, `replay emits ${key} events`));
  }

  const repeatA = engine.replay({
    replayId: 'qual_repeat_det',
    mode: 'ARRIVAL_TIME',
    partition: MD11_FIXTURE_PARTITION,
    windowFrom: WINDOW_FROM,
    windowTo: WINDOW_TO,
    sessionManifestIds: [sessionManifest.sessionId],
    checkpointEvery: 2,
    recordedAt: WINDOW_TO,
  });
  const repeatB = engine.replay({
    replayId: 'qual_repeat_det',
    mode: 'ARRIVAL_TIME',
    partition: MD11_FIXTURE_PARTITION,
    windowFrom: WINDOW_FROM,
    windowTo: WINDOW_TO,
    sessionManifestIds: [sessionManifest.sessionId],
    checkpointEvery: 2,
    recordedAt: WINDOW_TO,
  });
  checks.push(
    check(
      'deterministic_replay',
      repeatA.manifest.replayFingerprint === repeatB.manifest.replayFingerprint,
      'identical replays produce identical fingerprints',
    ),
  );

  checks.push(
    check(
      'mode_ordering_diff_helper',
      replayOrderingDiffersByMode(rawStore, normalizedStore, MD11_FIXTURE_PARTITION, WINDOW_FROM, WINDOW_TO),
      'ordering helper detects SOURCE vs ARRIVAL divergence',
    ),
  );

  const tradeEvents = normalizedStore.list().filter((e) => e.heliosKind === 'trade');
  const firstBuild = buildOhlcvBarsFromTrades({ trades: tradeEvents });
  const secondBuild = buildOhlcvBarsFromTrades({
    trades: tradeEvents,
    barRegistry: firstBuild.registry,
  });
  checks.push(
    check(
      'bars_from_observations',
      firstBuild.bars.length > 0 && firstBuild.bars.every((b) => b.sourceObservationIds.length > 0),
      'OHLCV bars derived from underlying trade observations',
    ),
  );
  checks.push(
    check(
      'bar_builder_version_tracked',
      firstBuild.bars.every((b) => b.barBuilderVersion === firstBuild.barBuilderVersion),
      'bar builder version stamped on derived bars',
    ),
  );
  checks.push(
    check(
      'pinned_bars_not_silently_rewritten',
      barRegistryBlocksSilentRewrite(firstBuild.registry, secondBuild) && secondBuild.bars.length === 0,
      'revised bar construction does not rewrite pinned research bars',
    ),
  );

  checks.push(check('chunk_marker', HELIOS_MD11 === 'HELIOS_MD11_IMMUTABLE_TICK_STORE', 'MD11 chunk marker'));

  for (const row of checks) {
    if (!row.passed) blockers.push(`${row.id}: ${row.message}`);
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED
      : HELIOS_MD11_DETERMINISTIC_REPLAY_BLOCKED,
    qualified,
    checks: Object.freeze(checks),
    blockers: Object.freeze(blockers),
  });
}
