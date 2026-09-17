import type { UtcInstant } from '../../../../domain/src/time.ts';
import { revalidateAuthority } from '../authority-binding.ts';
import { validateApprovalBinding } from '../approval-binding.ts';
import { verifyCandidateEvidence } from '../executable-opportunity/evidence-verification.ts';
import { termsStillValid } from '../executable-opportunity/terms.ts';
import type { QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import { DECISION_VALIDITY_POLICY_VERSION } from './taxonomy.ts';
import { assessEconomicEdge, detectMaterialTermsChange } from './economic-drift.ts';
import type {
  ComponentCheckResult,
  EnvelopeEvaluationContext,
  EnvelopeEvaluationPorts,
} from './types.ts';
import type { EnvelopeReasonCode } from './taxonomy.ts';

const QUOTE_VALIDITY_SECONDS = 30;
const ECONOMIC_REPORT_VALIDITY_SECONDS = 86_400;
const MANDATE_VALIDITY_SECONDS = 3_600;
const CAPSULE_POLICY_VALIDITY_SECONDS = 7_200;
const ROUTE_VALIDITY_SECONDS = 60;

function componentCheck(
  component: ComponentCheckResult['component'],
  input: {
    readonly status: ComponentCheckResult['status'];
    readonly reasonCodes: readonly EnvelopeReasonCode[];
    readonly now: UtcInstant;
    readonly validUntilSeconds: number;
    readonly inputRefs?: readonly string[];
    readonly outputRef?: string | null;
    readonly critical?: boolean;
  },
): ComponentCheckResult {
  const validUntil = new Date(
    Date.parse(input.now) + input.validUntilSeconds * 1000,
  ).toISOString() as UtcInstant;
  return Object.freeze({
    component,
    status: input.status,
    reasonCodes: Object.freeze([...input.reasonCodes]),
    inputRefs: Object.freeze([...(input.inputRefs ?? [])]),
    outputRef: input.outputRef ?? null,
    policyVersion: DECISION_VALIDITY_POLICY_VERSION,
    evaluatedAt: input.now,
    validUntil,
    critical: input.critical ?? true,
  });
}

export function evaluateEvidenceValidity(
  ctx: EnvelopeEvaluationContext,
  ports: EnvelopeEvaluationPorts,
): ComponentCheckResult {
  const decision = verifyCandidateEvidence({
    executableOpportunityId: ctx.executableOpportunityId ?? ctx.candidate.candidateId,
    evidenceRefs: ctx.candidate.evidenceRefs,
    registry: ports.evidenceRegistry,
    now: ctx.now,
    customerId: ctx.candidate.customerId,
    subjectId: ctx.candidate.subjectId,
  });
  const status = decision.verified ? 'VALID' : 'INVALID';
  const reasonCodes: EnvelopeReasonCode[] = decision.verified
    ? ['OK']
    : mapEvidenceReasons(decision.reasonCodes);
  return componentCheck('EVIDENCE_VALIDITY', {
    status,
    reasonCodes,
    now: ctx.now,
    validUntilSeconds: ECONOMIC_REPORT_VALIDITY_SECONDS,
    inputRefs: ctx.candidate.evidenceRefs,
    outputRef: decision.decisionId,
  });
}

export function evaluateMarketTerms(
  ctx: EnvelopeEvaluationContext,
  ports: EnvelopeEvaluationPorts,
  baselineTerms: QualificationTermsSnapshot | null,
): ComponentCheckResult {
  if (!ctx.route) {
    return componentCheck('MARKET_TERMS', {
      status: 'UNKNOWN',
      reasonCodes: ['CRITICAL_STATE_UNKNOWN'],
      now: ctx.now,
      validUntilSeconds: QUOTE_VALIDITY_SECONDS,
    });
  }
  const current = ports.marketTerms.currentTerms({ route: ctx.route, now: ctx.now });
  if ('ok' in current && current.ok === false) {
    return componentCheck('MARKET_TERMS', {
      status: 'INVALID',
      reasonCodes: ['MARKET_TERMS_MATERIAL_CHANGE'],
      now: ctx.now,
      validUntilSeconds: QUOTE_VALIDITY_SECONDS,
      inputRefs: Object.freeze([ctx.route.routeId]),
    });
  }
  const terms = current as QualificationTermsSnapshot;
  const drift = detectMaterialTermsChange(baselineTerms ?? ctx.terms, terms);
  const baselineSpreadBps = baselineTerms?.spreadBps ?? ctx.terms?.spreadBps;
  const edge = assessEconomicEdge({
    expectedEdgeBps: ctx.recommendation.expectedEdgeBps,
    terms,
    ...(baselineSpreadBps !== undefined ? { baselineSpreadBps } : {}),
  });
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (drift) {
    reasonCodes.push(drift);
  }
  if (!edge.economicallyValid) {
    reasonCodes.push(...edge.reasonCodes.filter((c) => c !== 'OK'));
  }
  const status =
    reasonCodes.some((c) => c === 'TRANSACTION_COST_DESTROYS_EDGE' || c === 'MARKET_SPREAD_WIDENED')
      ? 'INVALID'
      : drift
        ? 'INVALID'
        : 'VALID';
  return componentCheck('MARKET_TERMS', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: QUOTE_VALIDITY_SECONDS,
    inputRefs: Object.freeze([terms.snapshotId]),
    outputRef: terms.snapshotId,
  });
}

