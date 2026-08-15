import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import type { PolicyRegistry } from '../../kernel/src/policy/index.ts';
import { asRegulatoryReadinessAssessmentId } from './ids.ts';
import type { MissingRequirement, RegulatoryProductReadiness } from './types.ts';
import type { ReadinessState } from './taxonomy.ts';

function assessment(input: {
  readonly kind: RegulatoryProductReadiness['kind'];
  readonly subject: string;
  readonly jurisdiction: string;
  readonly legalEntityId: string;
  readonly state: ReadinessState;
  readonly missing: readonly MissingRequirement[];
  readonly unknownLegalFacts: readonly string[];
  readonly at: UtcInstant;
}): RegulatoryProductReadiness {
  return Object.freeze({
    assessmentId: asRegulatoryReadinessAssessmentId(`rra_${randomUUID().replaceAll('-', '')}`),
    kind: input.kind,
    subject: input.subject,
    jurisdiction: input.jurisdiction,
    legalEntityId: input.legalEntityId,
    state: input.state,
    missingRequirements: Object.freeze([...input.missing]),
    unknownLegalFacts: Object.freeze([...input.unknownLegalFacts]),
    assumptions: Object.freeze([]),
    legalReviewStatus: 'RESEARCH_REQUIRED',
    forbiddenClaims: Object.freeze([]),
    simulationOnly: true,
    liveActivationPermitted: false,
    assessedAt: input.at,
  });
}

export function assessProductReadiness(input: {
  readonly registry: PolicyRegistry;
  readonly productId: string;
  readonly legalEntityId: string;
  readonly jurisdiction: string;
  readonly actionType: string;
  readonly at: UtcInstant;
}): RegulatoryProductReadiness {
  const binding = input.registry.getProductBinding(input.productId);
  const missing: MissingRequirement[] = [];
  const unknown: string[] = [];
  if (!binding) {
    return assessment({
      kind: 'PRODUCT',
      subject: input.productId,
      jurisdiction: input.jurisdiction,
      legalEntityId: input.legalEntityId,
      state: 'TECHNICAL_GAP',
      missing: [
        {
          code: 'PRODUCT_BINDING_MISSING',
          detail: 'no simulation product binding',
          legalReviewStatus: 'RESEARCH_REQUIRED',
        },
      ],
      unknownLegalFacts: ['product offering legal basis'],
      at: input.at,
    });
  }
  const capability =
    input.registry.findCapability({
      legalEntityId: input.legalEntityId,
      actionType: input.actionType,
      productId: input.productId,
      environment: 'simulation',
    }) ?? input.registry.getCapability(binding.requiredCapabilityId);
  if (!capability || !capability.enabled) {
    return assessment({
      kind: 'PRODUCT',
      subject: input.productId,
      jurisdiction: input.jurisdiction,
      legalEntityId: input.legalEntityId,
      state: 'NOT_SUPPORTED',
      missing: [
        {
          code: 'LEGAL_ENTITY_CAPABILITY_DISABLED',
          detail: 'simulation capability is missing or disabled',
          legalReviewStatus: 'RESEARCH_REQUIRED',
        },
      ],
      unknownLegalFacts: ['license / legal-entity authority'],
      at: input.at,
    });
  }
  if (capability.legalReviewStatus !== 'CONFIRMED_BY_COUNSEL') {
    missing.push({
      code: 'LEGAL_REVIEW_GAP',
      detail: 'capability legal review is not counsel-confirmed',
      legalReviewStatus: capability.legalReviewStatus,
    });
    unknown.push('counsel confirmation of product offering');
  }
  const source = capability.sourceReference
    ? input.registry.getSource(capability.sourceReference)
    : undefined;
  if (!source) {
    missing.push({
      code: 'SOURCE_ABSENT',
      detail: 'no source registry citation for the capability',
      legalReviewStatus: 'RESEARCH_REQUIRED',
    });
  }
  const state: ReadinessState =
    missing.some((row) => row.code === 'LEGAL_REVIEW_GAP')
      ? 'COUNSEL_REVIEW_REQUIRED'
      : missing.length > 0
        ? 'RESEARCH_REQUIRED'
        : 'SIMULATION_READY';
  return assessment({
    kind: 'PRODUCT',
    subject: input.productId,
    jurisdiction: input.jurisdiction,
    legalEntityId: input.legalEntityId,
    state,
    missing,
    unknownLegalFacts: unknown,
    at: input.at,
  });
}

