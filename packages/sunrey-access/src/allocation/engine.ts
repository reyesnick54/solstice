import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asAllocationDecisionId } from '../ids.ts';
import type { AllocationMechanism } from '../taxonomy.ts';
import {
  buildAccessQuote,
  collectTaggedInputs,
  detectForbiddenInputs,
  evaluateScarcity,
} from '../scarcity/engine.ts';
import type {
  AccessQuote,
  AllocationDecision,
  AllocationRequest,
  ForbiddenInputProbe,
  MechanismSelectionPolicy,
  ScarcityEvaluationInput,
  ScarcityRefusal,
} from '../scarcity/types.ts';
import {
  entitlementGrant,
  fixedAccessGrant,
  lotteryWins,
  marketGrant,
  queuePosition,
  deterministicLotteryScore,
} from './mechanisms.ts';
import { DEFAULT_MECHANISM_POLICY, regimeHintFromPolicy, selectMechanism } from './policy.ts';

export type AllocationEngineInput = {
  readonly scarcityInput: ScarcityEvaluationInput;
  readonly request: AllocationRequest;
  readonly policy?: MechanismSelectionPolicy;
  readonly configuredMechanism?: AllocationMechanism;
  readonly forbiddenProbe?: ForbiddenInputProbe;
  readonly lotteryThresholdBps?: bigint;
};

export type AllocationEngineResult = {
  readonly quote: AccessQuote;
  readonly decision: AllocationDecision;
};

export function decideAllocation(input: AllocationEngineInput): Result<AllocationEngineResult, ScarcityRefusal> {
  const policy = input.policy ?? DEFAULT_MECHANISM_POLICY;
  const forbidden = detectForbiddenInputs(input.forbiddenProbe ?? {});
  if (forbidden.length > 0) {
    return err({
      code: 'FORBIDDEN_INPUT_PRESENT',
      message: `forbidden allocation inputs present: ${forbidden.join(', ')}`,
      resourceId: input.scarcityInput.resourceId,
    });
  }

  const scarcityResult = evaluateScarcity(input.scarcityInput, {
    modelVersion: undefined,
    capacityMaxAgeMs: policy.capacityMaxAgeMs,
    forbiddenProbe: input.forbiddenProbe,
  });
  if (!scarcityResult.ok) {
    return scarcityResult;
  }

  const scarcity = scarcityResult.value;
  const regimeHint = regimeHintFromPolicy(policy);
  const mechanism = selectMechanism(policy, scarcity.band, regimeHint, input.configuredMechanism);
  const tagged = collectTaggedInputs(input.scarcityInput);
  const expiresAt = new Date(Date.parse(input.request.now) + policy.quoteTtlMs).toISOString();

  const allocationBasis = Object.freeze({
    mechanism,
    regimeHint,
    scarcityBand: scarcity.band,
    policyVersion: policy.policyVersion,
    rationale: Object.freeze([
      `regime=${regimeHint}`,
      `scarcity=${scarcity.band}`,
      `mechanism=${mechanism}`,
    ]),
  });

  const quote = buildAccessQuote({
    quoteId: `aq_${input.request.requestId}`,
    resourceId: input.scarcityInput.resourceId,
    scarcity,
    allocationBasis,
    marketInputs: tagged.marketInputs,
    policyInputs: tagged.policyInputs,
    expiresAt,
    evidenceRefs: input.scarcityInput.capacity.evidenceRefs,
  });

  if (policy.denyWhenUnavailable && scarcity.band === 'UNAVAILABLE') {
    return ok({
      quote,
      decision: buildDecision({
        request: input.request,
        policy,
        mechanism,
        outcome: 'DENIED',
        grantedUnits: 0n,
        reasons: ['zero verified availability'],
        quote,
        expiresAt,
      }),
    });
  }

  const decision = resolveMechanismOutcome({
    request: input.request,
    policy,
    mechanism,
    scarcity,
    quote,
    expiresAt,
    lotteryThresholdBps: input.lotteryThresholdBps ?? 2_500n,
  });

  return ok({ quote, decision });
}