export function evaluateLiquidityCapacity(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const available = BigInt(ctx.availableFundsMinor);
  const reserved = BigInt(ctx.reservedFundsMinor);
  const deployed = BigInt(ctx.deployedCapitalMinor);
  const capacity = BigInt(ctx.strategyCapacityMinor);
  const proposed = BigInt(ctx.proposedNotionalMinor);
  const free = available - reserved - deployed;
  const reasonCodes: EnvelopeReasonCode[] = [];

  if (ctx.terms?.liquidityState === 'THIN') {
    reasonCodes.push('INSUFFICIENT_LIQUIDITY');
  }
  if (proposed > free) {
    reasonCodes.push('CAPITAL_UNAVAILABLE');
  }
  if (proposed > capacity) {
    reasonCodes.push('CAPACITY_EXCEEDED');
  }
  const status = reasonCodes.length > 0 ? 'INVALID' : 'VALID';
  return componentCheck('LIQUIDITY_CAPACITY', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: QUOTE_VALIDITY_SECONDS,
    inputRefs: Object.freeze([
      `available:${ctx.availableFundsMinor}`,
      `reserved:${ctx.reservedFundsMinor}`,
      `deployed:${ctx.deployedCapitalMinor}`,
    ]),
  });
}

export function evaluateMarketState(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (ctx.venueSession === 'CLOSED') {
    reasonCodes.push('VENUE_CLOSED');
  }
  if (!ctx.instrumentActive) {
    reasonCodes.push('INSTRUMENT_INACTIVE');
  }
  if (ctx.instrumentHalted) {
    reasonCodes.push('INSTRUMENT_HALTED');
  }
  const status = reasonCodes.length > 0 ? 'INVALID' : 'VALID';
  return componentCheck('MARKET_STATE', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: QUOTE_VALIDITY_SECONDS,
    inputRefs: Object.freeze([`venue:${ctx.venueSession}`]),
  });
}

export function evaluateCustomerAccountState(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (!ctx.workOrder || ctx.workOrder.state !== 'ACTIVE') {
    reasonCodes.push('ACCOUNT_INACTIVE');
  }
  const available = BigInt(ctx.availableFundsMinor);
  const reserved = BigInt(ctx.reservedFundsMinor);
  const proposed = BigInt(ctx.proposedNotionalMinor);
  if (proposed > available - reserved) {
    reasonCodes.push('ACCOUNT_FUNDS_INSUFFICIENT');
  }
  const status = reasonCodes.length > 0 ? 'INVALID' : 'VALID';
  return componentCheck('CUSTOMER_ACCOUNT_STATE', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: QUOTE_VALIDITY_SECONDS,
  });
}

