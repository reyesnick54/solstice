import {
  asEconomicNodeId,
  type DeclaredGoalInput,
  type EconomicGraphService,
  type GoalKind,
  type GoalStatus,
  type SnapshotPresentationValuation,
} from '../../../economic-graph/src/index.ts';
import type { VerifiedActorContext } from '../../../../packages/identity/src/actor-context.ts';
import type { IdentityService } from '../../../../packages/identity/src/service.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal, GrowCommandPort } from './ports.ts';

type ValuedBody = {
  readonly cash?: readonly { readonly amount: { readonly currency: string; readonly minorUnits: string } }[];
  readonly presentationValuation?: SnapshotPresentationValuation | null;
  readonly valuationContext?: SnapshotPresentationValuation | null;
};

export function createGrowCommandPort(input: {
  readonly peg: EconomicGraphService;
  readonly identity: IdentityService;
  readonly valuePositions?: (
    positions: readonly { readonly currency: string; readonly minorUnits: bigint }[],
    targetCurrency: string,
  ) => SnapshotPresentationValuation | null;
}): GrowCommandPort {
  const { peg, identity, valuePositions } = input;

  function attachValuation<T extends ValuedBody>(body: T, valuationCurrency?: string): T {
    if (!valuationCurrency || !valuePositions || !body.cash || body.cash.length === 0) {
      return body;
    }
    const valuation = valuePositions(
      body.cash.map((row) => ({
        currency: row.amount.currency,
        minorUnits: BigInt(row.amount.minorUnits),
      })),
      valuationCurrency,
    );
    return Object.freeze({
      ...body,
      presentationValuation: valuation,
      ...( 'valuationContext' in body ? { valuationContext: valuation } : {}),
    });
  }

  function actorOf(principal: BffPrincipal, requestId: string): VerifiedActorContext | BffErrorEnvelope {
    const actor = identity.resolveActorContext(principal.actorId);
    if (!actor.ok) {
      return bffError({
        errorCode: 'SESSION_INVALID',
        category: 'AUTHENTICATION',
        message: actor.error.message,
        retryable: false,
        requestId,
      });
    }
    return actor.value;
  }

  function mapFailure(error: { readonly code: string; readonly message: string }, requestId: string): BffErrorEnvelope {
    if (error.code === 'SUBJECT_MISMATCH' || error.code === 'CAPABILITY_DENIED') {
      return bffError({
        errorCode: 'RESOURCE_NOT_OWNED',
        category: 'AUTHORIZATION',
        message: error.message,
        retryable: false,
        requestId,
      });
    }
    if (error.code === 'AUTHORITATIVE_FACT_IMMUTABLE') {
      return bffError({
        errorCode: 'FORBIDDEN_PROFILE_FIELD',
        category: 'AUTHORIZATION',
        message: error.message,
        retryable: false,
        requestId,
      });
    }
    if (error.code === 'GRAPH_NOT_FOUND' || error.code === 'GOAL_NOT_FOUND') {
      return bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: error.message,
        retryable: false,
        requestId,
      });
    }
    if (error.code === 'MANDATE_REQUIRED' || error.code === 'CATEGORY_DENIED' || error.code === 'CONSENT_DENIED') {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'AUTHORIZATION',
        message: error.message,
        retryable: false,
        requestId,
      });
    }
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: error.message,
      retryable: false,
      requestId,
    });
  }

  function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }, requestId: string): T | BffErrorEnvelope {
    if (!result.ok) {
      return mapFailure(result.error, requestId);
    }
    return result.value;
  }

  return {
    profile(principal, valuationCurrency) {
      const actor = actorOf(principal, 'grow_profile');
      if ('errorCode' in actor) {
        return actor;
      }
      peg.openGraph(actor, principal.identityId, principal.customerId);
      const profile = unwrap(peg.getGrowProfile(actor, principal.identityId, valuationCurrency), 'grow_profile');
      if (profile && typeof profile === 'object' && 'errorCode' in profile) {
        return profile;
      }
      return attachValuation(profile as ValuedBody, valuationCurrency);
    },
    snapshot(principal, valuationCurrency) {
      const actor = actorOf(principal, 'grow_snapshot');
      if ('errorCode' in actor) {
        return actor;
      }
      peg.openGraph(actor, principal.identityId, principal.customerId);
      const snapshot = unwrap(
        peg.getFinancialSnapshot(actor, principal.identityId, valuationCurrency),
        'grow_snapshot',
      );
      if (snapshot && typeof snapshot === 'object' && 'errorCode' in snapshot) {
        return snapshot;
      }
      return attachValuation(snapshot as ValuedBody, valuationCurrency);
    },
    listGoals(principal) {
      const actor = actorOf(principal, 'grow_goals');
      if ('errorCode' in actor) {
        return actor;
      }
      peg.openGraph(actor, principal.identityId, principal.customerId);
      const snapshot = peg.getFinancialSnapshot(actor, principal.identityId);
      if (!snapshot.ok) {
        return mapFailure(snapshot.error, 'grow_goals');
      }
      return Object.freeze({ items: snapshot.value.financialGoals });
    },
    createGoal(principal, body, requestId) {
      const actor = actorOf(principal, requestId);
      if ('errorCode' in actor) {
        return actor;
      }
      const input: DeclaredGoalInput = {
        goalKind: String(body.goalKind ?? body.kind ?? 'CUSTOM') as GoalKind,
        label: String(body.name ?? body.label ?? 'Goal'),
        target: {
          minorUnits: String((body.targetAmount as { minorUnits?: string } | undefined)?.minorUnits ?? body.targetMinorUnits ?? '0'),
          currency: String((body.targetAmount as { currency?: string } | undefined)?.currency ?? body.currency ?? 'USD'),
        },
        priority: typeof body.priority === 'number' ? body.priority : 1,
        ...(typeof body.targetDate === 'string' ? { targetDate: body.targetDate as never } : {}),
        ...(typeof body.status === 'string' ? { status: body.status as GoalStatus } : {}),
      };
      return unwrap(peg.declareGoal(actor, principal.identityId, input), requestId);
    },
    patchGoal(principal, goalId, body, requestId) {
      const actor = actorOf(principal, requestId);
      if ('errorCode' in actor) {
        return actor;
      }
      return unwrap(
        peg.updateGoal(actor, principal.identityId, asEconomicNodeId(goalId), {
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(typeof body.status === 'string' ? { status: body.status as GoalStatus } : {}),
          ...(typeof body.priority === 'number' ? { priority: body.priority } : {}),
        }),
        requestId,
      );
    },
    insights(principal) {
      const actor = actorOf(principal, 'grow_insights');
      if ('errorCode' in actor) {
        return actor;
      }
      peg.openGraph(actor, principal.identityId, principal.customerId);
      const rows = peg.getInsights(actor, principal.identityId);
      if (!rows.ok) {
        return mapFailure(rows.error, 'grow_insights');
      }
      return Object.freeze({ items: rows.value });
    },
    suitability(principal) {
      const actor = actorOf(principal, 'grow_suitability');
      if ('errorCode' in actor) {
        return actor;
      }
      return unwrap(peg.getSuitability(actor, principal.identityId), 'grow_suitability');
    },
    submitSuitability(principal, body, requestId) {
      const actor = actorOf(principal, requestId);
      if ('errorCode' in actor) {
        return actor;
      }
      return unwrap(
        peg.recordSuitability(actor, principal.identityId, {
          riskTolerance: (body.riskTolerance as never) ?? 'MODERATE',
          liquidReserveMonths: typeof body.liquidReserveMonths === 'number' ? body.liquidReserveMonths : 3,
          knownNearTermNeed: body.knownNearTermNeed === true,
          investmentHorizonYears: typeof body.investmentHorizonYears === 'number' ? body.investmentHorizonYears : 5,
          expectedWithdrawalYears: typeof body.expectedWithdrawalYears === 'number' ? body.expectedWithdrawalYears : 5,
          investmentExperience: (body.investmentExperience as never) ?? 'LIMITED',
          lossSensitivity: (body.lossSensitivity as never) ?? 'MODERATE',
          jurisdiction: principal.jurisdiction,
          ...(typeof body.largestPositionShareBps === 'number'
            ? { largestPositionShareBps: body.largestPositionShareBps }
            : {}),
        }),
        requestId,
      );
    },
    declareAssumption(principal, body, requestId) {
      const actor = actorOf(principal, requestId);
      if ('errorCode' in actor) {
        return actor;
      }
      const kind = String(body.kind ?? '');
      if (kind === 'BALANCE_OVERRIDE' || kind === 'ACCOUNT_BALANCE') {
        return peg.overrideAuthoritativeBalance(actor, principal.identityId, {
          accountId: String(body.accountId ?? ''),
          amount: { minorUnits: String(body.minorUnits ?? '0'), currency: String(body.currency ?? 'USD') },
        }).ok
          ? { ok: true }
          : mapFailure({ code: 'AUTHORITATIVE_FACT_IMMUTABLE', message: 'user cannot change a SunRey account balance' }, requestId);
      }
      if (kind === 'INCOME') {
        return unwrap(
          peg.declareIncomeSource(actor, principal.identityId, {
            incomeKind: (body.incomeKind as never) ?? 'OTHER',
            label: String(body.label ?? 'Income'),
            ...(body.estimatedAmount ? { estimatedAmount: body.estimatedAmount as never } : {}),
          }),
          requestId,
        );
      }
      if (kind === 'ASSET') {
        return unwrap(
          peg.declareAsset(actor, principal.identityId, {
            assetKind: (body.assetKind as never) ?? 'OTHER',
            label: String(body.label ?? 'Asset'),
            ...(body.estimatedValue ? { estimatedValue: body.estimatedValue as never } : {}),
          }),
          requestId,
        );
      }
      if (kind === 'LIABILITY') {
        return unwrap(
          peg.declareLiability(actor, principal.identityId, {
            liabilityKind: (body.liabilityKind as never) ?? 'OTHER',
            label: String(body.label ?? 'Liability'),
            ...(body.estimatedBalance ? { estimatedBalance: body.estimatedBalance as never } : {}),
          }),
          requestId,
        );
      }
      return unwrap(
        peg.declarePreference(actor, principal.identityId, {
          key: String(body.key ?? 'preference'),
          value: String(body.value ?? ''),
        }),
        requestId,
      );
    },
    correctClassification(principal, body, requestId) {
      const actor = actorOf(principal, requestId);
      if ('errorCode' in actor) {
        return actor;
      }
      return unwrap(
        peg.correctActivityClassification(actor, principal.identityId, {
          sourceEventId: String(body.sourceEventId ?? ''),
          classification: (body.classification as never) ?? 'UNKNOWN',
          ...(body.counterpart ? { counterpart: body.counterpart as never } : {}),
        }),
        requestId,
      );
    },
    history(principal, series) {
      const actor = actorOf(principal, 'grow_history');
      if ('errorCode' in actor) {
        return actor;
      }
      const rows = peg.getHistory(actor, principal.identityId, series as never);
      if (!rows.ok) {
        return mapFailure(rows.error, 'grow_history');
      }
      return Object.freeze({ items: rows.value });
    },
    agentProfile(principal) {
      const actor = actorOf(principal, 'grow_agent');
      if ('errorCode' in actor) {
        return actor;
      }
      return unwrap(peg.getAgentProfile(actor, principal.identityId, null), 'grow_agent');
    },
  };
}
