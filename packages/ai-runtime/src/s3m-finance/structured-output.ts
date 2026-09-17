import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { S3mReasoningNextState } from './taxonomy.ts';

export const S3M_FINANCE_REASONING_SCHEMA = 'S3M_FINANCE_REASONING' as const;
export type S3mFinanceReasoningSchema = typeof S3M_FINANCE_REASONING_SCHEMA;

export type S3mFinanceCandidateProposal = {
  readonly proposalId: string;
  readonly summary: string;
  readonly rationale: string;
  readonly executes: false;
  readonly selfAuthorizes: false;
};

export type S3mFinanceReasoningResult = {
  readonly schema: S3mFinanceReasoningSchema;
  readonly task: string;
  readonly contextVersion: string;
  readonly evidenceRefs: readonly string[];
  readonly analysisClasses: readonly string[];
  readonly hypotheses: readonly string[];
  readonly constraints: readonly string[];
  readonly candidateProposals: readonly S3mFinanceCandidateProposal[];
  readonly invalidatingConditions: readonly string[];
  readonly missingInformation: readonly string[];
  readonly recommendedNextState: S3mReasoningNextState;
  readonly grantsExecutionAuthority: false;
  readonly selfAuthorizes: false;
};

export type S3mStructuredOutputFailure = {
  readonly code: 'SCHEMA_MISMATCH' | 'SELF_AUTHORIZATION_FORBIDDEN' | 'EXECUTION_AUTHORITY_FORBIDDEN';
  readonly detail: string;
};

export function validateS3mFinanceReasoningResult(
  value: unknown,
): Result<S3mFinanceReasoningResult, S3mStructuredOutputFailure> {
  if (!value || typeof value !== 'object') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'reasoning result must be an object' });
  }
  const record = value as Record<string, unknown>;
  if (record.schema !== S3M_FINANCE_REASONING_SCHEMA) {
    return err({ code: 'SCHEMA_MISMATCH', detail: `expected schema ${S3M_FINANCE_REASONING_SCHEMA}` });
  }
  if (record.grantsExecutionAuthority === true || record.selfAuthorizes === true) {
    return err({ code: 'SELF_AUTHORIZATION_FORBIDDEN', detail: 'S3M output cannot self-authorize' });
  }
  const required = ['task', 'contextVersion', 'recommendedNextState'] as const;
  for (const key of required) {
    if (typeof record[key] !== 'string' || (record[key] as string).length === 0) {
      return err({ code: 'SCHEMA_MISMATCH', detail: `missing or invalid field: ${key}` });
    }
  }
  const proposals = Array.isArray(record.candidateProposals) ? record.candidateProposals : [];
  for (const proposal of proposals) {
    if (!proposal || typeof proposal !== 'object') {
      return err({ code: 'SCHEMA_MISMATCH', detail: 'invalid candidate proposal' });
    }
    const p = proposal as Record<string, unknown>;
    if (p.executes === true || p.selfAuthorizes === true) {
      return err({ code: 'EXECUTION_AUTHORITY_FORBIDDEN', detail: 'candidate proposal cannot execute or self-authorize' });
    }
  }
  return ok(
    Object.freeze({
      schema: S3M_FINANCE_REASONING_SCHEMA,
      task: record.task as string,
      contextVersion: record.contextVersion as string,
      evidenceRefs: Object.freeze(stringArray(record.evidenceRefs)),
      analysisClasses: Object.freeze(stringArray(record.analysisClasses)),
      hypotheses: Object.freeze(stringArray(record.hypotheses)),
      constraints: Object.freeze(stringArray(record.constraints)),
      candidateProposals: Object.freeze(
        proposals.map((p) => {
          const pr = p as Record<string, unknown>;
          return Object.freeze({
            proposalId: String(pr.proposalId ?? 'prop_unknown'),
            summary: String(pr.summary ?? ''),
            rationale: String(pr.rationale ?? ''),
            executes: false as const,
            selfAuthorizes: false as const,
          });
        }),
      ),
      invalidatingConditions: Object.freeze(stringArray(record.invalidatingConditions)),
      missingInformation: Object.freeze(stringArray(record.missingInformation)),
      recommendedNextState: record.recommendedNextState as S3mReasoningNextState,
      grantsExecutionAuthority: false as const,
      selfAuthorizes: false as const,
    }),
  );
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  return Object.freeze(value.filter((item): item is string => typeof item === 'string'));
}
