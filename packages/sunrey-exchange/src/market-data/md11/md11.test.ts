/**
 * HELIOS MD11 — immutable tick store and deterministic historical replay.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import {
  HELIOS_MD11,
  HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED,
  createImmutableTickStore,
  createMarketReplayEngine,
  evaluateMd11DeterministicReplayQualification,
  loadMd11FixtureTape,
  MD11_FIXTURE_PARTITION,
  replayOrderingDiffersByMode,
} from './index.ts';

describe('HELIOS MD11 immutable tick store', () => {
  it('exports chunk marker HELIOS_MD11_IMMUTABLE_TICK_STORE', () => {
    assert.equal(HELIOS_MD11, 'HELIOS_MD11_IMMUTABLE_TICK_STORE');
  });

  it('stores raw and normalized pairs immutably', () => {
    const store = createImmutableTickStore();
    const tape = loadMd11FixtureTape();
    assert.equal(tape.rawStore.list().length, tape.normalizedStore.list().length);
    assert.equal(store.retainsBarsOnly(), false);
    for (const raw of tape.rawStore.list()) {
      assert.ok(tape.normalizedStore.getByRawEventId(raw.eventId));
    }
  });

  it('ARRIVAL_TIME replay ordering differs from SOURCE_TIME when late ticks exist', () => {
    const { rawStore, normalizedStore } = loadMd11FixtureTape();
    const from = asUtcInstant('2026-06-02T14:00:00.000Z');
    const to = asUtcInstant('2026-06-02T14:00:10.000Z');
    assert.ok(replayOrderingDiffersByMode(rawStore, normalizedStore, MD11_FIXTURE_PARTITION, from, to));
    const engine = createMarketReplayEngine(rawStore, normalizedStore);
    const arrival = engine.replay({
      replayId: 'test_arrival',
      mode: 'ARRIVAL_TIME',
      partition: MD11_FIXTURE_PARTITION,
      windowFrom: from,
      windowTo: to,
      sessionManifestIds: ['md11_fixture_session'],
      recordedAt: to,
    });
    const ids = arrival.entries.map((e) => e.raw?.eventId);
    assert.ok(ids.indexOf('raw_md11_late') > ids.indexOf('raw_md11_halt'));
  });

  it('HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED when harness passes', () => {
    const result = evaluateMd11DeterministicReplayQualification();
    assert.equal(result.marker, HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED, result.blockers.join('; '));
  });
});
