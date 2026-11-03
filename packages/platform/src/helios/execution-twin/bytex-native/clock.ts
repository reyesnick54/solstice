/**
 * BYTEX TestClock / LiveClock parity layer (simulation clock is authoritative in backtest).
 * Behavior aligned with Bytex.Core.Timing.TestClock @ reference SHA 67b3e103.
 */

import type { BytexClockMode, BytexTimeEvent, BytexTimerHandler } from './types.ts';

const NS_PER_MS = 1_000_000n;

export function utcInstantToUnixNanos(iso: string): bigint {
  return BigInt(Date.parse(iso)) * 1_000_000n;
}

export function unixNanosFromSeconds(seconds: number | bigint): bigint {
  return BigInt(seconds) * 1_000_000_000n;
}

type TimerEntry = {
  readonly name: string;
  readonly intervalNs: bigint;
  readonly repeating: boolean;
  nextTimeNs: bigint;
  readonly stopNs: bigint | null;
  readonly callback: ((event: BytexTimeEvent) => void) | null;
  readonly sequence: number;
  expired: boolean;
};

export class BytexSimulationClock {
  private timestampNs: bigint;
  private readonly timers = new Map<string, TimerEntry>();
  private sequence = 0;
  private defaultHandler: ((event: BytexTimeEvent) => void) | null = null;

  constructor(initialNs: bigint = 0n) {
    this.timestampNs = initialNs;
  }

  get mode(): BytexClockMode {
    return 'SIMULATION';
  }

  nowNs(): bigint {
    return this.timestampNs;
  }

  setTime(ns: bigint): void {
    this.timestampNs = ns;
  }

  registerDefaultHandler(handler: (event: BytexTimeEvent) => void): void {
    this.defaultHandler = handler;
  }

  timerCount(): number {
    return this.timers.size;
  }

  timerNames(): readonly string[] {
    return Object.freeze([...this.timers.keys()].sort());
  }

  nextTime(name: string): bigint | null {
    const timer = this.timers.get(name);
    if (!timer || timer.expired) {
      return null;
    }
    return timer.nextTimeNs;
  }

  setTimeAlert(
    name: string,
    alertTimeNs: bigint,
    callback?: (event: BytexTimeEvent) => void,
    allowPast = true,
  ): void {
    if (!name.trim()) {
      throw new Error('timer name required');
    }
    if (!allowPast && alertTimeNs < this.timestampNs) {
      throw new Error(`alert time ${alertTimeNs} is in the past (now ${this.timestampNs})`);
    }
    this.timers.set(name, {
      name,
      intervalNs: 0n,
      repeating: false,
      nextTimeNs: alertTimeNs,
      stopNs: null,
      callback: callback ?? this.defaultHandler,
      sequence: this.sequence++,
      expired: false,
    });
  }

  setTimer(input: {
    readonly name: string;
    readonly intervalMs: number;
    readonly startNs?: bigint;
    readonly stopNs?: bigint;
    readonly callback?: (event: BytexTimeEvent) => void;
    readonly fireImmediately?: boolean;
  }): void {
    const name = input.name;
    if (!name.trim()) {
      throw new Error('timer name required');
    }
    if (input.intervalMs <= 0) {
      throw new Error('timer interval must be positive');
    }
    const intervalNs = BigInt(input.intervalMs) * NS_PER_MS;
    const startNs = input.startNs ?? this.timestampNs;
    const firstNs = input.fireImmediately ? startNs : startNs + intervalNs;
    this.timers.set(name, {
      name,
      intervalNs,
      repeating: true,
      nextTimeNs: firstNs,
      stopNs: input.stopNs ?? null,
      callback: input.callback ?? this.defaultHandler,
      sequence: this.sequence++,
      expired: false,
    });
  }

  cancelTimer(name: string): void {
    this.timers.delete(name);
  }

  cancelTimers(): void {
    this.timers.clear();
  }

  /**
   * Returns due timer handlers without invoking them (BYTEX AdvanceTime contract).
   */
  advanceTime(toNs: bigint, setTime = true): readonly BytexTimerHandler[] {
    if (toNs < this.timestampNs) {
      throw new Error(`cannot advance to ${toNs}, before current time ${this.timestampNs}`);
    }

    const due: BytexTimerHandler[] = [];
    if (this.timers.size > 0) {
      const entries = [...this.timers.values()];
      let progressed = true;
      while (progressed) {
        progressed = false;
        let next: TimerEntry | null = null;
        for (const timer of entries) {
          if (timer.expired || timer.nextTimeNs > toNs) {
            continue;
          }
          if (
            next === null ||
            timer.nextTimeNs < next.nextTimeNs ||
            (timer.nextTimeNs === next.nextTimeNs && timer.sequence < next.sequence)
          ) {
            next = timer;
          }
        }
        if (next === null) {
          break;
        }
        progressed = true;
        const eventTimeNs = next.nextTimeNs;
        const event: BytexTimeEvent = Object.freeze({ name: next.name, eventTimeNs });
        due.push(
          Object.freeze({
            event,
            handle: () => {
              next.callback?.(event);
            },
          }),
        );
        if (next.repeating) {
          next.nextTimeNs = eventTimeNs + next.intervalNs;
          if (next.stopNs !== null && next.nextTimeNs > next.stopNs) {
            next.expired = true;
          }
        } else {
          next.expired = true;
        }
      }
      for (const [name, timer] of this.timers) {
        if (timer.expired) {
          this.timers.delete(name);
        }
      }
    }

    if (setTime) {
      this.timestampNs = toNs;
    }
    return Object.freeze(due);
  }

  advanceAndRun(toNs: bigint): readonly BytexTimeEvent[] {
    const handlers = this.advanceTime(toNs, true);
    const fired: BytexTimeEvent[] = [];
    for (const handler of handlers) {
      handler.handle();
      fired.push(handler.event);
    }
    return Object.freeze(fired);
  }
}

/** Wall-clock facade: exposes the same IClock surface; defers timer delivery to host loop. */
export class BytexLiveClockFacade {
  readonly mode: BytexClockMode = 'LIVE';

  nowNs(): bigint {
    return utcInstantToUnixNanos(new Date().toISOString());
  }
}
