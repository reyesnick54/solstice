import { sha256Hex } from '../../../security/src/hash.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AdverseMediaReference } from './result.ts';
import {
  toUnavailable,
  type AdverseMediaProvider,
  type ComplianceProviderPorts,
  type DeviceRiskProvider,
  type FraudRiskProvider,
  type PepProvider,
  type ProviderScreenResponse,
  type SanctionsProvider,
  type ScreeningRequest,
  type TransactionMonitoringProvider,
} from './ports.ts';
import type { ScreeningOutcome } from './types.ts';

/**
 * Deterministic simulation adapters. Seeded opaque refs only.
 * Do not claim OFAC/UN/EU/HMT compliance. No live persons. No network.
 */
export type SimulationProviderOptions = {
  readonly unavailable?: readonly string[];
};

function token(subjectRef: string): string {
  return subjectRef.toLowerCase();
}

function outcomeFor(subjectRef: string, kind: 'sanctions' | 'pep' | 'media' | 'fraud' | 'device'): {
  readonly outcome: ScreeningOutcome;
  readonly reasonCodes: readonly string[];
} {
  const ref = token(subjectRef);
  if (kind === 'sanctions') {
    if (ref.includes('sim_block') || ref.endsWith(':block')) {
      return { outcome: 'BLOCK', reasonCodes: ['SIMULATED_SANCTIONS_MATCH'] };
    }
    if (ref.includes('sim_hold')) {
      return { outcome: 'HOLD', reasonCodes: ['SIMULATED_SANCTIONS_POSSIBLE_MATCH'] };
    }
    if (ref.includes('sim_review')) {
      return { outcome: 'REVIEW', reasonCodes: ['SIMULATED_SANCTIONS_POSSIBLE_MATCH'] };
    }
    return { outcome: 'CLEAR', reasonCodes: ['SIMULATED_SANCTIONS_CLEAR'] };
  }
  if (kind === 'pep') {
    if (ref.includes('sim_pep')) {
      return { outcome: 'REVIEW', reasonCodes: ['SIMULATED_PEP_INDICATION', 'ENHANCED_REVIEW_REQUIRED'] };
    }
    return { outcome: 'CLEAR', reasonCodes: ['SIMULATED_PEP_CLEAR'] };
  }
  if (kind === 'media') {
    if (ref.includes('sim_adverse')) {
      return { outcome: 'REVIEW', reasonCodes: ['SIMULATED_ADVERSE_MEDIA_HIT'] };
    }
    return { outcome: 'CLEAR', reasonCodes: ['SIMULATED_ADVERSE_MEDIA_CLEAR'] };
  }
  if (kind === 'fraud') {
    if (ref.includes('sim_fraud_block')) {
      return { outcome: 'BLOCK', reasonCodes: ['SIMULATED_FRAUD_BLOCK'] };
    }
    if (ref.includes('sim_step_up')) {
      return { outcome: 'REVIEW', reasonCodes: ['SIMULATED_FRAUD_STEP_UP'] };
    }
    return { outcome: 'CLEAR', reasonCodes: ['SIMULATED_FRAUD_CLEAR'] };
  }
  if (ref.includes('sim_device_review')) {
    return { outcome: 'REVIEW', reasonCodes: ['SIMULATED_DEVICE_REVIEW'] };
  }
  return { outcome: 'CLEAR', reasonCodes: ['SIMULATED_DEVICE_CLEAR'] };
}

function response(
  request: ScreeningRequest,
  providerId: string,
  kind: 'sanctions' | 'pep' | 'media' | 'fraud' | 'device',
  unavailable: ReadonlySet<string>,
): ProviderScreenResponse {
  if (unavailable.has(providerId)) {
    return toUnavailable(providerId, request.now);
  }
  const hit = outcomeFor(request.subjectRef, kind);
  const hash = sha256Hex(
    JSON.stringify({
      providerId,
      subjectRef: request.subjectRef,
      outcome: hit.outcome,
      at: request.now,
    }),
  );
  return Object.freeze({
    available: true,
    outcome: hit.outcome,
    reasonCodes: Object.freeze([...hit.reasonCodes]),
    providerRef: `${providerId}:${request.subjectRef}`,
    providerModel: 'solstice-sim-v1',
    providerHash: hash,
    confidence: hit.outcome === 'CLEAR' ? 99 : 70,
    score: null,
    evidenceRefs: Object.freeze([`sim:${providerId}:${hash.slice(0, 16)}`]),
  });
}

