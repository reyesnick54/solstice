import { randomUUID } from 'node:crypto';

import { addMs, type Clock } from '../../config/src/clock.ts';
import { assertSimulationOnly } from '../../config/src/flags.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import {
  combineProofs,
  type AuthorizationDecision,
  type PolicyDecisionRef,
} from '../../permissions/src/decision.ts';
import {
  AUTHORITY_TTL_MS,
  AuthorityIssuer,
  type ExecutionAuthority,
} from '../../permissions/src/execution-authority.ts';
import { createSimulationPolicyEngine, type PolicyEngine } from './policy/index.ts';
import { DEFAULT_PROOFS, type KernelFacts, type ProofEvaluator } from './proofs.ts';

/**
 * Compliance Kernel — the only component that DECIDES.
 *
 * AI or a service may PROPOSE (submit an ActionIntent). This kernel evaluates
 * the six proofs (Identity, Authority, Jurisdiction, Compliance, Risk, Purpose),
 * combines them with monotonic escalation, and on ALLOW signs a short-lived
 * scoped Execution Authority. Every outcome — approval AND refusal — seals
 * into the Evidence Vault.
 *
 * The kernel does not open accounts, post journals, or evaluate structural
 * well-formedness. Callers must not skip it and must not reinterpret its
 * decision. The policy engine extends this kernel; it is not a second kernel.
 */
export class ComplianceKernel {
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly clock: Clock;
  private readonly proofs: readonly ProofEvaluator[];
  readonly policy: PolicyEngine;

  constructor(
    issuer: AuthorityIssuer,
    evidence: EvidenceVault,
    clock: Clock,
    proofs: readonly ProofEvaluator[] = DEFAULT_PROOFS,
    policy: PolicyEngine = createSimulationPolicyEngine(),
  ) {
    this.issuer = issuer;
    this.evidence = evidence;
    this.clock = clock;
    this.proofs = proofs;
    this.policy = policy;
  }

  submit(intent: ActionIntent, facts: KernelFacts): AuthorizationDecision {
    assertSimulationOnly();

    const decidedAt = this.clock.now();
    const policyResult = this.policy.evaluate(intent, facts, decidedAt);
    const factsWithPolicy: KernelFacts = Object.freeze({
      ...facts,
      policyResult,
    });
    const evaluations = this.proofs.map((proof) => proof.evaluate(intent, factsWithPolicy));
    const status = combineProofs(evaluations);

    let executionAuthority: ExecutionAuthority | null = null;
    if (status === 'ALLOW') {
      const accountId = scopedAccountId(intent);
      const amount = facts.amount ?? null;
      executionAuthority = this.issuer.issue({
        authorityId: randomUUID(),
        actionType: intent.actionType,
        accountId,
        intentId: intent.id,
        idempotencyKey: intent.idempotencyKey,
        amount,
        issuedAt: decidedAt,
        expiresAt: addMs(decidedAt, AUTHORITY_TTL_MS),
      });
    }

    const policySnapshot = toPolicyRef(policyResult.snapshot);
    const record = this.evidence.seal('KERNEL_DECISION', {
      intentId: intent.id,
      actionType: intent.actionType,
      idempotencyKey: intent.idempotencyKey,
      status,
      proofs: evaluations,
      executionAuthorityId: executionAuthority?.authorityId ?? null,
      decidedAt,
      policy: {
        packId: policySnapshot.packId,
        packVersion: policySnapshot.packVersion,
        versionId: policySnapshot.versionId,
        packHash: policySnapshot.packHash,
        factsHash: policySnapshot.factsHash,
        evaluatedRuleIds: policySnapshot.evaluatedRuleIds,
        decision: policySnapshot.decision,
        reasonCodes: policySnapshot.reasonCodes,
        jurisdiction: policySnapshot.jurisdiction,
        legalConfidence: policySnapshot.legalConfidence,
        reviewId: policySnapshot.reviewId,
      },
    });

    return Object.freeze({
      status,
      intentId: intent.id,
      actionType: intent.actionType,
      proofs: Object.freeze(evaluations),
      executionAuthority,
      evidenceRecordId: record.evidenceId,
      decidedAt,
      policySnapshot,
    });
  }
}

function scopedAccountId(intent: ActionIntent): string {
  const payload = intent.payload as Record<string, unknown>;
  if (typeof payload.accountId === 'string') {
    return payload.accountId;
  }
  if (typeof payload.pendingAccountId === 'string') {
    return payload.pendingAccountId;
  }
  if (typeof payload.sourceAccountId === 'string') {
    return payload.sourceAccountId;
  }
  return intent.id;
}

function toPolicyRef(snapshot: {
  readonly packId: string | null;
  readonly packVersion: string | null;
  readonly versionId: string | null;
  readonly packHash: string | null;
  readonly factsHash: string;
  readonly evaluatedRuleIds: readonly string[];
  readonly decision: PolicyDecisionRef['decision'];
  readonly reasonCodes: readonly string[];
  readonly jurisdiction: string | null;
  readonly legalConfidence: string;
  readonly reviewId: string | null;
}): PolicyDecisionRef {
  return Object.freeze({
    packId: snapshot.packId,
    packVersion: snapshot.packVersion,
    versionId: snapshot.versionId,
    packHash: snapshot.packHash,
    factsHash: snapshot.factsHash,
    evaluatedRuleIds: snapshot.evaluatedRuleIds,
    decision: snapshot.decision,
    reasonCodes: snapshot.reasonCodes,
    jurisdiction: snapshot.jurisdiction,
    legalConfidence: snapshot.legalConfidence,
    reviewId: snapshot.reviewId,
  });
}
