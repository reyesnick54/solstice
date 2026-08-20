import { applyQueryOutcome } from './submit.ts';
import type { OperationStore } from './store.ts';
import {
  AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED,
  type OperationExecutionRecord,
  type ProviderQueryOutcome,
} from './types.ts';

export const RECONCILIATION_CAN_POST_LEDGER = false as const;
export const RECONCILIATION_CAN_MINT = false as const;
export const RECONCILIATION_CAN_ISSUE_EXECUTION_AUTHORITY = false as const;
export const RECONCILIATION_CAN_CHANGE_BENEFICIARY = false as const;
export const RECONCILIATION_CAN_CREATE_CUSTODY_APPROVAL = false as const;

export type ResolutionProposal = {
  readonly operationId: string;
  readonly proposedState: OperationExecutionRecord['state'];
  readonly reason: string;
  readonly postsLedger: false;
  readonly mints: false;
  readonly issuesExecutionAuthority: false;
  readonly changesBeneficiary: false;
  readonly createsCustodyApproval: false;
};

export type ProviderQueryPort = {
  query(record: OperationExecutionRecord): Promise<ProviderQueryOutcome>;
};

export type FinancialResolver = 'HUMAN' | 'AI' | 'AGENT';

export function refuseAutonomousFinancialResolution(resolver: FinancialResolver): {
  readonly allowed: boolean;
  readonly code: typeof AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED | 'HUMAN_REVIEW_PERMITTED';
} {
  if (resolver === 'HUMAN') {
    return { allowed: true, code: 'HUMAN_REVIEW_PERMITTED' };
  }
  return { allowed: false, code: AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED };
}

/**
 * Bounded recovery coordinator. Discovers ambiguous operations, queries
 * injected provider ports, and proposes resolution. It does not post
 * ledger corrections, mint, issue Execution Authority, change a
 * beneficiary, or create custody approval.
 */
export class ReconciliationCoordinator {
  readonly canPostLedger = RECONCILIATION_CAN_POST_LEDGER;
  readonly canMint = RECONCILIATION_CAN_MINT;
  readonly canIssueExecutionAuthority = RECONCILIATION_CAN_ISSUE_EXECUTION_AUTHORITY;
  readonly canChangeBeneficiary = RECONCILIATION_CAN_CHANGE_BENEFICIARY;
  readonly canCreateCustodyApproval = RECONCILIATION_CAN_CREATE_CUSTODY_APPROVAL;

  private readonly store: OperationStore;

  constructor(store: OperationStore) {
    this.store = store;
  }

  async discoverAmbiguous(): Promise<readonly OperationExecutionRecord[]> {
    return this.store.listByState([
      'DISPATCHING',
      'SUBMISSION_UNKNOWN',
      'RECONCILIATION_REQUIRED',
      'COMPENSATION_REQUIRED',
    ]);
  }

  async queryAndPropose(
    record: OperationExecutionRecord,
    port: ProviderQueryPort,
    now: string,
    resolver: FinancialResolver = 'HUMAN',
  ): Promise<{ readonly proposal: ResolutionProposal; readonly record: OperationExecutionRecord }> {
    const autonomy = refuseAutonomousFinancialResolution(resolver);
    if (!autonomy.allowed) {
      return {
        proposal: Object.freeze({
          operationId: record.operationId,
          proposedState: record.state,
          reason: autonomy.code,
          postsLedger: false,
          mints: false,
          issuesExecutionAuthority: false,
          changesBeneficiary: false,
          createsCustodyApproval: false,
        }),
        record,
      };
    }
    const query = await port.query(record);
    const next = applyQueryOutcome(record, query, now);
    const persisted = await this.store.update(next);
    return {
      proposal: Object.freeze({
        operationId: persisted.operationId,
        proposedState: persisted.state,
        reason: `query_${query.kind}`,
        postsLedger: false,
        mints: false,
        issuesExecutionAuthority: false,
        changesBeneficiary: false,
        createsCustodyApproval: false,
      }),
      record: persisted,
    };
  }

  async markReconciled(
    record: OperationExecutionRecord,
    now: string,
    authoritativeEvidenceId: string,
  ): Promise<OperationExecutionRecord> {
    if (!authoritativeEvidenceId) {
      throw new Error('CONFIRMED requires authoritative downstream evidence');
    }
    return this.store.update({
      ...record,
      state: 'CONFIRMED',
      evidenceId: authoritativeEvidenceId,
      confirmedAt: now,
      lastObservedAt: now,
    });
  }
}
