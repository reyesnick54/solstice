import type { NativeAgentLoopStopReason } from './taxonomy.ts';

export type NativeAgentLoopLimits = {
  readonly maxTurns: number;
  readonly maxToolCallsPerTurn: number;
};

export const DEFAULT_NATIVE_AGENT_LOOP_LIMITS: NativeAgentLoopLimits = Object.freeze({
  maxTurns: 12,
  maxToolCallsPerTurn: 8,
});

export type NativeAgentLoopState = {
  readonly turn: number;
  readonly toolCallsThisTurn: number;
  readonly stopped: boolean;
  readonly stopReason: NativeAgentLoopStopReason | null;
  readonly cancelled: boolean;
};

export class BoundedNativeAgentLoop {
  private turn = 0;
  private toolCallsThisTurn = 0;
  private stopped = false;
  private stopReason: NativeAgentLoopStopReason | null = null;
  private cancelled = false;
  private readonly limits: NativeAgentLoopLimits;

  constructor(limits: NativeAgentLoopLimits = DEFAULT_NATIVE_AGENT_LOOP_LIMITS) {
    this.limits = limits;
  }

  cancel(): void {
    this.cancelled = true;
    this.stopped = true;
    this.stopReason = 'CANCELLED';
  }

  snapshot(): NativeAgentLoopState {
    return Object.freeze({
      turn: this.turn,
      toolCallsThisTurn: this.toolCallsThisTurn,
      stopped: this.stopped,
      stopReason: this.stopReason,
      cancelled: this.cancelled,
    });
  }

  beginTurn(): { readonly ok: true } | { readonly ok: false; readonly reason: NativeAgentLoopStopReason } {
    if (this.cancelled) {
      return { ok: false, reason: 'CANCELLED' };
    }
    if (this.stopped) {
      return { ok: false, reason: this.stopReason ?? 'COMPLETED' };
    }
    if (this.turn >= this.limits.maxTurns) {
      this.stopped = true;
      this.stopReason = 'TURN_LIMIT';
      return { ok: false, reason: 'TURN_LIMIT' };
    }
    this.turn += 1;
    this.toolCallsThisTurn = 0;
    return { ok: true };
  }

  recordToolCall(): { readonly ok: true } | { readonly ok: false; readonly reason: 'TOOL_LOOP' | 'CANCELLED' } {
    if (this.cancelled) {
      return { ok: false, reason: 'CANCELLED' };
    }
    this.toolCallsThisTurn += 1;
    if (this.toolCallsThisTurn > this.limits.maxToolCallsPerTurn) {
      this.stopped = true;
      this.stopReason = 'TOOL_LOOP';
      return { ok: false, reason: 'TOOL_LOOP' };
    }
    return { ok: true };
  }

  complete(): void {
    if (!this.stopped) {
      this.stopped = true;
      this.stopReason = 'COMPLETED';
    }
  }
}
