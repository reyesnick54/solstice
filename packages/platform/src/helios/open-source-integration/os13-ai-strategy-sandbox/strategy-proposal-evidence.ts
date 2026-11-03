import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type {
  BacktestRun,
  PromotionCapsule,
  StrategyValidationReport,
  WalkForwardRun,
} from '@solstice/strategy-lab';
import { STRATEGY_PROPOSAL_EVIDENCE_KIND } from './taxonomy.ts';
import type { StrategyProposal } from './strategy-proposal.ts';
import type { StrategyProposalValidationResult } from './strategy-proposal-validator.ts';

export type SandboxEvaluationMetrics = {
  readonly coverageReportPresent: boolean;
  readonly regimeBreakdownPresent: boolean;
  readonly turnoverMinor: bigint;
  readonly maxDrawdownBps: number;
  readonly stabilityScore: number;
  readonly holdoutReturnUnits: bigint;
  readonly trainReturnUnits: bigint;
  readonly walkForwardFoldCount: number;
  readonly explicitCostsApplied: boolean;
  readonly slippageNamed: boolean;
  readonly promoteOnReturnOnly: false;
};

export type StrategyProposalEvidenceRecord = {
  readonly evidenceKind: typeof STRATEGY_PROPOSAL_EVIDENCE_KIND;
  readonly proposalId: string;
  readonly materialHash: string;
  readonly validation: StrategyProposalValidationResult;
  readonly capsuleFingerprint: string | null;
  readonly validationReportId: string | null;
  readonly metrics: SandboxEvaluationMetrics | null;
  readonly sealedAt: UtcInstant;
  readonly evidenceHash: string;
  readonly deployAuthorized: false;
  readonly humanPromotionRequired: true;
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export function buildStrategyProposalEvidence(input: {
  readonly proposal: StrategyProposal;
  readonly validation: StrategyProposalValidationResult;
  readonly capsule?: PromotionCapsule | null;
  readonly validationReport?: StrategyValidationReport | null;
  readonly train?: BacktestRun | null;
  readonly validationRun?: BacktestRun | null;
  readonly holdout?: BacktestRun | null;
  readonly walkForward?: WalkForwardRun | null;
  readonly metrics?: SandboxEvaluationMetrics | null;
  readonly sealedAt: UtcInstant;
}): StrategyProposalEvidenceRecord {
  const body = {
    proposalId: input.proposal.proposalId,
    materialHash: input.proposal.materialHash,
    validation: input.validation,
    capsuleFingerprint: input.capsule?.fingerprint ?? null,
    validationReportId: input.validationReport?.validationId ?? null,
    metrics: input.metrics ?? null,
    trainHash: input.train?.outputHash ?? null,
    validationHash: input.validationRun?.outputHash ?? null,
    holdoutHash: input.holdout?.outputHash ?? null,
    walkForwardId: input.walkForward?.runId ?? null,
    deployAuthorized: false as const,
    humanPromotionRequired: true as const,
  };
  const evidenceHash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  return Object.freeze({
    evidenceKind: STRATEGY_PROPOSAL_EVIDENCE_KIND,
    proposalId: input.proposal.proposalId,
    materialHash: input.proposal.materialHash,
    validation: input.validation,
    capsuleFingerprint: input.capsule?.fingerprint ?? null,
    validationReportId: input.validationReport?.validationId ?? null,
    metrics: input.metrics ?? null,
    sealedAt: input.sealedAt,
    evidenceHash,
    deployAuthorized: false,
    humanPromotionRequired: true,
  });
}

export function sealStrategyProposalEvidence(
  vault: EvidenceVault | undefined,
  record: StrategyProposalEvidenceRecord,
): void {
  vault?.seal(record.evidenceKind, {
    ...record,
    metrics: record.metrics
      ? {
          ...record.metrics,
          turnoverMinor: record.metrics.turnoverMinor.toString(),
          maxDrawdownBps: record.metrics.maxDrawdownBps,
        }
      : null,
  });
}
