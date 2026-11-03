import type { Clock } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { NativeToolPermissionDecision } from './permissions.ts';

export type NativeToolCallAuditRecord = {
  readonly auditId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly toolId: string;
  readonly operation: string;
  readonly permission: string;
  readonly outcome: NativeToolPermissionDecision['outcome'];
  readonly executed: boolean;
  readonly durationMs: number;
  readonly recordedAt: UtcInstant;
  readonly inputHash: string;
};

let auditSequence = 0;

export class NativeToolCallAuditTrail {
  private readonly records: NativeToolCallAuditRecord[] = [];
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  record(input: {
    readonly sessionId: string;
    readonly agentId: string;
    readonly ownerId: string;
    readonly toolId: string;
    readonly operation: string;
    readonly decision: NativeToolPermissionDecision;
    readonly executed: boolean;
    readonly durationMs: number;
    readonly inputHash: string;
  }): NativeToolCallAuditRecord {
    auditSequence += 1;
    const row = Object.freeze({
      auditId: `native_tool_audit_${auditSequence}`,
      sessionId: input.sessionId,
      agentId: input.agentId,
      ownerId: input.ownerId,
      toolId: input.toolId,
      operation: input.operation,
      permission: input.decision.permission,
      outcome: input.decision.outcome,
      executed: input.executed,
      durationMs: input.durationMs,
      recordedAt: this.clock.now(),
      inputHash: input.inputHash,
    });
    this.records.push(row);
    return row;
  }

  snapshot(): readonly NativeToolCallAuditRecord[] {
    return Object.freeze([...this.records]);
  }

  forSession(sessionId: string): readonly NativeToolCallAuditRecord[] {
    return Object.freeze(this.records.filter((row) => row.sessionId === sessionId));
  }
}
