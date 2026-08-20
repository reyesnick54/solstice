/**
 * Payments ask the operating-scope / Kernel fact. They do not hard-code
 * country law. Provider health is not legal eligibility.
 */

import type { OperatingScopeFact } from '../../kernel/src/policy/operating-scope-fact.ts';
import { findCorridor, type PaymentCorridor } from './corridor.ts';

export function corridorLiveFromOperatingScope(
  corridorId: string,
  fact: OperatingScopeFact | undefined,
): {
  readonly corridor: PaymentCorridor | undefined;
  readonly liveEnabled: false;
  readonly policyStatus: 'RESEARCH_REQUIRED';
  readonly reasonCodes: readonly string[];
} {
  const corridor = findCorridor(corridorId);
  const reasonCodes = fact?.reasonCodes ?? ['CORRIDOR_DISABLED'];
  return Object.freeze({
    corridor,
    liveEnabled: false,
    policyStatus: 'RESEARCH_REQUIRED',
    reasonCodes,
  });
}

export function fxFactDoesNotAuthorizeRail(fact: OperatingScopeFact): boolean {
  return (
    fact.activationDomain !== 'PAYMENT_RAILS' ||
    fact.reasonCodes.includes('FX_EVIDENCE_NOT_PAYMENT_RAIL') ||
    fact.eligibility !== true
  );
}