export function evaluateMandateApproval(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (!ctx.mandate || ctx.mandate.state !== 'ACTIVE') {
    reasonCodes.push('MANDATE_REVOKED');
  }
  if (ctx.authorityBinding) {
    const revalidated = revalidateAuthority(ctx.authorityBinding, ctx.mandate ?? undefined, false);
    if (revalidated.revalidationState === 'REVOKED') {
      reasonCodes.push('MANDATE_REVOKED');
    } else if (revalidated.revalidationState === 'STALE_MANDATE') {
      reasonCodes.push('APPROVAL_EXPIRED');
    } else if (revalidated.revalidationState !== 'VALID') {
      reasonCodes.push('APPROVAL_REVOKED');
    }
  }
  if (ctx.workOrder && ctx.workOrder.requiredApprovalClass !== 'NONE') {
    const approvalFailure = validateApprovalBinding({
      approvalRef: ctx.workOrder.approvalRef,
      requiredApprovalClass: ctx.workOrder.requiredApprovalClass,
      customerId: ctx.workOrder.customerId,
      scope: ctx.workOrder.effectiveScope ?? ctx.workOrder.requestedScope,
      now: ctx.now,
    });
    if (approvalFailure?.code === 'APPROVAL_EXPIRED') {
      reasonCodes.push('APPROVAL_EXPIRED');
    } else if (approvalFailure) {
      reasonCodes.push('APPROVAL_REVOKED');
    }
  }
  const status = reasonCodes.length > 0 ? 'INVALID' : 'VALID';
  return componentCheck('MANDATE_APPROVAL', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: MANDATE_VALIDITY_SECONDS,
    inputRefs: Object.freeze([ctx.mandate?.mandateId ?? 'none']),
  });
}

export function evaluateStrategyQualification(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const capsule = ctx.capsule;
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (capsule.promotionState === 'REVOKED') {
    reasonCodes.push('STRATEGY_CAPSULE_REVOKED');
  }
  if (capsule.promotionState === 'EXPIRED') {
    reasonCodes.push('STRATEGY_CAPSULE_EXPIRED');
  }
  if (capsule.qualificationState !== 'QUALIFIED') {
    reasonCodes.push('STRATEGY_CAPSULE_UNQUALIFIED');
  }
  if (capsule.validUntil && Date.parse(ctx.now) > Date.parse(capsule.validUntil)) {
    reasonCodes.push('STRATEGY_CAPSULE_EXPIRED');
  }
  const status = reasonCodes.length > 0 ? 'INVALID' : 'VALID';
  return componentCheck('STRATEGY_QUALIFICATION', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: CAPSULE_POLICY_VALIDITY_SECONDS,
    inputRefs: Object.freeze([capsule.capsuleId, capsule.version, capsule.contentHash]),
  });
}

export function evaluateRiskContext(
  ctx: EnvelopeEvaluationContext,
  ports: EnvelopeEvaluationPorts,
): ComponentCheckResult {
  if (!ports.riskPort) {
    return componentCheck('RISK_CONTEXT', {
      status: 'UNKNOWN',
      reasonCodes: ['CRITICAL_STATE_UNKNOWN'],
      now: ctx.now,
      validUntilSeconds: QUOTE_VALIDITY_SECONDS,
      critical: true,
    });
  }
  const assessment = ports.riskPort.assess({
    proposedNotionalMinor: BigInt(ctx.proposedNotionalMinor),
    instrumentId: ctx.candidate.instrumentCandidate.instrumentId,
    customerId: ctx.candidate.customerId,
  });
  let status: ComponentCheckResult['status'] = 'VALID';
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (assessment.outcome === 'BLOCK') {
    status = 'INVALID';
    reasonCodes.push('RISK_REFUSED');
  } else if (assessment.outcome === 'REQUIRE_REVIEW') {
    status = 'REVIEW_REQUIRED';
    reasonCodes.push('RISK_REVIEW_REQUIRED');
  } else if (assessment.outcome === 'UNKNOWN') {
    status = 'UNKNOWN';
    reasonCodes.push('CRITICAL_STATE_UNKNOWN');
  } else {
    reasonCodes.push('OK');
  }
  return componentCheck('RISK_CONTEXT', {
    status,
    reasonCodes: Object.freeze(reasonCodes),
    now: ctx.now,
    validUntilSeconds: QUOTE_VALIDITY_SECONDS,
    outputRef: assessment.assessmentId ?? null,
    critical: true,
  });
}

