/**
 * Ports for Access Fabric. Reuses the existing oracle fact contract;
 * does not create a second oracle network or direct ledger path.
 */

import type { VerifiedAccessOracleFact } from './types.ts';
import type { RefundAdjustmentProposal } from './types.ts';

export type AccessOracleFactPort = {
  readonly source: 'ACCESS_ORACLE_FACT_PORT';
  record(fact: VerifiedAccessOracleFact): void;
  factsFor(sessionId: string): readonly VerifiedAccessOracleFact[];
  hasConflict(sessionId: string): boolean;
  providerRevoked(providerRef: string): boolean;
};

export type SettlementProposalRouteResult = {
  readonly routed: true;
  readonly proposalId: string;
  readonly authorityPath: 'KERNEL_FINANCIAL_AUTHORITY';
  readonly directLedgerPost: false;
};

export type SettlementProposalPort = {
  readonly source: 'SETTLEMENT_PROPOSAL_PORT';
  routeRefundAdjustment(proposal: RefundAdjustmentProposal): SettlementProposalRouteResult;
};

export type AccessFabricPorts = {
  readonly oracles: AccessOracleFactPort;
  readonly settlement: SettlementProposalPort;
};

export class DevelopmentAccessOracleAdapter implements AccessOracleFactPort {
  readonly source = 'ACCESS_ORACLE_FACT_PORT' as const;
  private readonly facts = new Map<string, VerifiedAccessOracleFact[]>();
  private readonly conflicts = new Set<string>();
  private readonly revoked = new Set<string>();

  record(fact: VerifiedAccessOracleFact): void {
    const list = this.facts.get(fact.sessionId) ?? [];
    list.push(fact);
    this.facts.set(fact.sessionId, list);
    if (fact.conflicted) {
      this.conflicts.add(fact.sessionId);
    }
  }

  factsFor(sessionId: string): readonly VerifiedAccessOracleFact[] {
    return this.facts.get(sessionId) ?? [];
  }

  hasConflict(sessionId: string): boolean {
    return this.conflicts.has(sessionId);
  }

  providerRevoked(providerRef: string): boolean {
    return this.revoked.has(providerRef);
  }

  revokeProvider(providerRef: string): void {
    this.revoked.add(providerRef);
  }
}

export class DevelopmentSettlementProposalAdapter implements SettlementProposalPort {
  readonly source = 'SETTLEMENT_PROPOSAL_PORT' as const;
  readonly routed: RefundAdjustmentProposal[] = [];

  routeRefundAdjustment(proposal: RefundAdjustmentProposal): SettlementProposalRouteResult {
    this.routed.push(proposal);
    return Object.freeze({
      routed: true,
      proposalId: proposal.proposalId,
      authorityPath: 'KERNEL_FINANCIAL_AUTHORITY',
      directLedgerPost: false,
    });
  }
}

export function developmentAccessPorts(
  oracle?: DevelopmentAccessOracleAdapter,
  settlement?: DevelopmentSettlementProposalAdapter,
): AccessFabricPorts {
  return Object.freeze({
    oracles: oracle ?? new DevelopmentAccessOracleAdapter(),
    settlement: settlement ?? new DevelopmentSettlementProposalAdapter(),
  });
}
