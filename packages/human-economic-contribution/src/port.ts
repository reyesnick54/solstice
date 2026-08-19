import type { Result } from '../../domain/src/result.ts';
import type { ContributionId, SubjectRef } from './ids.ts';
import type { SettlementEligibilityState } from './taxonomy.ts';
import type { PolicyDecisionRef } from './ids.ts';
import type {
  ContributionFailure,
  ContributionQuery,
  ExecutionRefusal,
  HumanContributionEvent,
  HumanContributionRegistryAudit,
  HumanContributionRegistryRecord,
  MintRefusal,
  RecordContributionInput,
  RejectContributionInput,
  HumanContributionRegistrySnapshot,
  VerifiedContributionReference,
  VerifyContributionInput,
  ApplyVerificationDecisionInput,
} from './types.ts';
import type { HumanContributionVerificationDecision } from './verification/types.ts';

/**
 * Narrow interface other domains may use. Callers submit normalized
 * evidence references and read verified contribution references without
 * importing the in-memory store or query indexes.
 */
export type HumanContributionRegistryPort = {
  submit(input: RecordContributionInput): Result<HumanContributionRegistryRecord, ContributionFailure>;
  evaluateVerification(input: VerifyContributionInput): Result<HumanContributionVerificationDecision, ContributionFailure>;
  applyVerificationDecision(
    input: ApplyVerificationDecisionInput,
  ): Result<HumanContributionRegistryRecord, ContributionFailure>;
  verify(input: VerifyContributionInput): Result<HumanContributionRegistryRecord, ContributionFailure>;
  reject(input: RejectContributionInput): Result<HumanContributionRegistryRecord, ContributionFailure>;
  supersede(
    priorId: ContributionId,
    input: RecordContributionInput,
  ): Result<HumanContributionEvent, ContributionFailure>;
  correct(
    priorId: ContributionId,
    input: RecordContributionInput,
  ): Result<HumanContributionRegistryRecord, ContributionFailure>;
  get(contributionId: ContributionId): HumanContributionEvent | undefined;
  getRecord(contributionId: ContributionId): HumanContributionRegistryRecord | undefined;
  getVerifiedReference(contributionId: ContributionId): VerifiedContributionReference | undefined;
  listBySubject(subjectRef: SubjectRef): readonly HumanContributionEvent[];
  query(criteria: ContributionQuery): readonly HumanContributionRegistryRecord[];
  audit(): HumanContributionRegistryAudit;
  snapshot(): HumanContributionRegistrySnapshot;
  restore(snapshot: HumanContributionRegistrySnapshot): void;
  rebuildProjections(): void;
  clearProjections(): void;
  applySettlementEligibility(
    contributionId: ContributionId,
    eligibilityState: SettlementEligibilityState,
    policyDecisionRef: PolicyDecisionRef,
  ): Result<HumanContributionEvent, ContributionFailure>;
  authorizeExecution(event: HumanContributionEvent): ExecutionRefusal;
  authorizeMint(event: HumanContributionEvent): MintRefusal;
};