export function evaluateComplianceJurisdiction(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const status = ctx.jurisdictionCapabilityEnabled ? 'VALID' : 'INVALID';
  return componentCheck('COMPLIANCE_JURISDICTION', {
    status,
    reasonCodes: Object.freeze(
      ctx.jurisdictionCapabilityEnabled ? ['OK'] : ['JURISDICTION_CAPABILITY_DISABLED'],
    ),
    now: ctx.now,
    validUntilSeconds: MANDATE_VALIDITY_SECONDS,
    inputRefs: Object.freeze([ctx.jurisdiction]),
  });
}

export function evaluateProviderRoute(
  ctx: EnvelopeEvaluationContext,
  ports: EnvelopeEvaluationPorts,
): ComponentCheckResult {
  const route =
    ctx.route ??
    ports.routeRegistry.routeFor({
      productId: ctx.candidate.instrumentCandidate.productId,
      instrumentId: ctx.candidate.instrumentCandidate.instrumentId,
      jurisdiction: ctx.jurisdiction,
    });
  if (!route) {
    return componentCheck('PROVIDER_ROUTE', {
      status: 'INVALID',
      reasonCodes: ['PROVIDER_ROUTE_MISCONFIGURED'],
      now: ctx.now,
      validUntilSeconds: ROUTE_VALIDITY_SECONDS,
    });
  }
  const unavailable =
    route.availability === 'UNAVAILABLE' || route.availability === 'UNKNOWN';
  return componentCheck('PROVIDER_ROUTE', {
    status: unavailable ? 'INVALID' : 'VALID',
    reasonCodes: Object.freeze(unavailable ? ['PROVIDER_ROUTE_UNAVAILABLE'] : ['OK']),
    now: ctx.now,
    validUntilSeconds: ROUTE_VALIDITY_SECONDS,
    inputRefs: Object.freeze([route.routeId]),
    outputRef: route.routeId,
  });
}

export function evaluateModelResearchValidity(ctx: EnvelopeEvaluationContext): ComponentCheckResult {
  const reasonCodes: EnvelopeReasonCode[] = [];
  if (!ctx.modelVersionQualified) {
    reasonCodes.push('MODEL_VERSION_UNQUALIFIED');
  }
  if (ctx.researchExpiresAt && Date.parse(ctx.now) > Date.parse(ctx.researchExpiresAt)) {
    reasonCodes.push('RESEARCH_EXPIRED');
  }
  const status = reasonCodes.length > 0 ? 'INVALID' : 'VALID';
  return componentCheck('MODEL_RESEARCH_VALIDITY', {
    status,
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : ['OK']),
    now: ctx.now,
    validUntilSeconds: ECONOMIC_REPORT_VALIDITY_SECONDS,
    critical: ctx.capsule.modelDependencies.length > 0,
  });
}

export function evaluateAllComponents(
  ctx: EnvelopeEvaluationContext,
  ports: EnvelopeEvaluationPorts,
  baselineTerms: QualificationTermsSnapshot | null = null,
): readonly ComponentCheckResult[] {
  return Object.freeze([
    evaluateEvidenceValidity(ctx, ports),
    evaluateMarketTerms(ctx, ports, baselineTerms),
    evaluateLiquidityCapacity(ctx),
    evaluateMarketState(ctx),
    evaluateCustomerAccountState(ctx),
    evaluateMandateApproval(ctx),
    evaluateStrategyQualification(ctx),
    evaluateRiskContext(ctx, ports),
    evaluateComplianceJurisdiction(ctx),
    evaluateProviderRoute(ctx, ports),
    evaluateModelResearchValidity(ctx),
  ]);
}

function mapEvidenceReasons(codes: readonly string[]): EnvelopeReasonCode[] {
  const mapped: EnvelopeReasonCode[] = [];
  for (const code of codes) {
    if (code === 'EVIDENCE_STALE') {
      mapped.push('EVIDENCE_STALE');
    } else if (code === 'EVIDENCE_MISSING') {
      mapped.push('EVIDENCE_MISSING');
    } else if (code === 'EVIDENCE_ENTITLEMENT_DENIED') {
      mapped.push('EVIDENCE_ENTITLEMENT_DENIED');
    } else {
      mapped.push('EVIDENCE_MISSING');
    }
  }
  return mapped.length > 0 ? mapped : ['EVIDENCE_MISSING'];
}
