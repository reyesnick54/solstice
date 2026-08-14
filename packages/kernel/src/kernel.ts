import { err, ok, type Result } from '@solstice/domain';
import type { ActionIntent } from './action-intent.ts';
import {
  assertKernelAuthorization,
  mintKernelAuthorization,
  type KernelAuthorization,
} from './authorization.ts';
import { actorMaySubmit } from './capabilities.ts';
import { screenAml } from './compliance/aml.ts';
import { screenSanctions, type SanctionsSubject } from './compliance/sanctions.ts';
import { canonicalJson, EvidenceVault, sha256Hex, type SealedEvidence } from './evidence.ts';
import { assertSimulationOnly } from './flags.ts';
import { evaluatePolicy } from './policy/evaluate.ts';
import { isPyrCapabilityEnabled } from './policy/pyr-registry.ts';
import {
  escalate,
  isAuthorizingPosture,
  wouldRelax,
  type Posture,
} from './posture.ts';
import { freezeProof, type Proof } from './proof.ts';
import { currencyHintForKind, productForKind } from './product.ts';

export type KernelRefusal = {
  readonly outcome: 'REFUSED';
  readonly posture: Posture;
  readonly proofs: readonly Proof[];
  readonly evidence: SealedEvidence;
  readonly reasons: readonly string[];
};

export type KernelPermit = {
  readonly outcome: 'AUTHORIZED';
  readonly authorization: KernelAuthorization;
  readonly posture: 'CLEAR' | 'REVIEW';
  readonly proofs: readonly Proof[];
  readonly evidence: SealedEvidence;
};

export type KernelScreened = {
  readonly outcome: 'SCREENED';
  readonly posture: 'CLEAR' | 'REVIEW';
  readonly proofs: readonly Proof[];
  readonly evidence: SealedEvidence;
  readonly intentId: ActionIntent['id'];
  readonly kind: ActionIntent['kind'];
};

export type KernelDecision = KernelPermit | KernelRefusal | KernelScreened;

const DEFERRED_AUTHORITY: ReadonlySet<ActionIntent['kind']> = new Set([
  'SEND_PAYMENT',
  'FX_CONVERT',
  'COMPENSATE_PAYMENT',
]);

export class PostureRelaxationError extends Error {
  readonly current: Posture;
  readonly incoming: Posture;
  readonly proofKind: string;

  constructor(current: Posture, incoming: Posture, proofKind: string) {
    super(
      `CRITICAL: proof ${proofKind} attempted to relax posture from ${current} to ${incoming}`,
    );
    this.name = 'PostureRelaxationError';
    this.current = current;
    this.incoming = incoming;
    this.proofKind = proofKind;
  }
}

export class ComplianceKernel {
  readonly vault: EvidenceVault;

  constructor(vault: EvidenceVault = new EvidenceVault()) {
    this.vault = vault;
  }

  evaluate(intent: ActionIntent): Result<KernelDecision, PostureRelaxationError> {
    assertSimulationOnly();

    const proofs: Proof[] = [];
    let posture: Posture = 'CLEAR';

    const apply = (proof: Proof): Result<void, PostureRelaxationError> => {
      if (wouldRelax(posture, proof.posture)) {
        // Incoming weaker than current is not applied — escalate() ignores it.
        // A proof that *assigns* a weaker value as the new current would be
        // critical. We detect assignment-style misuse by refusing any evaluator
        // that returns a posture we would have to step down to honour.
        // Honouring means replacing current; we never do that.
      }
      const next = escalate(posture, proof.posture);
      if (wouldRelax(posture, next)) {
        return err(new PostureRelaxationError(posture, next, proof.kind));
      }
      posture = next;
      proofs.push(freezeProof(proof));
      return ok(undefined);
    };

    const identity = identityProof(intent);
    const identityApplied = apply(identity);
    if (!identityApplied.ok) return identityApplied;

    const policy = policyProof(intent);
    const policyApplied = apply(policy);
    if (!policyApplied.ok) return policyApplied;

    const sanctions = sanctionsProof(intent);
    const sanctionsApplied = apply(sanctions);
    if (!sanctionsApplied.ok) return sanctionsApplied;

    const aml = amlProof(intent);
    const amlApplied = apply(aml);
    if (!amlApplied.ok) return amlApplied;

    const pyr = pyrRegistryProof(intent);
    const pyrApplied = apply(pyr);
    if (!pyrApplied.ok) return pyrApplied;

    if (!isAuthorizingPosture(posture)) {
      const evidence = this.vault.seal(
        {
          kind: 'kernel.refused',
          intentId: intent.id,
          actionKind: intent.kind,
          actorType: intent.actor.type,
          posture,
          proofs,
          idempotencyKey: intent.idempotencyKey,
        },
        intent.occurredAt,
      );
      return ok(
        Object.freeze({
          outcome: 'REFUSED',
          posture,
          proofs: Object.freeze(proofs.slice()),
          evidence,
          reasons: proofs.flatMap((proof) => proof.reasons),
        }),
      );
    }

    if (DEFERRED_AUTHORITY.has(intent.kind)) {
      const evidence = this.vault.seal(
        {
          kind: 'kernel.screened',
          intentId: intent.id,
          actionKind: intent.kind,
          actorType: intent.actor.type,
          posture,
          proofs,
          idempotencyKey: intent.idempotencyKey,
        },
        intent.occurredAt,
      );
      return ok(
        Object.freeze({
          outcome: 'SCREENED',
          posture,
          proofs: Object.freeze(proofs.slice()),
          evidence,
          intentId: intent.id,
          kind: intent.kind,
        }),
      );
    }

    const authority = freezeProof({
      kind: 'EXECUTION_AUTHORITY',
      posture,
      reasons: Object.freeze([`execution authority minted at posture ${posture}`]),
      evaluatedAt: intent.occurredAt,
    });
    const authorityApplied = apply(authority);
    if (!authorityApplied.ok) return authorityApplied;

    const evidence = this.vault.seal(
      {
        kind: 'kernel.authorized',
        intentId: intent.id,
        actionKind: intent.kind,
        actorType: intent.actor.type,
        posture,
        proofs,
        idempotencyKey: intent.idempotencyKey,
      },
      intent.occurredAt,
    );

    const authorization = mintKernelAuthorization({
      intentId: intent.id,
      kind: intent.kind,
      posture,
      issuedAt: intent.occurredAt,
      evidenceId: evidence.id,
      proofFingerprint: sha256Hex(canonicalJson(proofs)),
    });

    return ok(
      Object.freeze({
        outcome: 'AUTHORIZED',
        authorization,
        posture,
        proofs: Object.freeze(proofs.slice()),
        evidence,
      }),
    );
  }

