import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import type { Money } from '../../money/src/money.ts';
import type { ActionIntent, PurposeCode } from '../../permissions/src/action-intent.ts';
import type { DecisionStatus, ProofEvaluation, ProofName } from '../../permissions/src/decision.ts';

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

const SIMULATION_JURISDICTIONS = new Set(['US', 'GB', 'DE', 'FR', 'IE', 'AE', 'SA', 'AU', 'CA']);

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
    return evalProof('IDENTITY', 'ALLOW', 'actor and customer identities are present');
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
    if (!facts.jurisdiction) {
      return evalProof('JURISDICTION', 'BLOCK', 'jurisdiction is missing');
    }
    if (!SIMULATION_JURISDICTIONS.has(facts.jurisdiction)) {
      return evalProof('JURISDICTION', 'BLOCK', `jurisdiction ${facts.jurisdiction} is not enabled`);
    }
    if (facts.legalEntity && facts.legalEntity.jurisdiction !== facts.jurisdiction) {
      return evalProof(
        'JURISDICTION',
        'BLOCK',
        'intent jurisdiction does not match legal entity',
      );
    }
    if (facts.customer && facts.customer.jurisdiction !== facts.jurisdiction) {
      return evalProof(
        'JURISDICTION',
        'BLOCK',
        'intent jurisdiction does not match customer',
      );
    }
    if (facts.product && facts.product.jurisdiction !== facts.jurisdiction) {
      return evalProof(
        'JURISDICTION',
        'BLOCK',
        'intent jurisdiction does not match product',
      );
    }
    return evalProof('JURISDICTION', 'ALLOW', `jurisdiction ${facts.jurisdiction} is permitted`);
  },
};

export const complianceProof: ProofEvaluator = {
  proof: 'COMPLIANCE',
  evaluate(_intent: ActionIntent, facts: KernelFacts): ProofEvaluation {
    const customer = facts.customer;
    if (!customer) {
      return evalProof('COMPLIANCE', 'BLOCK', 'customer is required for compliance proof');
    }
    if (customer.status === 'CLOSED' || customer.status === 'SUSPENDED') {
      return evalProof('COMPLIANCE', 'BLOCK', `customer status ${customer.status} forbids the action`);
    }
    if (customer.status === 'PROSPECT') {
      return evalProof('COMPLIANCE', 'BLOCK', 'prospect customers may not open accounts or move money');
    }
    if (customer.status === 'PENDING_VERIFICATION') {
      return evalProof(
        'COMPLIANCE',
        'REQUIRE_MANUAL_REVIEW',
        'customer verification is still pending',
      );
    }
    if (customer.verification.kycState === 'FAILED' || customer.verification.kycState === 'EXPIRED') {
      return evalProof('COMPLIANCE', 'BLOCK', `KYC state ${customer.verification.kycState}`);
    }
    if (customer.status !== 'ACTIVE') {
      return evalProof('COMPLIANCE', 'BLOCK', `customer status ${customer.status} is not ACTIVE`);
    }
    return evalProof('COMPLIANCE', 'ALLOW', 'customer is ACTIVE');
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
