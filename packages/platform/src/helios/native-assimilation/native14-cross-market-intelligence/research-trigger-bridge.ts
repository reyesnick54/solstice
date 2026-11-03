import type { UtcInstant } from '@solstice/domain';
import type { ResearchMonitorTriggerEvent } from '../../open-source-integration/os07/research-monitor-contract.ts';
import type { CrossMarketDislocation, CrossMarketResearchTriggerProposal } from './types.ts';
import type { CrossMarketResearchTriggerKind } from './taxonomy.ts';

function specialistClassesFor(kind: CrossMarketResearchTriggerKind): ResearchMonitorTriggerEvent['requestedSpecialistClasses'] {
  if (kind === 'MACRO_RESEARCH') {
    return Object.freeze(['MACRO', 'FUNDAMENTAL', 'NEWS', 'RISK'] as const);
  }
  return Object.freeze(['CRYPTO_ONCHAIN', 'TECHNICAL', 'FLOW', 'RISK'] as const);
}

export function buildCrossMarketResearchTriggerProposal(input: {
  readonly dislocation: CrossMarketDislocation;
  readonly customerId: string;
  readonly subjectId: string;
  readonly now: UtcInstant;
}): CrossMarketResearchTriggerProposal | null {
  const kind = input.dislocation.researchTriggerKind;
  if (!kind) return null;

  const triggerEvent: ResearchMonitorTriggerEvent = Object.freeze({
    triggerEventId: `cm_trig_${input.dislocation.dislocationId}`,
    idempotencyKey: `cm_idem_${input.dislocation.dislocationId}`,
    dedupeFingerprint: `cm_fp_${input.dislocation.dislocationId}`,
    monitorId: 'native14_cross_market_intelligence',
    monitorVersion: '1.0.0',
    customerId: input.customerId,
    subjectId: input.subjectId,
    triggerReason: 'ANOMALY_SCORE',
    triggerExplanation: `Cross-market dislocation (${kind}) — evidence-backed research only; correlation is not a trade signal.`,
    observationRef: input.dislocation.evidenceRefs[0] ?? null,
    featureRef: null,
    availableInformation: Object.freeze({
      observationRefs: input.dislocation.evidenceRefs,
      featureRefs: Object.freeze([]),
      evidenceQuality: input.dislocation.severity === 'SEVERE' ? 'HIGH' : 'MEDIUM',
      dataAvailable: true,
      summary: `Domains: ${input.dislocation.involvedDomains.join(', ')}; magnitude ${input.dislocation.compositeMagnitudeBps.toFixed(1)} bps`,
      capturedAt: input.now,
    }),
    requestedSpecialistClasses: specialistClassesFor(kind),
    requestedBudgetMinor: '25000000',
    requestedBudgetCurrency: 'USD',
    cooldownKey: `cm_cooldown_${kind}`,
    cooldownSeconds: 3600,
    confidenceBefore: 'LOW_CONFIDENCE',
    opportunityKind: kind === 'MACRO_RESEARCH' ? 'MACRO_HEDGE' : 'GENERIC',
    emittedAt: input.now,
  });

  return Object.freeze({
    proposalId: `cm_trig_prop_${input.dislocation.dislocationId}`,
    kind,
    dislocationId: input.dislocation.dislocationId,
    triggerEvent,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
  });
}
