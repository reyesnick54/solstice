/**
 * HELIOS H27 — Grow operational controls BFF projection.
 */

import { asAccountId, type Account, type UtcInstant } from '@solstice/domain';
import type { InvestmentsService } from '@solstice/investments';
import type { Ledger } from '@solstice/ledger';
import { Money } from '@solstice/money';
import { asIntentId, ACTION_TYPES } from '@solstice/permissions';
import {
  HeliosGrowControlService,
  type GrowCashAvailability,
  type GrowCloseMode,
  type GrowControlFailure,
  type GrowLifecycleService,
  type GrowthOrchestrator,
  type ResumeRevalidationInput,
  evaluateGrowSuitability,
  type SuitabilityFacts,
} from '@solstice/platform';
import { balanceOfAccount } from '../../../accounts/src/balances.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type GrowControlsBffDeps = {
  readonly growControls: HeliosGrowControlService;
  readonly resolveActor: (actorId: string) => unknown;
};

export function createGrowControlsService(input: {
  readonly clock: { now: () => UtcInstant };
  readonly grow: GrowLifecycleService;
  readonly orchestrator: GrowthOrchestrator;
  readonly investments: InvestmentsService;
  readonly ledger: Ledger;
  readonly accounts: { get(id: Account['id']): Account | undefined };
  readonly investmentAccountsFor: (customerId: string) => {
    readonly investmentAccountId: string;
    readonly demandAccountId: string;
    readonly brokerageCashAccountId: string;
    readonly pendingSettlementAccountId: string;
  } | null;
  readonly suitabilityFor: (principal: BffPrincipal) => SuitabilityFacts;
  readonly degradedFlags?: (customerId: string, subjectId: string) => Partial<{
    readonly marketDataStale: boolean;
    readonly researchProviderDown: boolean;
    readonly s3mUnavailable: boolean;
    readonly executionProviderDown: boolean;
    readonly providerActionRequired: boolean;
    readonly reconciliationPending: boolean;
    readonly reconciliationMismatch: boolean;
    readonly settlementDelayed: boolean;
    readonly valuationStale: boolean;
    readonly capabilityReviewRequired: boolean;
    readonly regulatoryRestriction: boolean;
    readonly strategyReviewRequired: boolean;
    readonly systemMaintenance: boolean;
  }>;
  readonly store?: HeliosGrowControlService['store'];
}): HeliosGrowControlService {
  function accountBalanceMinor(account: Account | undefined): bigint {
    if (!account) return 0n;
    const balance = balanceOfAccount(input.ledger, account);
    return balance.ok ? balance.value.minorUnits : 0n;
  }

  function cashAvailability(customerId: string, subjectId: string): GrowCashAvailability {
    const accounts = input.investmentAccountsFor(customerId);
    const currency = 'USD';
    if (!accounts) {
      return Object.freeze({
        settled: { minorUnits: '0', currency },
        reconciled: { minorUnits: '0', currency },
        available: { minorUnits: '0', currency },
        unreserved: { minorUnits: '0', currency },
        reserved: { minorUnits: '0', currency },
        unsettled: { minorUnits: '0', currency },
        deployed: { minorUnits: '0', currency },
      });
    }
    const demand = input.accounts.get(asAccountId(accounts.demandAccountId));
    const brokerage = input.accounts.get(asAccountId(accounts.brokerageCashAccountId));
    const pending = input.accounts.get(asAccountId(accounts.pendingSettlementAccountId));
    const settled = accountBalanceMinor(brokerage);
    const unsettled = accountBalanceMinor(pending);
    const latestProposal = input.grow.store.latestProposalFor(subjectId);
    const reserved =
      latestProposal &&
      (latestProposal.state === 'APPROVED' || latestProposal.state === 'AWAITING_APPROVAL')
        ? BigInt(latestProposal.amount.minorUnits)
        : 0n;
    const executed = input.grow.store
      .listExecutions(customerId)
      .filter((row) => row.state === 'COMPLETED' || row.state === 'PARTIALLY_COMPLETED')
      .reduce((sum, row) => sum + BigInt(row.filledMinorUnits), 0n);
    const available = settled > reserved ? settled - reserved : 0n;
    const unreserved = available;
    return Object.freeze({
      settled: { minorUnits: settled.toString(), currency },
      reconciled: { minorUnits: settled.toString(), currency },
      available: { minorUnits: available.toString(), currency },
      unreserved: { minorUnits: unreserved.toString(), currency },
      reserved: { minorUnits: reserved.toString(), currency },
      unsettled: { minorUnits: unsettled.toString(), currency },
      deployed: { minorUnits: executed.toString(), currency },
    });
  }

  return new HeliosGrowControlService({
    clock: input.clock as never,
    grow: input.grow,
    ...(input.store ? { store: input.store } : {}),
    cashAvailability,
    degradedInput: (customerId, subjectId) => {
      const flags = input.degradedFlags?.(customerId, subjectId) ?? {};
      return Object.freeze({
        marketDataStale: flags.marketDataStale ?? false,
        researchProviderDown: flags.researchProviderDown ?? false,
        s3mUnavailable: flags.s3mUnavailable ?? false,
        executionProviderDown: flags.executionProviderDown ?? false,
        providerActionRequired: flags.providerActionRequired ?? false,
        reconciliationPending: flags.reconciliationPending ?? false,
        reconciliationMismatch: flags.reconciliationMismatch ?? false,
        settlementDelayed: flags.settlementDelayed ?? false,
        valuationStale: flags.valuationStale ?? false,
        capabilityReviewRequired: flags.capabilityReviewRequired ?? false,
        regulatoryRestriction: flags.regulatoryRestriction ?? false,
        strategyReviewRequired: flags.strategyReviewRequired ?? false,
        systemMaintenance: flags.systemMaintenance ?? false,
      });
    },
    withdrawCash: (req) => {
      const result = input.investments.withdrawBrokerageCash({
        id: asIntentId(`I_grow_wd_${req.idempotencyKey}`),
        actionType: ACTION_TYPES.WITHDRAW_BROKERAGE_CASH,
        idempotencyKey: req.idempotencyKey,
        actorId: req.actorId,
        requestedAt: input.clock.now(),
        purpose: 'CUSTOMER_WITHDRAWAL',
        payload: {
          accountId: asAccountId(req.sourceAccountId),
          destinationAccountId: asAccountId(req.destinationAccountId),
          amount: Money.fromMinorUnitsString(req.amountMinorUnits, req.currency),
        },
      });
      if (result.outcome !== 'OK' || !result.value) {
        const code =
          result.code === 'INSUFFICIENT_BROKERAGE_CASH'
            ? 'INSUFFICIENT_AVAILABLE_CASH'
            : result.code === 'INVALID_ACCOUNT'
              ? 'INVALID_DESTINATION'
              : 'PROVIDER_UNAVAILABLE';
        return { ok: false as const, error: { code, message: result.message ?? 'withdrawal failed' } };
      }
      return { ok: true as const, value: { journalId: result.value.journalId } };
    },
    submitClose: (req) => {
      const accounts = input.investmentAccountsFor(req.customerId);
      if (!accounts) {
        return { ok: false as const, error: { code: 'CLOSE_NOT_SUPPORTED', message: 'investment accounts missing' } };
      }
      try {
        const portfolio = input.investments.valuePortfolio(accounts.investmentAccountId as never);
        const open = portfolio.positions.filter((row) => {
          if (req.instrumentIds.length === 0) return true;
          return req.instrumentIds.includes(row.instrumentId);
        });
        if (open.length === 0) {
          return { ok: false as const, error: { code: 'POSITION_NOT_FOUND', message: 'no eligible open positions' } };
        }
        return {
          ok: true as const,
          value: Object.freeze({
            positionIds: Object.freeze(open.map((row) => row.instrumentId)),
            executionIds: Object.freeze([`close_${req.idempotencyKey}`]),
          }),
        };
      } catch {
        return { ok: false as const, error: { code: 'CLOSE_NOT_SUPPORTED', message: 'close not available in sandbox' } };
      }
    },
    applyMandateChange: (req) => {
      const lowered = req.sourceText.toLowerCase();
      const requiresReview =
        lowered.includes('lower') ||
        lowered.includes('reduce') ||
        lowered.includes('pause') ||
        lowered.includes('restrict');
      return { ok: true as const, value: { requiresReview } };
    },
  });
}

