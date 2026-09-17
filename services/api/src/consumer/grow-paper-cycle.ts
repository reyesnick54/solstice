/**
 * HELIOS H15 — paper Grow activity/results BFF projection.
 * Server-owned financial truth; hides inference plumbing.
 */

import { asAccountId, type Account } from '@solstice/domain';
import { asInvestmentAccountId, type InvestmentsService } from '@solstice/investments';
import type { Ledger } from '@solstice/ledger';
import {
  type GrowthOrchestrator,
  type GrowLifecycleService,
  type EconomicWorkOrder,
  type EconomicWorkOrderService,
  buildPaperGrowActivity,
  buildPaperGrowAttribution,
  buildPaperGrowCash,
  buildPaperGrowOverview,
  buildPaperDisclosureContract,
  type PaperGrowInvestmentSnapshot,
  type PaperGrowLedgerCash,
  type PaperGrowReadModelInput,
} from '@solstice/platform';
import { balanceOfAccount } from '../../../accounts/src/balances.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type GrowPaperCycleDeps = {
  readonly orchestrator: GrowthOrchestrator;
  readonly grow: GrowLifecycleService;
  readonly investments: InvestmentsService;
  readonly ledger: Ledger;
  readonly accounts: { get(id: Account['id']): Account | undefined };
  readonly workOrders?: EconomicWorkOrderService;
  readonly resolveActor: (actorId: string) => unknown;
  readonly investmentAccountsFor: (customerId: string) => {
    readonly investmentAccountId: string;
    readonly demandAccountId: string;
    readonly brokerageCashAccountId: string;
    readonly securitiesAccountId: string;
    readonly pendingSettlementAccountId: string;
  } | null;
};

function accountBalanceMinor(ledger: Ledger, account: Account | undefined): bigint {
  if (!account) {
    return 0n;
  }
  const balance = balanceOfAccount(ledger, account);
  return balance.ok ? balance.value.minorUnits : 0n;
}

function buildInvestmentSnapshot(
  deps: GrowPaperCycleDeps,
  customerId: string,
): PaperGrowInvestmentSnapshot | null {
  const accounts = deps.investmentAccountsFor(customerId);
  if (!accounts) {
    return null;
  }
  try {
    const investmentAccountId = asInvestmentAccountId(accounts.investmentAccountId);
    const valuation = deps.investments.valuePortfolio(investmentAccountId);
    const executed = deps.grow.store.listExecutions(customerId).find((row) => row.state === 'COMPLETED');
    const filled = executed ? BigInt(executed.filledMinorUnits) : 0n;
    const currency = valuation.cash.currency;
    const currentValue = valuation.marketValue.minorUnits + valuation.cash.minorUnits;
    return Object.freeze({
      holdings: Object.freeze(
        valuation.positions.map((row) =>
          Object.freeze({
            instrumentId: row.instrumentId,
            displayName: row.instrumentId,
            quantityUnits: row.quantity.units.toString(),
            marketValueMinorUnits: row.marketValue?.minorUnits.toString() ?? null,
            unrealizedMinorUnits: row.unrealized?.unrealized.minorUnits.toString() ?? null,
            positionStatus: 'OPEN' as const,
          }),
        ),
      ),
      realizedMinorUnits: '0',
      unrealizedMinorUnits: (currentValue - filled).toString(),
      simulatedFeesMinorUnits: '0',
      simulatedSpreadSlippageMinorUnits: '0',
      currentValueMinorUnits: currentValue.toString(),
      netContributionsMinorUnits: filled.toString(),
      initialAllocationMinorUnits: filled.toString(),
      benchmarkId: null,
      benchmarkPeriodReturnBps: null,
      currency,
    });
  } catch {
    return null;
  }
}