export function assessCorridorReadiness(input: {
  readonly registry: PolicyRegistry;
  readonly corridorId: string;
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly sourceCurrency: string;
  readonly destinationCurrency: string;
  readonly legalEntityId: string;
  readonly simulationEnabled: boolean;
  readonly treasuryRouteKnown: boolean;
  readonly at: UtcInstant;
}): RegulatoryProductReadiness {
  const missing: MissingRequirement[] = [];
  const unknown: string[] = ['corridor legal opinion', 'sanctions / AML threshold confirmation'];
  if (!input.simulationEnabled) {
    return assessment({
      kind: 'CORRIDOR',
      subject: input.corridorId,
      jurisdiction: `${input.sourceCountry}->${input.destinationCountry}`,
      legalEntityId: input.legalEntityId,
      state: 'NOT_SUPPORTED',
      missing: [
        {
          code: 'CORRIDOR_NOT_SIMULATION_ENABLED',
          detail: 'corridor is not ACTIVE_SIMULATION',
          legalReviewStatus: 'RESEARCH_REQUIRED',
        },
      ],
      unknownLegalFacts: unknown,
      at: input.at,
    });
  }
  const capability = input.registry.findCapability({
    legalEntityId: input.legalEntityId,
    actionType: 'INITIATE_PAYMENT',
    environment: 'simulation',
  });
  if (!capability?.enabled) {
    missing.push({
      code: 'PAYMENT_CAPABILITY_MISSING',
      detail: 'legal entity cannot initiate simulation payments',
      legalReviewStatus: 'RESEARCH_REQUIRED',
    });
  }
  if (!input.treasuryRouteKnown) {
    missing.push({
      code: 'TREASURY_ROUTE_UNKNOWN',
      detail: 'no treasury route reference supplied for readiness analysis',
      legalReviewStatus: 'RESEARCH_REQUIRED',
    });
  }
  missing.push({
    code: 'LEGAL_REVIEW_GAP',
    detail: 'no counsel-confirmed corridor rule exists',
    legalReviewStatus: 'RESEARCH_REQUIRED',
  });
  return assessment({
    kind: 'CORRIDOR',
    subject: `${input.corridorId}:${input.sourceCurrency}->${input.destinationCurrency}`,
    jurisdiction: `${input.sourceCountry}->${input.destinationCountry}`,
    legalEntityId: input.legalEntityId,
    state: 'COUNSEL_REVIEW_REQUIRED',
    missing,
    unknownLegalFacts: unknown,
    at: input.at,
  });
}

export function assessCardReadiness(input: {
  readonly kind: 'CARD' | 'WALLET' | 'MERCHANT';
  readonly programId: string;
  readonly legalEntityId: string;
  readonly jurisdiction: string;
  readonly simulationEnabled: boolean;
  readonly at: UtcInstant;
}): RegulatoryProductReadiness {
  const unknown =
    input.kind === 'WALLET'
      ? ['Apple certification', 'Google certification']
      : input.kind === 'MERCHANT'
        ? ['acquiring permission', 'PCI certification']
        : ['card-network sponsorship', 'issuer license'];
  if (!input.simulationEnabled) {
    return assessment({
      kind: input.kind,
      subject: input.programId,
      jurisdiction: input.jurisdiction,
      legalEntityId: input.legalEntityId,
      state: 'NOT_SUPPORTED',
      missing: [
        {
          code: 'PROGRAM_NOT_SIMULATION_ENABLED',
          detail: 'card/wallet/acceptance program is not simulation-enabled',
          legalReviewStatus: 'RESEARCH_REQUIRED',
        },
      ],
      unknownLegalFacts: unknown,
      at: input.at,
    });
  }
  return assessment({
    kind: input.kind,
    subject: input.programId,
    jurisdiction: input.jurisdiction,
    legalEntityId: input.legalEntityId,
    state: 'RESEARCH_REQUIRED',
    missing: [
      {
        code: 'EXTERNAL_APPROVAL_ABSENT',
        detail: 'no network, wallet, acquiring, or PCI approval evidence exists',
        legalReviewStatus: 'RESEARCH_REQUIRED',
      },
    ],
    unknownLegalFacts: unknown,
    at: input.at,
  });
}

export function assessInvestmentReadiness(input: {
  readonly subject: string;
  readonly jurisdiction: string;
  readonly legalEntityId: string;
  readonly at: UtcInstant;
}): RegulatoryProductReadiness {
  return assessment({
    kind: 'INVESTMENT',
    subject: input.subject,
    jurisdiction: input.jurisdiction,
    legalEntityId: input.legalEntityId,
    state: 'DEPENDENCY_NOT_IMPLEMENTED',
    missing: [
      {
        code: 'INVESTMENTS_NOT_IMPLEMENTED',
        detail: 'Chunk 19 owns investments. This chunk does not invent investment regulation.',
        legalReviewStatus: 'RESEARCH_REQUIRED',
      },
    ],
    unknownLegalFacts: ['investment regulatory perimeter'],
    at: input.at,
  });
}
