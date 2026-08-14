import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import type { Money } from '../../money/src/money.ts';
import type { IdentityFacts } from '../../identity/src/facts.ts';
import type { ActionIntent, PurposeCode } from '../../permissions/src/action-intent.ts';
import type { DecisionStatus, ProofEvaluation, ProofName } from '../../permissions/src/decision.ts';
import type { PolicyIdentityFacts } from './policy/facts.ts';
import type { PolicyEvaluationResult, PolicyPackId } from './policy/types.ts';

export type KernelActor = {
  readonly id: string;
  readonly capabilities: readonly string[];
};

export type KernelFacts = {
  readonly actor: KernelActor;
  readonly customer?: Customer;
  readonly legalEntity?: LegalEntity;
  readonly product?: Product;
  readonly jurisdiction?: Jurisdiction;
  readonly amount?: Money;
  readonly sourceAccount?: Account;
  readonly destinationAccount?: Account;
  readonly identity?: IdentityFacts;
  readonly policyIdentity?: PolicyIdentityFacts;
  readonly serviceLocation?: Jurisdiction;
  readonly transactionOrigin?: Jurisdiction;
  readonly transactionDestination?: Jurisdiction;
  readonly policyPin?: {
    readonly packId: PolicyPackId;
    readonly versionId: string;
  };
  readonly policyResult?: PolicyEvaluationResult;
};

export type ProofEvaluator = {
  readonly proof: ProofName;
  evaluate(intent: ActionIntent, facts: KernelFacts): ProofEvaluation;
};

function evalProof(
  proof: ProofName,
  status: DecisionStatus,
  reason: string,
): ProofEvaluation {
  return Object.freeze({ proof, status, reason });
}

const RISK_REVIEW_MINOR = 10_000_000n;
const RISK_BLOCK_MINOR = 100_000_000n;

export const identityProof: ProofEvaluator = {
  proof: 'IDENTITY',
  evaluate(intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    if (typeof intent.actorId !== 'string' || intent.actorId.length === 0) {
      return evalProof('IDENTITY', 'BLOCK', 'actor identity is missing');
    }
    if (facts.actor.id !== intent.actorId) {
      return evalProof('IDENTITY', 'BLOCK', 'actor fact does not match intent.actorId');
    }
    if (!facts.customer) {
      return evalProof('IDENTITY', 'BLOCK', 'customer identity is missing');
    }
    const identity = facts.identity;
    if (!identity || typeof identity.identityExists !== 'boolean') {
      const kyc = facts.customer.verification.kycState;
      return evalProof(
        'IDENTITY',
        'ALLOW',
        `actor and customer identities are present; KYC fact ${kyc} entered policy`,
      );
    }
    if (!identity.identityExists || identity.identityStatus === null) {
      return evalProof('IDENTITY', 'BLOCK', 'solstice identity does not exist');
    }
    if (identity.identityStatus === 'SUSPENDED' || identity.identityStatus === 'LOCKED' || identity.identityStatus === 'CLOSED') {
      return evalProof('IDENTITY', 'BLOCK', `identity status ${identity.identityStatus} is not usable`);
    }
    if (identity.identityStatus === 'PENDING') {
      return evalProof('IDENTITY', 'BLOCK', 'identity is pending activation');
    }
    if (!identity.authenticated || !identity.sessionValid) {
      return evalProof('IDENTITY', 'BLOCK', 'actor session is missing or invalid');
    }
    if (!identity.actorSubjectMatch) {
      return evalProof('IDENTITY', 'BLOCK', 'actor is not bound to the identity subject');
    }
    const kycNote = identity.kycFresh
      ? `kyc ${identity.kycState} v${String(identity.kycVersion)} fresh`
      : `kyc ${identity.kycState ?? 'absent'} not fresh`;
    return evalProof(
      'IDENTITY',
      'ALLOW',
      `identity ${identity.identityStatus}; session ${identity.authenticationAssurance}; ${kycNote}`,
    );
  },
};