function resolveMechanismOutcome(input: {
  readonly request: AllocationRequest;
  readonly policy: MechanismSelectionPolicy;
  readonly mechanism: AllocationMechanism;
  readonly scarcity: AccessQuote['scarcity'];
  readonly quote: AccessQuote;
  readonly expiresAt: string;
  readonly lotteryThresholdBps: bigint;
}): AllocationDecision {
  const { request, policy, mechanism, scarcity, quote, expiresAt, lotteryThresholdBps } = input;

  switch (mechanism) {
    case 'ENTITLEMENT': {
      const granted = entitlementGrant(request.requestedUnits, request.entitlementUnits);
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: granted > 0n ? 'GRANTED' : 'DENIED',
        grantedUnits: granted,
        reasons:
          granted > 0n
            ? ['entitlement units cover request']
            : ['insufficient entitlement units'],
        quote,
        expiresAt,
        extraInputs: { entitlementUnits: String(request.entitlementUnits ?? 0n) },
      });
    }
    case 'QUEUE': {
      const position = queuePosition(request.queueJoinOrder, policy.queueFairOrdering);
      const granted = scarcity.availableUnits >= request.requestedUnits ? request.requestedUnits : 0n;
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: granted > 0n ? 'GRANTED' : 'QUEUED',
        grantedUnits: granted,
        reasons:
          granted > 0n
            ? ['capacity available at queue head']
            : [`queued at position ${position?.toString() ?? 'unknown'}`],
        quote,
        expiresAt,
        extraInputs: { queuePosition: position?.toString() ?? null },
      });
    }
    case 'LOTTERY': {
      const seed = `${policy.lotterySeedNamespace ?? 'lottery'}|${request.lotterySeed ?? request.requestId}`;
      const score = deterministicLotteryScore(seed, request.subjectRef, request.resourceId);
      const wins = lotteryWins(score, lotteryThresholdBps);
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: wins ? 'LOTTERY_ELIGIBLE' : 'DENIED',
        grantedUnits: wins ? request.requestedUnits : 0n,
        reasons: wins
          ? [`lottery score ${score} within threshold ${lotteryThresholdBps}`]
          : [`lottery score ${score} exceeds threshold ${lotteryThresholdBps}`],
        quote,
        expiresAt,
        extraInputs: { lotteryScore: score.toString(), lotterySeed: seed },
      });
    }
    case 'FIXED_ACCESS_RATE': {
      const granted = fixedAccessGrant(request.requestedUnits, policy.fixedAccessRatePerHour);
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: granted > 0n ? 'RATE_LIMITED' : 'DENIED',
        grantedUnits: granted,
        reasons: [`fixed access rate grants ${granted} of ${request.requestedUnits}`],
        quote,
        expiresAt,
        extraInputs: { fixedAccessRatePerHour: String(policy.fixedAccessRatePerHour ?? 0n) },
      });
    }
    case 'AUCTION':
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: 'AUCTION_ELIGIBLE',
        grantedUnits: 0n,
        reasons: ['auction eligibility determined; no reservation execution in ACCESS-06'],
        quote,
        expiresAt,
      });
    case 'RFQ':
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: 'RFQ_REQUIRED',
        grantedUnits: 0n,
        reasons: ['request-for-quote required before grant'],
        quote,
        expiresAt,
      });
    case 'MARKET': {
      const market = marketGrant(
        request.requestedUnits,
        request.optionalMarketPurchase,
        request.offeredPriceMinor,
        policy.allowFinancialPurchase,
      );
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: market.granted > 0n ? 'MARKET_QUOTED' : market.financialConsidered ? 'DEFERRED' : 'DENIED',
        grantedUnits: market.granted,
        reasons: market.granted
          ? ['optional market purchase accepted at offered price']
          : market.financialConsidered
            ? ['financial purchase considered but price insufficient or absent']
            : ['market purchase not enabled for this product'],
        quote,
        expiresAt,
        extraInputs: {
          optionalMarketPurchase: request.optionalMarketPurchase ?? false,
          offeredPriceMinor: request.offeredPriceMinor?.toString() ?? null,
        },
      });
    }
    case 'PRIORITY_POLICY': {
      const score = request.priorityPolicyScore ?? 0n;
      const granted =
        score > 0n && scarcity.availableUnits >= request.requestedUnits ? request.requestedUnits : 0n;
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: granted > 0n ? 'GRANTED' : 'DEFERRED',
        grantedUnits: granted,
        reasons:
          granted > 0n
            ? [`priority policy score ${score} with available capacity`]
            : [`priority policy score ${score} insufficient or capacity constrained`],
        quote,
        expiresAt,
        extraInputs: { priorityPolicyScore: score.toString() },
      });
    }
    default:
      return buildDecision({
        request,
        policy,
        mechanism,
        outcome: 'DENIED',
        grantedUnits: 0n,
        reasons: ['unsupported mechanism'],
        quote,
        expiresAt,
      });
  }
}

function buildDecision(input: {
  readonly request: AllocationRequest;
  readonly policy: MechanismSelectionPolicy;
  readonly mechanism: AllocationMechanism;
  readonly outcome: AllocationDecision['outcome'];
  readonly grantedUnits: bigint;
  readonly reasons: readonly string[];
  readonly quote: AccessQuote;
  readonly expiresAt: string;
  readonly extraInputs?: Readonly<Record<string, string | number | boolean | null>>;
}): AllocationDecision {
  return Object.freeze({
    decisionId: asAllocationDecisionId(`ad_${input.request.requestId}`),
    mechanism: input.mechanism,
    policyVersion: input.policy.policyVersion,
    inputs: Object.freeze({
      requestId: input.request.requestId,
      subjectRef: input.request.subjectRef,
      resourceId: input.request.resourceId,
      requestedUnits: input.request.requestedUnits.toString(),
      jurisdiction: input.request.jurisdiction,
      productCode: input.request.productCode,
      scarcityBand: input.quote.scarcity.band,
      scarcityPressureBps: input.quote.scarcity.pressureBps,
      ...(input.extraInputs ?? {}),
    }),
    outcome: input.outcome,
    grantedUnits: input.grantedUnits,
    reasons: Object.freeze([...input.reasons]),
    expiration: input.expiresAt,
    evidenceReferences: Object.freeze([...input.quote.evidenceRefs]),
    quote: input.quote,
  });
}