  /**
   * Second Kernel gate for payments: mint Execution Authority only after
   * FX quote and route selection have been recorded. Cannot relax posture.
   */
  grantExecutionAuthority(
    intent: ActionIntent,
    screened: KernelScreened,
    context: { readonly routeFingerprint: string; readonly quoteFingerprint: string },
  ): Result<KernelPermit, PostureRelaxationError | { readonly code: 'POSTURE_NOT_AUTHORIZING' }> {
    if (screened.intentId !== intent.id || screened.kind !== intent.kind) {
      throw new Error('execution authority intent mismatch');
    }
    if (!isAuthorizingPosture(screened.posture)) {
      return err({ code: 'POSTURE_NOT_AUTHORIZING' });
    }

    let posture: Posture = screened.posture;
    const proofs = screened.proofs.slice();
    const authority = freezeProof({
      kind: 'EXECUTION_AUTHORITY',
      posture: screened.posture,
      reasons: Object.freeze([
        `execution authority minted at posture ${screened.posture}`,
        `route ${context.routeFingerprint}`,
        `quote ${context.quoteFingerprint}`,
      ]),
      evaluatedAt: intent.occurredAt,
      details: context,
    });
    if (wouldRelax(posture, authority.posture)) {
      return err(new PostureRelaxationError(posture, authority.posture, authority.kind));
    }
    posture = escalate(posture, authority.posture);
    if (!isAuthorizingPosture(posture)) {
      return err({ code: 'POSTURE_NOT_AUTHORIZING' });
    }
    proofs.push(authority);

    const evidence = this.vault.seal(
      {
        kind: 'kernel.execution_authority',
        intentId: intent.id,
        actionKind: intent.kind,
        posture,
        routeFingerprint: context.routeFingerprint,
        quoteFingerprint: context.quoteFingerprint,
        proofs,
      },
      intent.occurredAt,
    );

    const authorization = mintKernelAuthorization({
      intentId: intent.id,
      kind: intent.kind,
      posture,
      issuedAt: intent.occurredAt,
      evidenceId: evidence.id,
      proofFingerprint: sha256Hex(canonicalJson(proofs)),
    });

    return ok(
      Object.freeze({
        outcome: 'AUTHORIZED',
        authorization,
        posture,
        proofs: Object.freeze(proofs.slice()),
        evidence,
      }),
    );
  }
}

export function requireAuthorization(
  authorization: KernelAuthorization,
  kind: ActionIntent['kind'],
): void {
  assertKernelAuthorization(authorization, kind);
}

function identityProof(intent: ActionIntent): Proof {
  if (!actorMaySubmit(intent.actor.type, intent.kind)) {
    return freezeProof({
      kind: 'IDENTITY',
      posture: 'BLOCK',
      reasons: Object.freeze([
        `actor type ${intent.actor.type} has no capability for ${intent.kind}`,
      ]),
      evaluatedAt: intent.occurredAt,
      details: { actorType: intent.actor.type, kind: intent.kind },
    });
  }
  if (intent.actor.type === 'AGENT') {
    return freezeProof({
      kind: 'IDENTITY',
      posture: 'BLOCK',
      reasons: Object.freeze([
        'agent principals cannot submit state-changing intents; beneficiary changes are never an agent capability',
      ]),
      evaluatedAt: intent.occurredAt,
    });
  }
  return freezeProof({
    kind: 'IDENTITY',
    posture: 'CLEAR',
    reasons: Object.freeze([`actor ${intent.actor.type} is permitted to submit ${intent.kind}`]),
    evaluatedAt: intent.occurredAt,
  });
}