export const authorityProof: ProofEvaluator = {
  proof: 'AUTHORITY',
  evaluate(intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    if (!facts.actor.capabilities.includes(intent.actionType)) {
      return evalProof(
        'AUTHORITY',
        'BLOCK',
        `actor lacks capability for ${intent.actionType}`,
      );
    }
    return evalProof('AUTHORITY', 'ALLOW', `actor is capable of ${intent.actionType}`);
  },
};

export const jurisdictionProof: ProofEvaluator = {
  proof: 'JURISDICTION',
  evaluate(_intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    const policy = facts.policyResult;
    if (policy) {
      const jurisdictionCodes = [
        'JURISDICTION_UNRESOLVED',
        'JURISDICTION_AMBIGUOUS',
        'POLICY_PACK_MISSING',
        'POLICY_VERSION_MISSING',
        'POLICY_VERSION_NOT_EFFECTIVE',
        'POLICY_VERSION_RETIRED',
      ];
      const hit = policy.reasonCodes.find((code) => jurisdictionCodes.includes(code));
      if (hit) {
        return evalProof('JURISDICTION', policy.decision, hit);
      }
      return evalProof(
        'JURISDICTION',
        'ALLOW',
        `jurisdiction pack ${policy.snapshot.packId ?? 'none'} version ${policy.snapshot.packVersion ?? 'none'}`,
      );
    }
    if (!facts.jurisdiction) {
      return evalProof('JURISDICTION', 'DEFER', 'jurisdiction is missing');
    }
    return evalProof('JURISDICTION', 'DEFER', 'policy engine result is required');
  },
};

export const complianceProof: ProofEvaluator = {
  proof: 'COMPLIANCE',
  evaluate(_intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    const policy = facts.policyResult;
    if (policy) {
      return evalProof(
        'COMPLIANCE',
        policy.decision,
        policy.reasonCodes.join(',') || 'policy engine decision',
      );
    }
    const customer = facts.customer;
    if (!customer) {
      return evalProof('COMPLIANCE', 'BLOCK', 'customer is required for compliance proof');
    }
    return evalProof('COMPLIANCE', 'DEFER', 'policy engine result is required');
  },
};

export const riskProof: ProofEvaluator = {
  proof: 'RISK',
  evaluate(_intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    if (!facts.amount) {
      return evalProof('RISK', 'ALLOW', 'no amount on this intent');
    }
    const units = facts.amount.minorUnits;
    if (units < 0n) {
      return evalProof('RISK', 'BLOCK', 'negative amounts are forbidden');
    }
    if (units > RISK_BLOCK_MINOR) {
      return evalProof('RISK', 'BLOCK', 'amount exceeds simulation hard limit');
    }
    if (units > RISK_REVIEW_MINOR) {
      return evalProof('RISK', 'REQUIRE_MANUAL_REVIEW', 'amount requires manual review');
    }
    return evalProof('RISK', 'ALLOW', 'amount is within simulation limits');
  },
};

const ALLOWED_PURPOSES = new Set<PurposeCode>([
  'CUSTOMER_ONBOARDING',
  'CUSTOMER_FUNDING',
  'CUSTOMER_WITHDRAWAL',
  'CUSTOMER_TRANSFER',
  'CUSTOMER_HOLD',
  'CUSTOMER_FEE',
  'CUSTOMER_REVERSAL',
  'CUSTOMER_INTEREST',
  'CUSTOMER_SETTLEMENT',
]);

export const purposeProof: ProofEvaluator = {
  proof: 'PURPOSE',
  evaluate(intent: ActionIntent, _facts: KernelFacts): ProofEvaluation {
    if (intent.purpose === 'PROHIBITED') {
      return evalProof('PURPOSE', 'BLOCK', 'purpose PROHIBITED is refused');
    }
    if (!ALLOWED_PURPOSES.has(intent.purpose)) {
      return evalProof('PURPOSE', 'BLOCK', `purpose ${String(intent.purpose)} is not permitted`);
    }
    return evalProof('PURPOSE', 'ALLOW', `purpose ${intent.purpose} is permitted`);
  },
};

export const DEFAULT_PROOFS: readonly ProofEvaluator[] = [
  identityProof,
  authorityProof,
  jurisdictionProof,
  complianceProof,
  riskProof,
  purposeProof,
];
