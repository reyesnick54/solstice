import type { Clock } from '../../../config/src/clock.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { ToolInvocationEvidence, ToolResultStatus, ToolSession } from './types.ts';

export class ToolEvidenceRecorder {
  private readonly vault: EvidenceVault;
  private readonly clock: Clock;

  constructor(vault: EvidenceVault, clock: Clock) {
    this.vault = vault;
    this.clock = clock;
  }

  seal(input: {
    readonly session: ToolSession;
    readonly toolId: string;
    readonly toolVersion: string;
    readonly inputHash: string;
    readonly redactedInput: Readonly<Record<string, unknown>>;
    readonly authorizationResult: string;
    readonly resultStatus: ToolResultStatus;
    readonly resultReference: string;
    readonly startedAt: ToolInvocationEvidence['startedAt'];
    readonly durationMs: number;
  }): ToolInvocationEvidence {
    const endedAt = this.clock.now();
    const payload = Object.freeze({
      agentId: input.session.agentId,
      ownerId: input.session.ownerId,
      conversationId: input.session.conversationId,
      turnId: input.session.turnId,
      toolId: input.toolId,
      toolVersion: input.toolVersion,
      inputHash: input.inputHash,
      redactedInput: input.redactedInput,
      authorizationResult: input.authorizationResult,
      resultStatus: input.resultStatus,
      resultReference: input.resultReference,
      startedAt: input.startedAt,
      endedAt,
      durationMs: input.durationMs,
      correlationId: input.session.correlationId,
    });
    const record = this.vault.seal('agent.tool.invocation', payload);
    return Object.freeze({
      evidenceId: record.evidenceId,
      ...payload,
    });
  }
}
