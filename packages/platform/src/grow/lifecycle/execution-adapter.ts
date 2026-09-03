import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { GrowExecutionCommand, GrowExecutionRecord, GrowFailure } from '../types.ts';
import type { ExecutionCapability } from './taxonomy.ts';

export type ExecutionPrepareResult =
  | { readonly ok: true; readonly command: GrowExecutionCommand; readonly capability: ExecutionCapability }
  | GrowFailure;

export type ExecutionValidateResult =
  | { readonly ok: true; readonly accepted: true }
  | { readonly ok: false; readonly accepted: false; readonly code: GrowFailure['code']; readonly message: string };

export type ExecutionSubmitResult =
  | {
      readonly ok: true;
      readonly providerTransactionId: string | null;
      readonly state: GrowExecutionRecord['state'];
      readonly metadata: Readonly<Record<string, string>>;
    }
  | GrowFailure;

export type ExecutionStatusResult = {
  readonly executionId: string;
  readonly state: GrowExecutionRecord['state'];
  readonly providerTransactionId: string | null;
  readonly filledMinorUnits: string;
  readonly requestedMinorUnits: string;
  readonly submittedIsNotCompleted: boolean;
  readonly providerConfirmed: boolean;
};

export type GrowExecutionAdapter = {
  readonly capability: ExecutionCapability;
  prepareExecution(command: GrowExecutionCommand): ExecutionPrepareResult;
  validateExecution(command: GrowExecutionCommand, now: UtcInstant): ExecutionValidateResult;
  submitExecution(
    command: GrowExecutionCommand,
    record: GrowExecutionRecord,
    now: UtcInstant,
  ): ExecutionSubmitResult | Promise<ExecutionSubmitResult>;
  getExecutionStatus(executionId: string): ExecutionStatusResult | GrowFailure;
  cancelIfSupported(executionId: string): { readonly cancelled: boolean; readonly reason: string };
  reconcile(
    executionId: string,
    providerOutcome: {
      readonly kind: 'FILL' | 'PARTIAL_FILL' | 'PENDING' | 'UNKNOWN' | 'REJECTION' | 'SETTLEMENT_FAILURE' | 'QUOTE_EXPIRED' | 'TIMEOUT';
      readonly providerTransactionId?: string;
      readonly filledMinorUnits?: string;
      readonly requestedMinorUnits: string;
    },
  ): GrowExecutionRecord['state'];
};

export class UnavailableGrowExecutionAdapter implements GrowExecutionAdapter {
  readonly capability = 'UNAVAILABLE' as const;

  prepareExecution(): ExecutionPrepareResult {
    return { code: 'PROVIDER_UNAVAILABLE', message: 'no regulated execution provider connected' };
  }

  validateExecution(): ExecutionValidateResult {
    return { ok: false, accepted: false, code: 'PROVIDER_UNAVAILABLE', message: 'execution unavailable' };
  }

  submitExecution(): ExecutionSubmitResult {
    return { code: 'PROVIDER_UNAVAILABLE', message: 'execution unavailable' };
  }

  getExecutionStatus(): GrowFailure {
    return { code: 'PROVIDER_UNAVAILABLE', message: 'execution unavailable' };
  }

  cancelIfSupported(): { readonly cancelled: boolean; readonly reason: string } {
    return { cancelled: false, reason: 'provider unavailable' };
  }

  reconcile(): GrowExecutionRecord['state'] {
    return 'FAILED';
  }
}

export class SimulationGrowExecutionAdapter implements GrowExecutionAdapter {
  readonly capability = 'SIMULATION_SANDBOX' as const;
  private readonly submissions = new Map<string, ExecutionStatusResult>();

  prepareExecution(command: GrowExecutionCommand): ExecutionPrepareResult {
    return { ok: true, command, capability: this.capability };
  }

  validateExecution(command: GrowExecutionCommand, now: UtcInstant): ExecutionValidateResult {
    if (command.expiresAt <= now) {
      return { ok: false, accepted: false, code: 'PROPOSAL_EXPIRED', message: 'command expired' };
    }
    return { ok: true, accepted: true };
  }

