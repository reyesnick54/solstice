import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import type { Money } from '../../money/src/money.ts';
import type { IdentityFacts } from '../../identity/src/facts.ts';
import type { ActionIntent, PurposeCode } from '../../permissions/src/action-intent.ts';
import {
  DECISION_RANK,
  type DecisionStatus,
  type ProofEvaluation,
  type ProofName,
} from '../../permissions/src/decision.ts';
import type { ComplianceFacts } from './compliance/facts.ts';
import { escalateFromComplianceFacts, escalateFromFraudFacts } from './compliance/facts.ts';
import type { PolicyIdentityFacts } from './policy/facts.ts';
import type { PolicyEvaluationResult, PolicyPackId } from './policy/types.ts';

export type KernelActor = {
  readonly id: string;
  readonly capabilities: readonly string[];
};

/**
 * Facts the Kernel may consume. `identity` is either authoritative
 * IdentityFacts or the slimmer policy KYC projection used by pack tests.
 * `compliance` is produced by the screening/monitoring fabric — never by
 * a provider score and never by an AI agent.
 */
export type KernelFacts = {
  readonly actor: KernelActor;
  readonly customer?: Customer;
  readonly legalEntity?: LegalEntity;
  readonly product?: Product;
  readonly jurisdiction?: Jurisdiction;
  readonly amount?: Money;
  readonly sourceAccount?: Account;
  readonly destinationAccount?: Account;
  readonly identity?: IdentityFacts | PolicyIdentityFacts;
  readonly policyIdentity?: PolicyIdentityFacts;
  readonly serviceLocation?: Jurisdiction;
  readonly transactionOrigin?: Jurisdiction;
  readonly transactionDestination?: Jurisdiction;
  readonly policyPin?: {
    readonly packId: PolicyPackId;
    readonly versionId: string;
  };
  readonly policyResult?: PolicyEvaluationResult;
  readonly compliance?: ComplianceFacts;
  readonly screening?: {
    readonly sanctionsHit: boolean;
    readonly pepHit: boolean;
    readonly fraudHold: boolean;
    readonly screeningRef: string;
  };
  readonly corridorId?: string;
  readonly corridorSimulationEnabled?: boolean;
  readonly beneficiaryStatus?: string;
  readonly investmentRisk?: {
    readonly assessmentId: string;
    readonly outcome: 'ALLOW_SIMULATION' | 'REQUIRE_REVIEW' | 'BLOCK' | 'INSUFFICIENT_DATA';
    readonly triggeredLimitIds: readonly string[];
    readonly modelId: string;
    readonly modelVersion: string;
    readonly generatedAt: string;
  };
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

export function isIdentityFacts(value: KernelFacts['identity']): value is IdentityFacts {
  return value !== undefined && 'identityExists' in value;
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
    const identity = isIdentityFacts(facts.identity) ? facts.identity : undefined;
    if (identity) {
      if (!identity.identityExists || identity.identityStatus === null) {
        return evalProof('IDENTITY', 'BLOCK', 'solstice identity does not exist');
      }
      if (
        identity.identityStatus === 'SUSPENDED' ||
        identity.identityStatus === 'LOCKED' ||
        identity.identityStatus === 'CLOSED'
      ) {
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
    }
    const kyc =
      facts.identity && 'kycState' in facts.identity
        ? facts.identity.kycState
        : facts.customer.verification.kycState;
    return evalProof(
      'IDENTITY',
      'ALLOW',
      `actor and customer identities are present; KYC fact ${kyc} entered policy`,
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
    let status: DecisionStatus = policy?.decision ?? 'DEFER';
    let reason = policy?.reasonCodes.join(',') || 'policy engine result is required';
    if (!policy) {
      if (!facts.customer) {
        return evalProof('COMPLIANCE', 'BLOCK', 'customer is required for compliance proof');
      }
      status = 'DEFER';
      reason = 'policy engine result is required';
    }
    if (facts.compliance) {
      const escalated = escalateFromComplianceFacts(status, facts.compliance);
      if (DECISION_RANK[escalated.status] > DECISION_RANK[status]) {
        status = escalated.status;
      }
      reason = [reason, escalated.reason].filter((part) => part.length > 0).join('; ');
    }
    return evalProof('COMPLIANCE', status, reason);
  },
};

export const riskProof: ProofEvaluator = {
  proof: 'RISK',
  evaluate(_intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    let status: DecisionStatus = 'ALLOW';
    let reason = 'no amount on this intent';
    if (facts.amount) {
      const units = facts.amount.minorUnits;
      if (units < 0n) {
        return evalProof('RISK', 'BLOCK', 'negative amounts are forbidden');
      }
      if (units > RISK_BLOCK_MINOR) {
        status = 'BLOCK';
        reason = 'amount exceeds simulation hard limit';
      } else if (units > RISK_REVIEW_MINOR) {
        status = 'REQUIRE_MANUAL_REVIEW';
        reason = 'amount requires manual review';
      } else {
        status = 'ALLOW';
        reason = 'amount is within simulation limits';
      }
    }
    if (facts.compliance) {
      const escalated = escalateFromFraudFacts(status, facts.compliance);
      if (DECISION_RANK[escalated.status] > DECISION_RANK[status]) {
        status = escalated.status;
      }
      reason = [reason, escalated.reason].filter((part) => part.length > 0).join('; ');
    }
    if (facts.investmentRisk) {
      const mapped =
        facts.investmentRisk.outcome === 'BLOCK'
          ? 'BLOCK'
          : facts.investmentRisk.outcome === 'INSUFFICIENT_DATA'
            ? 'DEFER'
            : facts.investmentRisk.outcome === 'REQUIRE_REVIEW'
              ? 'REQUIRE_MANUAL_REVIEW'
              : 'ALLOW';
      if (DECISION_RANK[mapped] > DECISION_RANK[status]) {
        status = mapped;
      }
      reason = [
        reason,
        `investment risk ${facts.investmentRisk.outcome} assessment ${facts.investmentRisk.assessmentId}`,
      ]
        .filter((part) => part.length > 0)
        .join('; ');
    }
    return evalProof('RISK', status, reason);
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
  'CUSTOMER_CROSS_BORDER_PAYMENT',
  'CUSTOMER_FX',
  'CUSTOMER_CARD',
  'CARD_NETWORK',
  'CUSTOMER_WALLET',
  'MERCHANT_ACCEPTANCE',
  'TREASURY_OPERATIONS',
  'CUSTOMER_INVESTMENT',
  'CUSTOMER_DIGITAL_ASSET',
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