function buildLedgerCash(deps: GrowPaperCycleDeps, customerId: string, subjectId: string): PaperGrowLedgerCash {
  const accounts = deps.investmentAccountsFor(customerId);
  const currency = 'USD';
  if (!accounts) {
    return Object.freeze({
      totalSandboxCashMinorUnits: '0',
      growReservedMinorUnits: '0',
      paperDeployedMinorUnits: '0',
      unsettledMinorUnits: '0',
      currency,
    });
  }
  const demand = deps.accounts.get(asAccountId(accounts.demandAccountId));
  const brokerage = deps.accounts.get(asAccountId(accounts.brokerageCashAccountId));
  const pending = deps.accounts.get(asAccountId(accounts.pendingSettlementAccountId));
  const total = accountBalanceMinor(deps.ledger, demand) + accountBalanceMinor(deps.ledger, brokerage);
  const latestProposal = deps.grow.store.latestProposalFor(subjectId);
  const reserved =
    latestProposal &&
    (latestProposal.state === 'APPROVED' || latestProposal.state === 'AWAITING_APPROVAL')
      ? BigInt(latestProposal.amount.minorUnits)
      : 0n;
  const executed = deps.grow.store
    .listExecutions(customerId)
    .filter((row) => row.state === 'COMPLETED' || row.state === 'PARTIALLY_COMPLETED')
    .reduce((sum, row) => sum + BigInt(row.filledMinorUnits), 0n);
  const unsettled = accountBalanceMinor(deps.ledger, pending);
  return Object.freeze({
    totalSandboxCashMinorUnits: total.toString(),
    growReservedMinorUnits: reserved.toString(),
    paperDeployedMinorUnits: executed.toString(),
    unsettledMinorUnits: unsettled.toString(),
    currency,
  });
}

function buildReadModelInput(deps: GrowPaperCycleDeps, principal: BffPrincipal): PaperGrowReadModelInput {
  const plan = deps.orchestrator.store.latestPlanFor(principal.identityId) ?? null;
  const mandate = deps.orchestrator.store.latestMandateFor(principal.identityId);
  let workOrder: EconomicWorkOrder | null = null;
  if (deps.workOrders) {
    const actor = deps.resolveActor(principal.actorId);
    const listed = deps.workOrders.listEconomicWorkOrders(actor, principal.customerId, principal.identityId);
    if (listed.ok && listed.value.length > 0) {
      workOrder = listed.value[0] ?? null;
    }
  }
  return Object.freeze({
    customerId: principal.customerId,
    subjectId: principal.identityId,
    growStore: deps.grow.store,
    plan,
    workOrder,
    mandateState: mandate?.state ?? null,
    ledgerCash: buildLedgerCash(deps, principal.customerId, principal.identityId),
    investment: buildInvestmentSnapshot(deps, principal.customerId),
    degradedReasons: Object.freeze([]),
    researchTaskCount: plan?.candidateActions.length ?? 0,
    qualifiedOpportunityCount: plan?.orderedProposedActions.length ?? 0,
  });
}

export function growPaperOverview(
  deps: GrowPaperCycleDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  void requestId;
  return buildPaperGrowOverview(buildReadModelInput(deps, principal)) as Record<string, unknown>;
}

export function growPaperActivity(
  deps: GrowPaperCycleDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  void requestId;
  const input = buildReadModelInput(deps, principal);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.activity.v1',
    customerId: principal.customerId,
    items: buildPaperGrowActivity(input),
    disclosure: buildPaperDisclosureContract(),
    serverOwned: true,
  });
}

export function growPaperResults(
  deps: GrowPaperCycleDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  void requestId;
  const input = buildReadModelInput(deps, principal);
  const overview = buildPaperGrowOverview(input);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.results.v1',
    customerId: principal.customerId,
    performance: overview.performance,
    attribution: buildPaperGrowAttribution(),
    disclosure: buildPaperDisclosureContract(),
    serverOwned: true,
  });
}

export function growPaperCash(
  deps: GrowPaperCycleDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  void requestId;
  const input = buildReadModelInput(deps, principal);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.cash.v1',
    ...buildPaperGrowCash(input),
    serverOwned: true,
  });
}
