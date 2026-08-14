import {
  asActionIntentId,
  asIdempotencyKey,
  err,
  ok,
  type Actor,
  type CustomerId,
  type Result,
  type UtcInstant,
} from '@solstice/domain';
import {
  freezeIntent,
  packFor,
  type ComplianceKernel,
  type KernelDecision,
  type Posture,
} from '@solstice/kernel';

export type PartyFields = Readonly<Record<string, string>>;

export type SimulatedAnalyticsFinding = {
  readonly provider: 'SIMULATED_CHAIN_ANALYTICS';
  readonly scoreBand: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly typology: string;
  readonly liveNetwork: false;
};

export type MonitoringOutcome = {
  readonly posture: Posture;
  readonly analytics: SimulatedAnalyticsFinding;
  readonly reasons: readonly string[];
};

/**
 * In-process analytics stub. No chain, no vendor API.
 */
export function screenSimulatedAnalytics(input: {
  readonly originatorName: string;
  readonly beneficiaryName: string;
  readonly quantity: bigint;
}): SimulatedAnalyticsFinding {
  const name = `${input.originatorName} ${input.beneficiaryName}`.toUpperCase();
  if (name.includes('MIXER') || name.includes('DARK')) {
    return Object.freeze({
      provider: 'SIMULATED_CHAIN_ANALYTICS',
      scoreBand: 'HIGH',
      typology: 'SIMULATED_MIXER_EXPOSURE',
      liveNetwork: false,
    });
  }
  if (input.quantity >= 10_000n) {
    return Object.freeze({
      provider: 'SIMULATED_CHAIN_ANALYTICS',
      scoreBand: 'MEDIUM',
      typology: 'SIMULATED_LARGE_TRANSFER',
      liveNetwork: false,
    });
  }
  return Object.freeze({
    provider: 'SIMULATED_CHAIN_ANALYTICS',
    scoreBand: 'LOW',
    typology: 'NONE',
    liveNetwork: false,
  });
}

export function monitorTransfer(finding: SimulatedAnalyticsFinding): MonitoringOutcome {
  if (finding.scoreBand === 'HIGH') {
    return Object.freeze({
      posture: 'BLOCK',
      analytics: finding,
      reasons: Object.freeze(['transaction monitoring BLOCK from simulated analytics']),
    });
  }
  if (finding.scoreBand === 'MEDIUM') {
    return Object.freeze({
      posture: 'REVIEW',
      analytics: finding,
      reasons: Object.freeze(['transaction monitoring REVIEW from simulated analytics']),
    });
  }
  return Object.freeze({
    posture: 'CLEAR',
    analytics: finding,
    reasons: Object.freeze(['transaction monitoring CLEAR']),
  });
}

export type TravelRuleRefusal = {
  readonly outcome: 'REFUSED';
  readonly reasons: readonly string[];
  readonly queued: false;
  readonly decision?: KernelDecision;
};

export type TravelRuleOk = {
  readonly outcome: 'CLEARED';
  readonly monitoring: MonitoringOutcome;
  readonly decision: KernelDecision;
};

/**
 * Cross-border digital-asset transfer. Required fields come from the
 * destination jurisdiction pack — never from a hard-coded country table.
 * Failure refuses the transfer; it is not queued.
 */
export function submitDigitalAssetTransfer(
  kernel: ComplianceKernel,
  input: {
    readonly id: string;
    readonly actor: Actor;
    readonly occurredAt: UtcInstant;
    readonly assetId: string;
    readonly quantity: bigint;
    readonly originatorCustomerId: CustomerId;
    readonly beneficiaryCustomerId: CustomerId;
    readonly originatorJurisdiction: string;
    readonly beneficiaryJurisdiction: string;
    readonly originatorFields: PartyFields;
    readonly beneficiaryFields: PartyFields;
  },
): Result<TravelRuleOk, TravelRuleRefusal> {
  const destPack = packFor(input.beneficiaryJurisdiction);
  const section = destPack?.travelRule;
  if (!section || !section.enabled) {
    return err({
      outcome: 'REFUSED',
      queued: false,
      reasons: Object.freeze([
        `Travel Rule not enabled in pack ${destPack?.jurisdiction ?? input.beneficiaryJurisdiction}; transfer refused, not queued`,
      ]),
    });
  }
  const req = section.crossBorderDigitalAssetTransfer;
  const missingOriginator = req.requiredOriginatorFields.filter((field) => !input.originatorFields[field]);
  const missingBeneficiary = req.requiredBeneficiaryFields.filter((field) => !input.beneficiaryFields[field]);
  if (missingOriginator.length > 0 || missingBeneficiary.length > 0) {
    return err({
      outcome: 'REFUSED',
      queued: false,
      reasons: Object.freeze([
        `Travel Rule refused (pack ${destPack.jurisdiction}): missing originator [${missingOriginator.join(', ')}] beneficiary [${missingBeneficiary.join(', ')}]`,
      ]),
    });
  }

  const intent = freezeIntent({
    id: asActionIntentId(`int_${input.id}`),
    kind: 'DIGITAL_ASSET_TRANSFER',
    actor: input.actor,
    payload: {
      assetId: input.assetId,
      quantity: input.quantity,
      originatorCustomerId: input.originatorCustomerId,
      beneficiaryCustomerId: input.beneficiaryCustomerId,
      originatorJurisdiction: input.originatorJurisdiction,
      beneficiaryJurisdiction: input.beneficiaryJurisdiction,
      originatorFields: input.originatorFields,
      beneficiaryFields: input.beneficiaryFields,
    },
    idempotencyKey: asIdempotencyKey(`xfer_${input.id}`),
    occurredAt: input.occurredAt,
    sourceJurisdiction: input.originatorJurisdiction,
    destinationJurisdiction: input.beneficiaryJurisdiction,
  });
  const evaluated = kernel.evaluate(intent);
  if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
    return err({
      outcome: 'REFUSED',
      queued: false,
      reasons: Object.freeze(
        evaluated.ok && evaluated.value.outcome === 'REFUSED'
          ? evaluated.value.reasons.slice()
          : ['kernel refused digital-asset transfer'],
      ),
      ...(evaluated.ok ? { decision: evaluated.value } : {}),
    });
  }
  const analytics = screenSimulatedAnalytics({
    originatorName: input.originatorFields.legalName ?? '',
    beneficiaryName: input.beneficiaryFields.legalName ?? '',
    quantity: input.quantity,
  });
  const monitoring = monitorTransfer(analytics);
  if (monitoring.posture === 'HOLD' || monitoring.posture === 'BLOCK') {
    return err({
      outcome: 'REFUSED',
      queued: false,
      reasons: monitoring.reasons,
      decision: evaluated.value,
    });
  }
  return ok({
    outcome: 'CLEARED',
    monitoring,
    decision: evaluated.value,
  });
}
