/**
 * HELIOS H15/H25/H26 — production-shaped Grow read model BFF projection.
 * Server-owned financial truth; hides inference plumbing.
 */

import { asAccountId, asUtcInstant, type Account, type UtcInstant } from '@solstice/domain';
import {
  asInvestmentAccountId,
  buildCanonicalGrowAttributionSource,
  selectSandboxInvestmentProvider,
  type InvestmentsService,
} from '@solstice/investments';
import type { Ledger } from '@solstice/ledger';
import {
  type GrowthOrchestrator,
  type GrowLifecycleService,
  type EconomicWorkOrder,
  type EconomicWorkOrderService,
  buildIndependentGrowOutcomeAttribution,
  buildPaperGrowActionCards,
  buildPaperGrowActivity,
  buildPaperGrowAgentState,
  buildPaperGrowAttribution,
  buildPaperGrowCash,
  buildPaperGrowOverview,
  buildPaperDisclosureContract,
  projectAttributionToPaperPerformance,
  type GrowIndependentOutcomeAttribution,
  type GrowResearchSpendInput,
  type PaperGrowInvestmentSnapshot,
  type PaperGrowLedgerCash,
  type PaperGrowReadModelInput,
  type GrowProviderConsumerState,
} from '@solstice/platform';
import type { GrowBffDeps } from './grow.ts';
import { balanceOfAccount } from '../../../accounts/src/balances.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import { paginate, pageSizeOf } from './pagination.ts';
import type { BffPrincipal } from './ports.ts';

export type GrowPaperCycleDeps = {
  readonly orchestrator: GrowthOrchestrator;
  readonly grow: GrowLifecycleService;
  readonly investments: InvestmentsService;
  readonly ledger: Ledger;
  readonly accounts: { get(id: Account['id']): Account | undefined };
  readonly providers?: GrowBffDeps['providers'];
  readonly workOrders?: EconomicWorkOrderService;
  readonly resolveActor: (actorId: string) => unknown;
  readonly now: () => string;
  readonly investmentAccountsFor: (customerId: string) => {
    readonly investmentAccountId: string;
    readonly demandAccountId: string;
    readonly brokerageCashAccountId: string;
    readonly securitiesAccountId: string;
    readonly pendingSettlementAccountId: string;
  } | null;
  readonly researchSpendFor?: (customerId: string) => readonly GrowResearchSpendInput[];
  readonly nowInstant?: () => UtcInstant;
  readonly providerDown?: boolean;
};

function accountBalanceMinor(ledger: Ledger, account: Account | undefined): bigint {
  if (!account) {
    return 0n;
  }
  const balance = balanceOfAccount(ledger, account);
  return balance.ok ? balance.value.minorUnits : 0n;
}

function resolveNow(deps: GrowPaperCycleDeps): UtcInstant {
  return deps.nowInstant?.() ?? asUtcInstant(deps.now());
}

export function buildGrowOutcomeAttribution(
  deps: GrowPaperCycleDeps,
  customerId: string,
  workOrderId: string | null,
): GrowIndependentOutcomeAttribution | null {
  const accounts = deps.investmentAccountsFor(customerId);
  if (!accounts) {
    return null;
  }
  try {
    const investmentAccountId = asInvestmentAccountId(accounts.investmentAccountId);
    const source = buildCanonicalGrowAttributionSource({
      investments: deps.investments,
      investmentAccountId,
      ledger: deps.ledger,
      demandAccountId: accounts.demandAccountId,
      now: resolveNow(deps),
    });
    return buildIndependentGrowOutcomeAttribution({
      source,
      researchSpend: deps.researchSpendFor?.(customerId) ?? [],
      workOrderId,
      now: resolveNow(deps),
    });
  } catch {
    return null;
  }
}

