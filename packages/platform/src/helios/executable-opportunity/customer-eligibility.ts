import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { evaluateOpportunityEligibility } from '../../growth/opportunity/eligibility.ts';
import type { OpportunityDetectorKind } from '../../growth/opportunity/taxonomy.ts';
import type { OpportunityDiscoveryContext, ProductCapability } from '../../growth/opportunity/types.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import { mandateBindingRefFromCompiled, validateMandateBinding } from '../mandate-binding.ts';
import type { EconomicWorkOrder } from '../types.ts';
import { qualificationDecisionIdFor } from './ids.ts';
import type { CustomerEligibilityDecision } from './types.ts';
import type { QualificationReasonCode } from './taxonomy.ts';

export function evaluateCustomerEligibility(input: {
  readonly executableOpportunityId: string;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly workOrder: EconomicWorkOrder | null;
  readonly mandate: CompiledEconomicMandate | null;
  readonly jurisdiction: Jurisdiction;
  readonly context: OpportunityDiscoveryContext;
  readonly detectorSummary: {
    readonly detector: OpportunityDetectorKind;
    readonly productId?: string;
    readonly estimatedImpact?: { readonly minorUnits: string; readonly currency: string };
    readonly riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'UNCERTAIN_MARKET';
    readonly liquidityImpact: 'INCREASES' | 'DECREASES' | 'NEUTRAL';
  };
  readonly now: UtcInstant;
}): CustomerEligibilityDecision {
  const reasonCodes: QualificationReasonCode[] = [];
  const failedChecks: string[] = [];

  if (input.workOrder && input.workOrder.customerId !== input.customerId) {
    return finalize(false, ['CUSTOMER_MISMATCH'], ['customer_mismatch'], input);
  }
  if (input.workOrder && input.workOrder.subjectId !== input.subjectId) {
    return finalize(false, ['CUSTOMER_MISMATCH'], ['subject_mismatch'], input);
  }
  if (!input.workOrder || input.workOrder.state !== 'ACTIVE') {
    failedChecks.push('work_order');
    reasonCodes.push('WORK_ORDER_INACTIVE');
  }
  if (!input.mandate || input.mandate.state !== 'ACTIVE') {
    failedChecks.push('mandate');
    reasonCodes.push('MANDATE_INACTIVE');
  } else {
    const mandateRef = mandateBindingRefFromCompiled(input.mandate, input.customerId, input.now);
    const mandateCheck = validateMandateBinding({
      mandate: input.mandate,
      mandateRef,
      customerId: input.customerId,
      now: input.now,
    });
    if (mandateCheck) {
      failedChecks.push('mandate_binding');
      reasonCodes.push('MANDATE_RESTRICTED');
    }
  }

  const product = input.context.products.find((item) => item.productId === input.detectorSummary.productId);
  const eligibility = evaluateOpportunityEligibility({
    finding: {
      detector: input.detectorSummary.detector,
      title: 'executable candidate',
      summary: 'executable candidate eligibility',
      source: 'PUBLIC_MARKET_RESEARCH',
      currency: input.detectorSummary.estimatedImpact?.currency ?? 'USD',
      ...(input.detectorSummary.estimatedImpact ? { estimatedImpact: input.detectorSummary.estimatedImpact } : {}),
      riskLevel: input.detectorSummary.riskLevel,
      liquidityImpact: input.detectorSummary.liquidityImpact,
      timeHorizon: 'MEDIUM_TERM',
      fees: Object.freeze([]),
      dependencies: Object.freeze([]),
      goalIds: Object.freeze([]),
      evidence: Object.freeze({
        factRefs: Object.freeze([]),
        detector: input.detectorSummary.detector,
        notes: Object.freeze([]),
      }),
      confidence: 0.5,
      urgency: 0.5,
      assumptions: Object.freeze([]),
      impactKind: 'NON_QUANTIFIED_BENEFIT',
      fingerprintAnchor: 'executable',
      ...(input.detectorSummary.productId ? { productId: input.detectorSummary.productId } : {}),
    },
    context: input.context,
    ...(input.mandate ? { mandate: input.mandate } : {}),
  });

  if (!eligibility.eligible) {
    failedChecks.push(...eligibility.failedChecks);
    if (eligibility.failedChecks.includes('mandate')) {
      reasonCodes.push('MANDATE_RESTRICTED');
    } else if (eligibility.failedChecks.includes('minimum_amount')) {
      reasonCodes.push('MINIMUM_SIZE_FAILURE');
    } else if (eligibility.failedChecks.includes('product')) {
      reasonCodes.push('PRODUCT_CAPABILITY_DENIED');
    } else if (eligibility.failedChecks.includes('jurisdiction')) {
      reasonCodes.push('JURISDICTION_DENIED');
    } else if (eligibility.failedChecks.includes('account')) {
      reasonCodes.push('ACCOUNT_CAPABILITY_DENIED');
    } else {
      reasonCodes.push('CUSTOMER_INELIGIBLE');
    }
  }

  checkProductCapability(product, failedChecks, reasonCodes);

  const eligible = failedChecks.length === 0;
  if (eligible) {
    reasonCodes.push('OK');
  }
  return finalize(eligible, reasonCodes, failedChecks, input);
}

function checkProductCapability(
  product: ProductCapability | undefined,
  failedChecks: string[],
  reasonCodes: QualificationReasonCode[],
): void {
  if (!product) {
    failedChecks.push('product');
    reasonCodes.push('PRODUCT_CAPABILITY_DENIED');
    return;
  }
  if (!product.available) {
    failedChecks.push('product');
    reasonCodes.push('PRODUCT_CAPABILITY_DENIED');
  }
  if (!product.providerAvailable) {
    failedChecks.push('provider');
    reasonCodes.push('ROUTE_UNAVAILABLE');
  }
}

function finalize(
  eligible: boolean,
  reasonCodes: QualificationReasonCode[],
  failedChecks: string[],
  input: {
    readonly executableOpportunityId: string;
    readonly workOrder: EconomicWorkOrder | null;
    readonly mandate: CompiledEconomicMandate | null;
    readonly now: UtcInstant;
  },
): CustomerEligibilityDecision {
  return Object.freeze({
    decisionId: qualificationDecisionIdFor(input.executableOpportunityId, 'eligibility'),
    eligible,
    reasonCodes: Object.freeze([...new Set(reasonCodes)]),
    failedChecks: Object.freeze(failedChecks),
    workOrderState: input.workOrder?.state ?? 'DRAFT',
    mandateState: input.mandate?.state ?? 'DRAFT',
    decidedAt: input.now,
  });
}
