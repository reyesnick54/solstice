/**
 * Embedded BYTEX reference vectors (from Bytex.Core.Tests.Timing.TestClockTests).
 * Source: vendor/assimilation/bytex @ 67b3e103 — specification only, no .NET invocation.
 */

import { BytexSimulationClock, unixNanosFromSeconds } from './clock.ts';

export const BYTEX_REFERENCE_SHA = '67b3e103043476a0490bb7afa146ec9ac339b116' as const;

export function runBytexReferenceClockScript(): readonly string[] {
  const clock = new BytexSimulationClock(unixNanosFromSeconds(0));
  clock.setTimer({ name: 't7', intervalMs: 7_000 });
  clock.setTimer({ name: 't3', intervalMs: 3_000, stopNs: unixNanosFromSeconds(12) });
  clock.setTimeAlert('a21', unixNanosFromSeconds(21));
  const log: string[] = [];
  for (const targetSec of [5, 14, 21, 30]) {
    for (const event of clock.advanceAndRun(unixNanosFromSeconds(targetSec))) {
      log.push(`${event.name}@${event.eventTimeNs / 1_000_000_000n}`);
    }
  }
  return Object.freeze(log);
}

export const BYTEX_REFERENCE_CLOCK_SCRIPT_EXPECTED = Object.freeze([
  't3@3',
  't3@6',
  't7@7',
  't3@9',
  't3@12',
  't7@14',
  't7@21',
  'a21@21',
  't7@28',
] as const);

export function runBytexInterleavedTimerSpec(): readonly string[] {
  const clock = new BytexSimulationClock(unixNanosFromSeconds(0));
  clock.setTimer({ name: 'every3', intervalMs: 3_000 });
  clock.setTimer({ name: 'every5', intervalMs: 5_000 });
  clock.setTimeAlert('at4', unixNanosFromSeconds(4));
  return clock.advanceAndRun(unixNanosFromSeconds(10)).map((e) => `${e.name}@${e.eventTimeNs / 1_000_000_000n}`);
}

export const BYTEX_INTERLEAVED_TIMER_EXPECTED = Object.freeze([
  'every3@3',
  'at4@4',
  'every5@5',
  'every3@6',
  'every3@9',
  'every5@10',
] as const);

export function runBytexSameTimestampRegistrationOrderSpec(): readonly string[] {
  const clock = new BytexSimulationClock(unixNanosFromSeconds(0));
  clock.setTimeAlert('b-set-first', unixNanosFromSeconds(10));
  clock.setTimer({ name: 'a-set-second', intervalMs: 10_000 });
  clock.setTimeAlert('c-set-third', unixNanosFromSeconds(10));
  return clock.advanceAndRun(unixNanosFromSeconds(10)).map((e) => e.name);
}

export const BYTEX_SAME_TIMESTAMP_ORDER_EXPECTED = Object.freeze(['b-set-first', 'a-set-second', 'c-set-third'] as const);