function buildInvestmentSnapshot(
  deps: GrowPaperCycleDeps,
  customerId: string,
  workOrderId: string | null,
): PaperGrowInvestmentSnapshot | null {
  const attribution = buildGrowOutcomeAttribution(deps, customerId, workOrderId);
  if (!attribution) {
    return null;
  }
  const performance = projectAttributionToPaperPerformance(attribution);
  return Object.freeze({
    holdings: Object.freeze(
      attribution.positions.map((row) =>
        Object.freeze({
          instrumentId: row.instrumentId,
          displayName: row.instrumentId,
          quantityUnits: row.quantityUnits,
          marketValueMinorUnits: row.marketValue?.minorUnits ?? null,
          unrealizedMinorUnits: row.unrealized?.minorUnits ?? null,
          positionStatus: row.positionStatus,
        }),
      ),
    ),
    realizedMinorUnits: performance.realizedPaperPnl.minorUnits,
    unrealizedMinorUnits: performance.unrealizedPaperChange.minorUnits,
    simulatedFeesMinorUnits: performance.simulatedFees.minorUnits,
    simulatedSpreadSlippageMinorUnits: performance.simulatedSpreadSlippage.minorUnits,
    currentValueMinorUnits: performance.currentPaperValue.minorUnits,
    netContributionsMinorUnits: performance.netContributions.minorUnits,
    initialAllocationMinorUnits: performance.initialPaperAllocation.minorUnits,
    benchmarkId: null,
    benchmarkPeriodReturnBps: null,
    currency: attribution.reportingCurrency,
  });
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

function buildProviderDisplay(
  deps: GrowPaperCycleDeps,
  principal: BffPrincipal,
): GrowProviderConsumerState | null {
  if (deps.providerDown) {
    return Object.freeze({
      providerDisplayName: 'Sandbox investment provider',
      providerId: 'provider_unavailable',
      accountStatus: 'UNAVAILABLE',
      fundingStatus: 'UNFUNDED',
      actionRequired: true,
      restrictions: Object.freeze(['PROVIDER_UNAVAILABLE']),
      environment: 'simulation',
    });
  }
  if (!deps.providers) {
    return null;
  }
  const routed = selectSandboxInvestmentProvider(deps.providers, principal.jurisdiction, deps.now());
  if (!routed.ok) {
    return Object.freeze({
      providerDisplayName: 'Sandbox investment provider',
      providerId: 'provider_unavailable',
      accountStatus: 'UNAVAILABLE',
      fundingStatus: 'UNFUNDED',
      actionRequired: true,
      restrictions: Object.freeze(['PROVIDER_UNAVAILABLE']),
      environment: 'simulation',
    });
  }
  const registration = deps.providers.get(routed.providerId);
  const displayName = registration?.displayName ?? registration?.providerId ?? routed.providerId;
  const accounts = deps.investmentAccountsFor(principal.customerId);
  const fundingStatus =
    accounts && buildLedgerCash(deps, principal.customerId, principal.identityId).paperDeployedMinorUnits !== '0'
      ? 'DEPLOYED'
      : 'FUNDED';
  return Object.freeze({
    providerDisplayName: displayName,
    providerId: routed.providerId,
    accountStatus: 'ACTIVE',
    fundingStatus,
    actionRequired: false,
    restrictions: Object.freeze([]),
    environment: 'simulation',
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
  const degradedReasons = Object.freeze(
    deps.providerDown
      ? (['PAPER_EXECUTOR_UNAVAILABLE'] as const)
      : ([] as const),
  );
  return Object.freeze({
    customerId: principal.customerId,
    subjectId: principal.identityId,
    growStore: deps.grow.store,
    plan,
    workOrder,
    mandateState: mandate?.state ?? null,
    ledgerCash: buildLedgerCash(deps, principal.customerId, principal.identityId),
    investment: buildInvestmentSnapshot(deps, principal.customerId, workOrder?.workOrderId ?? null),
    degradedReasons,
    researchTaskCount: plan?.candidateActions.length ?? 0,
    qualifiedOpportunityCount: plan?.orderedProposedActions.length ?? 0,
    providerDisplay: buildProviderDisplay(deps, principal),
    valuationFreshness: deps.now(),
    operatingResearchCostMinorUnits: '0',
  });
}

function heliosUnavailable(requestId: string): BffErrorEnvelope {
  return bffError({
    errorCode: 'CAPABILITY_DISABLED',
    category: 'TEMPORARY_UNAVAILABLE',
    message: 'Grow HELIOS read model requires durable Grow execution lifecycle binding',
    retryable: false,
    requestId,
    detailsSafeForClient: { growCode: 'HELIOS_BINDING_REQUIRED' },
  });
}

export function growPaperOverview(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  return buildPaperGrowOverview(buildReadModelInput(deps, principal)) as Record<string, unknown>;
}

export function growPaperAllocate(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const overview = buildPaperGrowOverview(buildReadModelInput(deps, principal));
  return Object.freeze({
    schema: 'sunrey.consumer.grow.allocate.v1',
    customerId: principal.customerId,
    allocate: overview.allocate,
    disclosure: overview.disclosure,
    serverOwned: true,
  });
}

export function growPaperActiveCapital(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const overview = buildPaperGrowOverview(buildReadModelInput(deps, principal));
  return Object.freeze({
    schema: 'sunrey.consumer.grow.active-capital.v1',
    customerId: principal.customerId,
    activeCapital: overview.activeCapital,
    disclosure: overview.disclosure,
    serverOwned: true,
  });
}

export function growPaperPerformance(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const input = buildReadModelInput(deps, principal);
  const overview = buildPaperGrowOverview(input);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.performance.v1',
    customerId: principal.customerId,
    performance: overview.performance,
    attribution: buildPaperGrowAttribution(),
    disclosure: overview.disclosure,
    depositsAreNotPerformance: true,
    productionMoneyMovement: false,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

export function growPaperActivity(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
  query: Readonly<Record<string, string>> = {},
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const input = buildReadModelInput(deps, principal);
  const items = buildPaperGrowActivity(input);
  const page = paginate(items, `grow-activity:${principal.customerId}`, query.cursor, pageSizeOf(query.pageSize));
  if ('error' in page) {
    return bffError({
      errorCode: 'INVALID_PAGINATION_CURSOR',
      category: 'VALIDATION',
      message: 'invalid activity pagination cursor',
      retryable: false,
      requestId,
    });
  }
  return Object.freeze({
    schema: 'sunrey.consumer.grow.activity.v1',
    customerId: principal.customerId,
    items: page.items,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    disclosure: buildPaperDisclosureContract(),
    serverOwned: true,
  });
}

export function growPaperResults(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const input = buildReadModelInput(deps, principal);
  const overview = buildPaperGrowOverview(input);
  const outcomeAttribution = buildGrowOutcomeAttribution(
    deps,
    principal.customerId,
    input.workOrder?.workOrderId ?? null,
  );
  return Object.freeze({
    schema: 'sunrey.consumer.grow.results.v1',
    customerId: principal.customerId,
    performance: overview.performance,
    attribution: buildPaperGrowAttribution(),
    outcomeAttribution,
    disclosure: buildPaperDisclosureContract(),
    depositsAreNotPerformance: true,
    productionMoneyMovement: false,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

export function growPaperCash(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const input = buildReadModelInput(deps, principal);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.cash.v1',
    ...buildPaperGrowCash(input),
    serverOwned: true,
  });
}

export function growPaperProviderAccount(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  if (deps.providerDown) {
    return bffError({
      errorCode: 'PROVIDER_UNAVAILABLE',
      category: 'TEMPORARY_UNAVAILABLE',
      message: 'investment provider is temporarily unavailable',
      retryable: true,
      requestId,
    });
  }
  const input = buildReadModelInput(deps, principal);
  const overview = buildPaperGrowOverview(input);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.provider-account.v1',
    customerId: principal.customerId,
    providerAccount: overview.providerAccount,
    serverOwned: true,
  });
}

export function growPaperActionCards(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const input = buildReadModelInput(deps, principal);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.action-cards.v1',
    customerId: principal.customerId,
    items: buildPaperGrowActionCards(input),
    serverOwned: true,
  });
}

export function growPaperAgentState(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  return buildPaperGrowAgentState(buildReadModelInput(deps, principal)) as Record<string, unknown>;
}
