import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  DEFAULT_INFERENCE_RETRY_BUDGET,
  HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED,
  HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED,
  NATIVE11_SERIS_UPSTREAM,
} from './taxonomy.ts';

export type NativeAgentRuntimeQualificationReport = {
  readonly marker: typeof HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED | typeof HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED;
  readonly evaluatedAt: UtcInstant;
  readonly upstreamReferenceSha: string;
  readonly retryBudgetConfigured: boolean;
  readonly notes: readonly string[];
};

export function assessNativeAgentRuntimeQualification(now: UtcInstant): NativeAgentRuntimeQualificationReport {
  const notes: string[] = [];
  if (DEFAULT_INFERENCE_RETRY_BUDGET.maxAttempts < 1) {
    notes.push('retry budget must allow at least one inference attempt');
  }
  if (DEFAULT_INFERENCE_RETRY_BUDGET.maxRetryableFailures < 0) {
    notes.push('retry budget must not allow negative retryable failures');
  }
  if (!NATIVE11_SERIS_UPSTREAM.referenceSha) {
    notes.push('Seris upstream reference is missing');
  }

  const qualified = notes.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED : HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED,
    evaluatedAt: now,
    upstreamReferenceSha: NATIVE11_SERIS_UPSTREAM.referenceSha,
    retryBudgetConfigured: DEFAULT_INFERENCE_RETRY_BUDGET.maxAttempts >= 1,
    notes: Object.freeze(notes),
  });
}
