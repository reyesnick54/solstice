import type { BytexStrategyLifecyclePhase } from './taxonomy.ts';
import type { BytexStrategyRuntimeState } from './types.ts';

export type BytexStrategyHooks = {
  readonly onStart?: (input: { readonly atNs: bigint }) => void;
  readonly onMarketData?: (input: { readonly atNs: bigint; readonly instrumentId: string; readonly payloadDigest: string }) => void;
  readonly onTimer?: (input: { readonly atNs: bigint; readonly timerName: string }) => void;
  readonly onStop?: (input: { readonly atNs: bigint }) => void;
};

export class BytexStrategyRuntime {
  private phase: BytexStrategyLifecyclePhase = 'REGISTERED';
  private lastEventSequence = 0;
  readonly strategyId: string;
  readonly capsuleContentHash: string;
  private readonly hooks: BytexStrategyHooks;

  constructor(strategyId: string, capsuleContentHash: string, hooks: BytexStrategyHooks = {}) {
    this.strategyId = strategyId;
    this.capsuleContentHash = capsuleContentHash;
    this.hooks = hooks;
  }

  state(): BytexStrategyRuntimeState {
    return Object.freeze({
      strategyId: this.strategyId,
      phase: this.phase,
      capsuleContentHash: this.capsuleContentHash,
      lastEventSequence: this.lastEventSequence,
    });
  }

  restore(state: BytexStrategyRuntimeState): void {
    this.phase = state.phase;
    this.lastEventSequence = state.lastEventSequence;
  }

  start(atNs: bigint): void {
    if (this.phase !== 'REGISTERED' && this.phase !== 'RESTORED') {
      return;
    }
    this.phase = 'STARTING';
    this.hooks.onStart?.({ atNs });
    this.phase = 'RUNNING';
  }

  notifyMarket(atNs: bigint, instrumentId: string, payloadDigest: string, engineSequence: number): void {
    if (this.phase !== 'RUNNING') {
      return;
    }
    this.lastEventSequence = engineSequence;
    this.hooks.onMarketData?.({ atNs, instrumentId, payloadDigest });
  }

  notifyTimer(atNs: bigint, timerName: string, engineSequence: number): void {
    if (this.phase !== 'RUNNING') {
      return;
    }
    this.lastEventSequence = engineSequence;
    this.hooks.onTimer?.({ atNs, timerName });
  }

  fault(atNs: bigint): void {
    this.phase = 'FAULTED';
    this.hooks.onStop?.({ atNs });
  }

  stop(atNs: bigint): void {
    if (this.phase === 'STOPPED') {
      return;
    }
    this.phase = 'STOPPED';
    this.hooks.onStop?.({ atNs });
  }

  save(): void {
    this.phase = 'SAVED';
  }

  markRestored(): void {
    this.phase = 'RESTORED';
  }
}