function policyProof(intent: ActionIntent): Proof {
  const dest = intent.destinationJurisdiction ?? intent.sourceJurisdiction;
  const product = productForKind(intent.kind, intent.sourceJurisdiction, dest);
  const decision = evaluatePolicy({
    action: intent.kind,
    product,
    sourceCountry: intent.sourceJurisdiction,
    destinationCountry: dest,
    currency: currencyHintForKind(intent.kind, intent.payload),
  });
  return freezeProof({
    kind: 'POLICY',
    posture: decision.allow ? 'CLEAR' : 'BLOCK',
    reasons: decision.reasons,
    evaluatedAt: intent.occurredAt,
    details: {
      packVersion: decision.packVersion,
      packJurisdiction: decision.packJurisdiction,
      matchedRuleIds: decision.matchedRuleIds,
      product,
    },
  });
}

function sanctionsProof(intent: ActionIntent): Proof {
  if (intent.kind !== 'SEND_PAYMENT' && intent.kind !== 'ADD_BENEFICIARY') {
    return freezeProof({
      kind: 'SANCTIONS',
      posture: 'CLEAR',
      reasons: Object.freeze(['sanctions screening not required for this action']),
      evaluatedAt: intent.occurredAt,
    });
  }

  const subjects: SanctionsSubject[] = [];
  if (intent.kind === 'SEND_PAYMENT') {
    const payload = intent.payload as {
      screening: {
        senderName: string;
        receiverName: string;
        beneficialOwnerName: string;
        destinationCountry: string;
      };
    };
    const dest = payload.screening.destinationCountry;
    subjects.push({
      role: 'SENDER',
      name: payload.screening.senderName,
      country: intent.sourceJurisdiction,
    });
    subjects.push({
      role: 'RECEIVER',
      name: payload.screening.receiverName,
      country: dest,
    });
    subjects.push({
      role: 'BENEFICIAL_OWNER',
      name: payload.screening.beneficialOwnerName,
      country: dest,
    });
    subjects.push({
      role: 'DESTINATION_COUNTRY',
      country: dest,
    });
  }
  if (intent.kind === 'ADD_BENEFICIARY') {
    const payload = intent.payload as { name: string; country: string };
    subjects.push({
      role: 'RECEIVER',
      name: payload.name,
      country: payload.country,
    });
    subjects.push({
      role: 'DESTINATION_COUNTRY',
      country: payload.country,
    });
  }

  const outcome = screenSanctions(subjects);
  const reasons =
    outcome.hits.length === 0
      ? ['sanctions stub: no list match (CLEAR)']
      : outcome.hits.map((hit) => `${hit.list} hit on ${hit.matchedOn} (${hit.subject.role})`);
  return freezeProof({
    kind: 'SANCTIONS',
    posture: outcome.outcome,
    reasons: Object.freeze(reasons),
    evaluatedAt: intent.occurredAt,
    details: { hits: outcome.hits, screened: outcome.screened },
  });
}

function pyrRegistryProof(intent: ActionIntent): Proof {
  if (intent.kind !== 'TRANSFER_PYR') {
    return freezeProof({
      kind: 'PYR_REGISTRY',
      posture: 'CLEAR',
      reasons: Object.freeze(['PYR registry does not gate this action as a customer transfer capability']),
      evaluatedAt: intent.occurredAt,
    });
  }
  const country = intent.sourceJurisdiction;
  const enabled = isPyrCapabilityEnabled(country, 'TRANSFER');
  if (!enabled) {
    return freezeProof({
      kind: 'PYR_REGISTRY',
      posture: 'BLOCK',
      reasons: Object.freeze([
        `PYR TRANSFER is disabled in ${country}: registry field is not CONFIRMED_BY_COUNSEL and PERMITTED`,
      ]),
      evaluatedAt: intent.occurredAt,
      details: { country, capability: 'TRANSFER', enabled: false },
    });
  }
  return freezeProof({
    kind: 'PYR_REGISTRY',
    posture: 'CLEAR',
    reasons: Object.freeze([`PYR TRANSFER is enabled in ${country} by a counsel-confirmed registry entry`]),
    evaluatedAt: intent.occurredAt,
  });
}

function amlProof(intent: ActionIntent): Proof {
  if (intent.kind !== 'SEND_PAYMENT') {
    return freezeProof({
      kind: 'AML',
      posture: 'CLEAR',
      reasons: Object.freeze(['AML screening not required for this action']),
      evaluatedAt: intent.occurredAt,
    });
  }
  const payload = intent.payload as {
    sourceCustomerId: string;
    instructedAmount: { minorUnits: bigint; currency: string };
    purpose: string;
  };
  const outcome = screenAml({
    customerId: String(payload.sourceCustomerId),
    amountMinorUnits: payload.instructedAmount.minorUnits,
    currency: payload.instructedAmount.currency,
    purpose: payload.purpose,
  });
  return freezeProof({
    kind: 'AML',
    posture: outcome.outcome,
    reasons: outcome.reasons,
    evaluatedAt: intent.occurredAt,
  });
}