  submitExecution(
    command: GrowExecutionCommand,
    record: GrowExecutionRecord,
    _now: UtcInstant,
  ): ExecutionSubmitResult {
    const providerTransactionId = `sim_${command.commandId}`;
    const status: ExecutionStatusResult = Object.freeze({
      executionId: record.executionId,
      state: 'SUBMITTED',
      providerTransactionId,
      filledMinorUnits: '0',
      requestedMinorUnits: command.financialResource.amount.minorUnits,
      submittedIsNotCompleted: true,
      providerConfirmed: false,
    });
    this.submissions.set(record.executionId, status);
    return {
      ok: true,
      providerTransactionId,
      state: 'SUBMITTED',
      metadata: Object.freeze({ environment: 'simulation' }),
    };
  }

  getExecutionStatus(executionId: string): ExecutionStatusResult | GrowFailure {
    const row = this.submissions.get(executionId);
    if (!row) {
      return { code: 'PROPOSAL_NOT_FOUND', message: 'execution not found' };
    }
    return row;
  }

  cancelIfSupported(executionId: string): { readonly cancelled: boolean; readonly reason: string } {
    const row = this.submissions.get(executionId);
    if (!row || row.state === 'COMPLETED') {
      return { cancelled: false, reason: 'not cancellable' };
    }
    this.submissions.set(
      executionId,
      Object.freeze({ ...row, state: 'CANCELLED', submittedIsNotCompleted: false, providerConfirmed: false }),
    );
    return { cancelled: true, reason: 'sandbox cancellation accepted' };
  }

  reconcile(
    executionId: string,
    providerOutcome: {
      readonly kind: 'FILL' | 'PARTIAL_FILL' | 'PENDING' | 'UNKNOWN' | 'REJECTION' | 'SETTLEMENT_FAILURE' | 'QUOTE_EXPIRED' | 'TIMEOUT';
      readonly providerTransactionId?: string;
      readonly filledMinorUnits?: string;
      readonly requestedMinorUnits: string;
    },
  ): GrowExecutionRecord['state'] {
    const row = this.submissions.get(executionId);
    if (!row) {
      return 'FAILED';
    }
    switch (providerOutcome.kind) {
      case 'FILL':
        this.submissions.set(
          executionId,
          Object.freeze({
            ...row,
            state: 'COMPLETED',
            filledMinorUnits: providerOutcome.requestedMinorUnits,
            submittedIsNotCompleted: false,
            providerConfirmed: true,
          }),
        );
        return 'COMPLETED';
      case 'PARTIAL_FILL':
        this.submissions.set(
          executionId,
          Object.freeze({
            ...row,
            state: 'PARTIALLY_COMPLETED',
            filledMinorUnits: providerOutcome.filledMinorUnits ?? '0',
            submittedIsNotCompleted: true,
            providerConfirmed: true,
          }),
        );
        return 'PARTIALLY_COMPLETED';
      case 'PENDING':
        this.submissions.set(executionId, Object.freeze({ ...row, state: 'PROCESSING', submittedIsNotCompleted: true }));
        return 'PROCESSING';
      case 'TIMEOUT':
      case 'UNKNOWN':
        this.submissions.set(executionId, Object.freeze({ ...row, state: 'REQUIRES_REVIEW', submittedIsNotCompleted: true }));
        return 'REQUIRES_REVIEW';
      case 'REJECTION':
      case 'SETTLEMENT_FAILURE':
      case 'QUOTE_EXPIRED':
        this.submissions.set(executionId, Object.freeze({ ...row, state: 'FAILED', submittedIsNotCompleted: false }));
        return 'FAILED';
      default: {
        const exhaustive: never = providerOutcome.kind;
        return exhaustive;
      }
    }
  }
}

export function idempotentExecutionKey(proposalId: string, proposalVersion: number, clientKey: string): string {
  return `grow:${proposalId}:v${String(proposalVersion)}:${clientKey}`;
}