function mapFailure(requestId: string, error: GrowControlFailure): BffErrorEnvelope {
  const status =
    error.code === 'ACTOR_UNAUTHORIZED' || error.code === 'CUSTOMER_MISMATCH'
      ? 403
      : error.code === 'INSUFFICIENT_AVAILABLE_CASH' ||
          error.code === 'RESERVED_CASH' ||
          error.code === 'WITHDRAWAL_IN_FLIGHT' ||
          error.code === 'ALREADY_PAUSED' ||
          error.code === 'NOT_PAUSED' ||
          error.code === 'RESUME_BLOCKED' ||
          error.code === 'DEPLOYMENT_PAUSED'
        ? 409
        : 400;
  return bffError(requestId, error.message, error.code, status);
}

export function growControlsStatus(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  const result = deps.growControls.status(deps.resolveActor(principal.actorId), principal.customerId, principal.identityId);
  return result.ok ? (result.value as Record<string, unknown>) : mapFailure(requestId, result.error);
}

export function growControlsPause(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  const result = deps.growControls.requestPause(
    deps.resolveActor(principal.actorId),
    principal.customerId,
    principal.identityId,
  );
  return result.ok
    ? Object.freeze({ schema: 'sunrey.consumer.grow.controls.pause.v1', pause: result.value, serverOwned: true })
    : mapFailure(requestId, result.error);
}

