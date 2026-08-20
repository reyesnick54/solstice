import type { ComplianceTransportScenario, RawComplianceVendorResponse } from './types.ts';

export type ComplianceCandidateTransport = {
  readonly kind: 'FAKE';
  readonly realNetwork: false;
  exchange(input: {
    readonly capability: string;
    readonly subjectRef: string;
    readonly scenario?: ComplianceTransportScenario;
  }): RawComplianceVendorResponse;
};

export class FakeComplianceTransport implements ComplianceCandidateTransport {
  readonly kind = 'FAKE' as const;
  readonly realNetwork = false as const;
  readonly #scenarios = new Map<string, ComplianceTransportScenario>();

  setScenario(subjectRef: string, scenario: ComplianceTransportScenario): void {
    this.#scenarios.set(subjectRef, scenario);
  }

  exchange(input: {
    readonly capability: string;
    readonly subjectRef: string;
    readonly scenario?: ComplianceTransportScenario;
  }): RawComplianceVendorResponse {
    const scenario =
      input.scenario ?? this.#scenarios.get(input.subjectRef) ?? inferScenario(input.subjectRef);
    return Object.freeze({
      scenario,
      vendorOutcome: scenario === 'invalid_clear' ? 'CLEAR' : scenario.toUpperCase(),
      vendorScore: scenario === 'score_overflow' ? Number.MAX_VALUE : scenario === 'ok' || scenario === 'clear' ? 12 : 81,
      vendorConfidence: scenario === 'confidence_float' ? 0.1 + 0.2 : 0.8,
      matchRef: scenario === 'confirmed_match' ? `vendor-match:${input.subjectRef}` : undefined,
    });
  }
}

function inferScenario(subjectRef: string): ComplianceTransportScenario {
  const ref = subjectRef.toLowerCase();
  if (ref.includes('unavailable') || ref.includes('outage')) return 'unavailable';
  if (ref.includes('timeout')) return 'timeout';
  if (ref.includes('schema') || ref.includes('invalid_clear')) return 'invalid_clear';
  if (ref.includes('auth')) return 'auth_failure';
  if (ref.includes('overflow')) return 'score_overflow';
  if (ref.includes('float')) return 'confidence_float';
  if (ref.includes('unknown')) return 'unknown';
  if (ref.includes('pep') || ref.includes('potential')) return 'potential_match';
  if (ref.includes('block') || ref.includes('confirmed')) return 'confirmed_match';
  if (ref.includes('review') || ref.includes('false_positive')) return 'manual_review';
  if (ref.includes('clear')) return 'clear';
  return 'ok';
}
