import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { reconciliationRunIdFor } from './ids.ts';
import type { MismatchKind, ReconciliationOutcome } from './taxonomy.ts';
import type { CapitalReconciliationRun, InvestmentLifecyclePort } from './types.ts';

export function mapInvestmentReconciliationResult(
  result: ReturnType<InvestmentLifecyclePort['reconcileInvestmentAccount']>['result'],
): ReconciliationOutcome {
  switch (result) {
    case 'MATCHED':
      return 'MATCHED';
    case 'PENDING':
      return 'PENDING';
    case 'POSITION_MISMATCH':
    case 'CASH_MISMATCH':
    case 'MISSING_FILL':
    case 'MISSING_INTERNAL':
      return 'MISMATCH';
    case 'INVESTIGATION_REQUIRED':
      return 'REVIEW_REQUIRED';
    default:
      return 'UNKNOWN';
  }
}

export function classifyMismatchKinds(findings: readonly string[]): readonly MismatchKind[] {
  const kinds = new Set<MismatchKind>();
  for (const finding of findings) {
    if (finding.includes('POSITION_MISMATCH')) {
      kinds.add('PROVIDER_POSITION_MISMATCH');
    }
    if (finding.includes('CASH_MISMATCH')) {
      kinds.add('CASH_DISCREPANCY');
    }
    if (finding.includes('MISSING_FILL')) {
      kinds.add('MISSING_FILL');
    }
    if (finding.includes('MISSING_INTERNAL')) {
      kinds.add('DUPLICATE_EVENT');
    }
    if (finding.includes('settlement')) {
      kinds.add('SETTLEMENT_DISCREPANCY');
    }
    if (finding.includes('withdrawal')) {
      kinds.add('WITHDRAWAL_DISCREPANCY');
    }
    if (finding.includes('fee')) {
      kinds.add('FEE_MISMATCH');
    }
    if (finding.includes('quantity')) {
      kinds.add('QUANTITY_MISMATCH');
    }
  }
  return Object.freeze([...kinds]);
}

export function runCapitalReconciliation(input: {
  readonly customerId: CustomerId;
  readonly investmentAccountId: string;
  readonly investments: InvestmentLifecyclePort;
  readonly now: UtcInstant;
  readonly injectMismatch?: boolean;
}): CapitalReconciliationRun {
  const investmentRecon = input.investments.reconcileInvestmentAccount(input.investmentAccountId);
  let outcome = mapInvestmentReconciliationResult(investmentRecon.result);
  let findings = [...investmentRecon.findings];
  if (input.injectMismatch) {
    outcome = 'MISMATCH';
    findings = [...findings, 'CASH_MISMATCH injected test discrepancy'];
  }
  const mismatchKinds = classifyMismatchKinds(findings);
  const blocksAvailability = outcome === 'MISMATCH' || outcome === 'REVIEW_REQUIRED';
  return Object.freeze({
    runId: reconciliationRunIdFor(input.investmentAccountId, input.now),
    customerId: input.customerId,
    investmentAccountId: input.investmentAccountId,
    outcome,
    mismatchKinds,
    findings: Object.freeze(findings),
    blocksAvailability,
    investmentReconciliationId: investmentRecon.reconciliationId,
    createdAt: input.now,
  });
}