export function growControlsResume(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  body: Record<string, unknown>,
  requestId: string,
  suitability: SuitabilityFacts,
): Record<string, unknown> | BffErrorEnvelope {
  const revalidation: ResumeRevalidationInput = Object.freeze({
    mandateActive: body.mandateActive !== false,
    accountStatus: principal.restricted ? 'RESTRICTED' : 'ACTIVE',
    providerCapable: body.providerCapable !== false,
    strategyEligible: body.strategyEligible !== false,
    systemCapable: body.systemCapable !== false,
    jurisdictionPermitted: suitability.jurisdictionPermitted,
    complianceClear: evaluateGrowSuitability(suitability) === 'SUITABLE',
    workOrderActive: body.workOrderActive !== false,
  });
  const result = deps.growControls.resume(
    deps.resolveActor(principal.actorId),
    principal.customerId,
    principal.identityId,
    revalidation,
  );
  return result.ok
    ? Object.freeze({ schema: 'sunrey.consumer.grow.controls.resume.v1', pause: result.value, serverOwned: true })
    : mapFailure(requestId, result.error);
}

export function growControlsClose(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  body: Record<string, unknown>,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  const mode: GrowCloseMode = body.mode === 'CLOSE_SELECTED' ? 'CLOSE_SELECTED' : 'CLOSE_ALL_ELIGIBLE';
  const instrumentIds = Array.isArray(body.instrumentIds)
    ? body.instrumentIds.filter((row): row is string => typeof row === 'string')
    : [];
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : `close:${requestId}`;
  const result = deps.growControls.requestClose(deps.resolveActor(principal.actorId), {
    customerId: principal.customerId,
    subjectId: principal.identityId,
    actorId: principal.actorId,
    mode,
    instrumentIds,
    idempotencyKey,
  });
  return result.ok
    ? Object.freeze({ schema: 'sunrey.consumer.grow.controls.close.v1', closeRequest: result.value, serverOwned: true })
    : mapFailure(requestId, result.error);
}

export function growControlsWithdraw(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  body: Record<string, unknown>,
  requestId: string,
  accounts: { readonly demandAccountId: string; readonly brokerageCashAccountId: string } | null,
): Record<string, unknown> | BffErrorEnvelope {
  const amountMinorUnits = typeof body.amountMinorUnits === 'string' ? body.amountMinorUnits : '';
  if (!/^\d+$/.test(amountMinorUnits)) {
    return bffError(requestId, 'amount must be integer minor units', 'VALIDATION', 400);
  }
  if (!accounts) {
    return bffError(requestId, 'investment accounts not provisioned', 'PRODUCT_UNAVAILABLE', 400);
  }
  const destinationAccountId =
    typeof body.destinationAccountId === 'string' ? body.destinationAccountId : accounts.demandAccountId;
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : `withdraw:${requestId}`;
  const result = deps.growControls.requestWithdrawal(deps.resolveActor(principal.actorId), {
    customerId: principal.customerId,
    subjectId: principal.identityId,
    actorId: principal.actorId,
    amountMinorUnits,
    currency: typeof body.currency === 'string' ? body.currency : 'USD',
    destinationAccountId,
    sourceAccountId: accounts.brokerageCashAccountId,
    idempotencyKey,
  });
  return result.ok
    ? Object.freeze({ schema: 'sunrey.consumer.grow.controls.withdraw.v1', withdrawal: result.value, serverOwned: true })
    : mapFailure(requestId, result.error);
}

export function growControlsMandateChange(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  body: Record<string, unknown>,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  const sourceText = typeof body.sourceText === 'string' ? body.sourceText : '';
  if (!sourceText.trim()) {
    return bffError(requestId, 'sourceText required', 'VALIDATION', 400);
  }
  const result = deps.growControls.changeMandate(deps.resolveActor(principal.actorId), {
    customerId: principal.customerId,
    subjectId: principal.identityId,
    actorId: principal.actorId,
    sourceText,
  });
  return result.ok
    ? Object.freeze({ schema: 'sunrey.consumer.grow.controls.mandate.v1', change: result.value, serverOwned: true })
    : mapFailure(requestId, result.error);
}

export function growControlsDegraded(
  deps: GrowControlsBffDeps,
  principal: BffPrincipal,
  requestId: string,
): Record<string, unknown> | BffErrorEnvelope {
  void requestId;
  const access = deps.growControls.status(deps.resolveActor(principal.actorId), principal.customerId, principal.identityId);
  if (!access.ok) {
    return mapFailure(requestId, access.error);
  }
  return Object.freeze({
    schema: 'sunrey.consumer.grow.controls.degraded.v1',
    customerId: principal.customerId,
    subjectId: principal.identityId,
    items: access.value.degradedStates,
    serverOwned: true,
  });
}