export class SimulatedSanctionsProvider implements SanctionsProvider {
  private readonly unavailable: ReadonlySet<string>;
  constructor(unavailable: ReadonlySet<string>) {
    this.unavailable = unavailable;
  }
  screen(request: ScreeningRequest): ProviderScreenResponse {
    return response(request, 'sim-sanctions', 'sanctions', this.unavailable);
  }
}

export class SimulatedPepProvider implements PepProvider {
  private readonly unavailable: ReadonlySet<string>;
  constructor(unavailable: ReadonlySet<string>) {
    this.unavailable = unavailable;
  }
  screen(request: ScreeningRequest): ProviderScreenResponse {
    return response(request, 'sim-pep', 'pep', this.unavailable);
  }
}

export class SimulatedAdverseMediaProvider implements AdverseMediaProvider {
  private readonly unavailable: ReadonlySet<string>;
  constructor(unavailable: ReadonlySet<string>) {
    this.unavailable = unavailable;
  }
  screen(request: ScreeningRequest): ProviderScreenResponse & {
    readonly references: readonly AdverseMediaReference[];
  } {
    const base = response(request, 'sim-adverse-media', 'media', this.unavailable);
    const references: readonly AdverseMediaReference[] =
      base.outcome === 'REVIEW'
        ? Object.freeze([
            {
              category: 'REGULATORY',
              providerResultId: `sim-media-${request.subjectRef}`,
              riskClassification: 'ELEVATED',
              observedAt: request.now,
              reviewRequired: true,
              contentHash: sha256Hex(`ref:${request.subjectRef}`),
            },
          ])
        : Object.freeze([]);
    return Object.freeze({ ...base, references });
  }
}

export class SimulatedTransactionMonitoringProvider implements TransactionMonitoringProvider {
  private readonly unavailable: ReadonlySet<string>;
  constructor(unavailable: ReadonlySet<string>) {
    this.unavailable = unavailable;
  }
  evaluate(request: ScreeningRequest): ProviderScreenResponse {
    if (this.unavailable.has('sim-tm')) {
      return toUnavailable('sim-tm', request.now);
    }
    return Object.freeze({
      available: true,
      outcome: 'CLEAR',
      reasonCodes: Object.freeze(['SIMULATED_TM_CLEAR']),
      providerRef: `sim-tm:${request.subjectRef}`,
      providerModel: 'solstice-sim-v1',
      providerHash: sha256Hex(`tm:${request.subjectRef}:${request.now}`),
      confidence: null,
      score: null,
      evidenceRefs: Object.freeze([]),
    });
  }
}

export class SimulatedFraudRiskProvider implements FraudRiskProvider {
  private readonly unavailable: ReadonlySet<string>;
  constructor(unavailable: ReadonlySet<string>) {
    this.unavailable = unavailable;
  }
  evaluate(request: ScreeningRequest): ProviderScreenResponse {
    return response(request, 'sim-fraud', 'fraud', this.unavailable);
  }
}

export class SimulatedDeviceRiskProvider implements DeviceRiskProvider {
  private readonly unavailable: ReadonlySet<string>;
  constructor(unavailable: ReadonlySet<string>) {
    this.unavailable = unavailable;
  }
  screen(request: ScreeningRequest): ProviderScreenResponse {
    return response(request, 'sim-device', 'device', this.unavailable);
  }
}

export function createSimulationProviders(
  options: SimulationProviderOptions = {},
): ComplianceProviderPorts {
  const unavailable = new Set(options.unavailable ?? []);
  return Object.freeze({
    sanctions: new SimulatedSanctionsProvider(unavailable),
    pep: new SimulatedPepProvider(unavailable),
    adverseMedia: new SimulatedAdverseMediaProvider(unavailable),
    transactionMonitoring: new SimulatedTransactionMonitoringProvider(unavailable),
    fraud: new SimulatedFraudRiskProvider(unavailable),
    deviceRisk: new SimulatedDeviceRiskProvider(unavailable),
  });
}
