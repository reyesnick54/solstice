import { randomUUID } from 'node:crypto';

import { addMs, type Clock } from '../../config/src/clock.ts';
import { assertSimulationOnly } from '../../config/src/flags.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import {
  combineProofs,
  type AuthorizationDecision,
} from '../../permissions/src/decision.ts';
import {
  AUTHORITY_TTL_MS,
  AuthorityIssuer,
  type ExecutionAuthority,
} from '../../permissions/src/execution-authority.ts';
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
 * decision.
 */
export class ComplianceKernel {
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly clock: Clock;
  private readonly proofs: readonly ProofEvaluator[];

  constructor(
    issuer: AuthorityIssuer,
    evidence: EvidenceVault,
    clock: Clock,
    proofs: readonly ProofEvaluator[] = DEFAULT_PROOFS,
  ) {
    this.issuer = issuer;
    this.evidence = evidence;
    this.clock = clock;
    this.proofs = proofs;
  }

  submit(intent: ActionIntent, facts: KernelFacts): AuthorizationDecision {
    assertSimulationOnly();

    const evaluations = this.proofs.map((proof) => proof.evaluate(intent, facts));
    const status = combineProofs(evaluations);
    const decidedAt = this.clock.now();

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

    const record = this.evidence.seal('KERNEL_DECISION', {
      intentId: intent.id,
      actionType: intent.actionType,
      idempotencyKey: intent.idempotencyKey,
      status,
      proofs: evaluations,
      executionAuthorityId: executionAuthority?.authorityId ?? null,
      decidedAt,
    });

    return Object.freeze({
      status,
      intentId: intent.id,
      actionType: intent.actionType,
      proofs: Object.freeze(evaluations),
      executionAuthority,
      evidenceRecordId: record.evidenceId,
      decidedAt,
    });
  }
}

function scopedAccountId(intent: ActionIntent): string {
  const payload = intent.payload as Record<string, unknown>;
  if (typeof payload.accountId === 'string') {
    return payload.accountId;
  }
  if (typeof payload.sourceAccountId === 'string') {
    return payload.sourceAccountId;
  }
  return intent.id;
}
