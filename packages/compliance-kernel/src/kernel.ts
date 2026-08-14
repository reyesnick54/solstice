import { randomUUID } from 'node:crypto';

import type { EvidenceVault } from '@solstice/evidence-vault';
import { assertSimulationOnly } from '@solstice/flags';
import {
  ActionType,
  AUTHORITY_TTL_MS,
  AuthorityIssuer,
  escalateAll,
  type LegacyActionIntent as ActionIntent,
  type AuthorizationDecision,
  type Clock,
  type OpenAccountPayload,
  type ProofEvaluation,
} from '@solstice/permissions';

import {
  authorityProof,
  complianceProof,
  createSubjectStore,
  identityProof,
  jurisdictionProof,
  purposeProof,
  riskProof,
  type SubjectRecord,
  type SubjectStore,
} from './subject.ts';

export interface ComplianceKernelPort {
  submit(intent: ActionIntent): AuthorizationDecision;
}

/**
 * Deterministic Compliance Kernel.
 *
 * AI or a service may propose an ActionIntent. This kernel evaluates the
 * six proofs, escalates monotonically, signs a short-lived Execution
 * Authority only on ALLOW, and seals every decision — approval and
 * refusal — in the Evidence Vault.
 *
 * The kernel does not create accounts, post to the ledger, or embed
 * jurisdiction-pack product rules (ADR-0006). Proofs evaluate registered
 * subject facts only.
 */
export class ComplianceKernel implements ComplianceKernelPort {
  readonly subjects: SubjectStore;
  private readonly decisionsByIntent = new Map<string, AuthorizationDecision>();
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly clock: Clock;

  constructor(
    issuer: AuthorityIssuer,
    evidence: EvidenceVault,
    clock: Clock,
    subjects?: SubjectStore,
  ) {
    this.issuer = issuer;
    this.evidence = evidence;
    this.clock = clock;
    this.subjects = subjects ?? createSubjectStore();
  }

  registerSubject(subject: SubjectRecord): void {
    this.subjects.register(subject);
  }

  submit(intent: ActionIntent): AuthorizationDecision {
    assertSimulationOnly();

    const existing = this.decisionsByIntent.get(intent.intentId);
    if (existing) {
      this.evidence.seal('KERNEL_DECISION_REPLAY', {
        intentId: intent.intentId,
        actionType: intent.actionType,
        status: existing.status,
        replay: true,
      });
      return existing;
    }

    const decision = this.evaluate(intent);
    this.decisionsByIntent.set(intent.intentId, decision);
    this.evidence.seal('KERNEL_DECISION', {
      intentId: decision.intentId,
      actionType: decision.actionType,
      status: decision.status,
      reason: decision.reason,
      proofs: decision.proofs,
      authorityId:
        decision.status === 'ALLOW' ? decision.executionAuthority.authorityId : null,
    });
    return decision;
  }

  private evaluate(intent: ActionIntent): AuthorizationDecision {
    const decidedAt = this.clock.now().toISOString();
    const subject = this.subjects.get(intent.actorId);
    const payload = isOpenAccountPayload(intent.payload) ? intent.payload : undefined;

    const proofs: ProofEvaluation[] = [
      { proof: 'IDENTITY', ...identityProof(subject) },
      { proof: 'AUTHORITY', ...authorityProof(subject, intent.actionType) },
      {
        proof: 'JURISDICTION',
        ...jurisdictionProof(subject, payload?.jurisdiction ?? ''),
      },
      { proof: 'COMPLIANCE', ...complianceProof(subject) },
      { proof: 'RISK', ...riskProof(subject) },
      {
        proof: 'PURPOSE',
        ...purposeProof(subject, payload?.purpose ?? '', intent.actionType),
      },
    ];

    if (intent.actionType !== ActionType.OPEN_ACCOUNT || !payload) {
      proofs.push({
        proof: 'PURPOSE',
        status: 'BLOCK',
        reason: `Purpose proof: unsupported actionType ${intent.actionType}`,
      });
    }

    const status = escalateAll(proofs.map((proof) => proof.status));
    const reason = proofs
      .filter((proof) => proof.status === status)
      .map((proof) => proof.reason)
      .join('; ');

    if (status !== 'ALLOW') {
      return Object.freeze({
        status,
        intentId: intent.intentId,
        actionType: intent.actionType,
        proofs: Object.freeze(proofs),
        reason,
        decidedAt,
      });
    }

    const now = this.clock.now();
    const executionAuthority = this.issuer.issue({
      authorityId: randomUUID(),
      actionType: intent.actionType,
      accountId: payload!.accountId,
      intentId: intent.intentId,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + AUTHORITY_TTL_MS).toISOString(),
    });

    return Object.freeze({
      status: 'ALLOW',
      intentId: intent.intentId,
      actionType: intent.actionType,
      proofs: Object.freeze(proofs),
      executionAuthority,
      reason,
      decidedAt,
    });
  }
}

function isOpenAccountPayload(value: unknown): value is OpenAccountPayload {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.accountId === 'string' &&
    typeof payload.ownerId === 'string' &&
    typeof payload.accountClass === 'string' &&
    typeof payload.productId === 'string' &&
    typeof payload.legalEntityId === 'string' &&
    typeof payload.jurisdiction === 'string' &&
    typeof payload.currency === 'string' &&
    typeof payload.purpose === 'string'
  );
}
