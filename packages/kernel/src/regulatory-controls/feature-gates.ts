/**
 * Wave 7 — Regulatory feature gates.
 *
 * Controls regulated services by jurisdiction. Architecture support does
 * not activate regulated services — gates remain disabled until explicitly enabled.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS, type RegulatedFeature } from './taxonomy.ts';
import type { RegulatoryFeatureGate } from './types.ts';

export const DEFAULT_FEATURE_GATES: readonly RegulatoryFeatureGate[] = Object.freeze([
  Object.freeze({
    gateId: 'gate.exchange.v1',
    feature: 'EXCHANGE',
    enabledJurisdictions: Object.freeze(['GB']),
    sandboxJurisdictions: Object.freeze(['US']),
    disabledJurisdictions: Object.freeze(['SA', 'AE']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.investment_agent.v1',
    feature: 'INVESTMENT_AGENT_EXECUTION',
    enabledJurisdictions: Object.freeze([]),
    sandboxJurisdictions: Object.freeze(['GB', 'US']),
    disabledJurisdictions: Object.freeze(['SA']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.banking_transfer.v1',
    feature: 'BANKING_TRANSFER',
    enabledJurisdictions: Object.freeze(['GB', 'US']),
    sandboxJurisdictions: Object.freeze(['SA']),
    disabledJurisdictions: Object.freeze([]),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.crypto_conversion.v1',
    feature: 'CRYPTO_CONVERSION',
    enabledJurisdictions: Object.freeze([]),
    sandboxJurisdictions: Object.freeze(['GB']),
    disabledJurisdictions: Object.freeze(['US', 'SA']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.health_data.v1',
    feature: 'HEALTH_DATA_CONTRIBUTION',
    enabledJurisdictions: Object.freeze([]),
    sandboxJurisdictions: Object.freeze([]),
    disabledJurisdictions: Object.freeze(['US', 'EU', 'GB']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.hin_sensitive.v1',
    feature: 'HIN_SENSITIVE_CATEGORY',
    enabledJurisdictions: Object.freeze([]),
    sandboxJurisdictions: Object.freeze(['GB']),
    disabledJurisdictions: Object.freeze(['SA', 'AE']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.cross_border_transfer.v1',
    feature: 'CROSS_BORDER_TRANSFER',
    enabledJurisdictions: Object.freeze(['GB', 'US']),
    sandboxJurisdictions: Object.freeze(['SA']),
    disabledJurisdictions: Object.freeze([]),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    gateId: 'gate.ai_agent_financial.v1',
    feature: 'AI_AGENT_FINANCIAL_AUTOMATION',
    enabledJurisdictions: Object.freeze([]),
    sandboxJurisdictions: Object.freeze(['GB', 'US', 'EU']),
    disabledJurisdictions: Object.freeze(['SA']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
]);

export type FeatureGateEvaluationInput = {
  readonly feature: RegulatedFeature;
  readonly jurisdiction: string;
  readonly environment: 'simulation' | 'sandbox' | 'production';
  readonly at: UtcInstant;
};

export type FeatureGateEvaluationResult = {
  readonly allowed: boolean;
  readonly mode: 'ENABLED' | 'SANDBOX' | 'DISABLED' | 'UNKNOWN';
  readonly reasonCode: string;
  readonly reason: string;
  readonly gateId: string | null;
};

export class RegulatoryFeatureGateRegistry {
  private readonly gates: Map<RegulatedFeature, RegulatoryFeatureGate>;

  constructor(seed: readonly RegulatoryFeatureGate[] = DEFAULT_FEATURE_GATES) {
    this.gates = new Map(seed.map((gate) => [gate.feature, gate]));
  }

  get(feature: RegulatedFeature): RegulatoryFeatureGate | undefined {
    return this.gates.get(feature);
  }

  evaluate(input: FeatureGateEvaluationInput): FeatureGateEvaluationResult {
    const gate = this.gates.get(input.feature);
    if (!gate || gate.effectiveFrom > input.at) {
      return Object.freeze({
        allowed: false,
        mode: 'UNKNOWN',
        reasonCode: 'FEATURE_GATE_UNKNOWN',
        reason: `no feature gate configured for ${input.feature}`,
        gateId: null,
      });
    }

    if (gate.disabledJurisdictions.includes(input.jurisdiction)) {
      return Object.freeze({
        allowed: false,
        mode: 'DISABLED',
        reasonCode: 'FEATURE_GATE_DISABLED',
        reason: `${input.feature} disabled for jurisdiction ${input.jurisdiction}`,
        gateId: gate.gateId,
      });
    }

    if (gate.enabledJurisdictions.includes(input.jurisdiction)) {
      return Object.freeze({
        allowed: true,
        mode: 'ENABLED',
        reasonCode: 'FEATURE_GATE_ENABLED',
        reason: `${input.feature} enabled for jurisdiction ${input.jurisdiction}`,
        gateId: gate.gateId,
      });
    }

    if (gate.sandboxJurisdictions.includes(input.jurisdiction)) {
      const allowed = input.environment === 'simulation' || input.environment === 'sandbox';
      return Object.freeze({
        allowed,
        mode: 'SANDBOX',
        reasonCode: allowed ? 'FEATURE_GATE_SANDBOX_ALLOWED' : 'FEATURE_GATE_SANDBOX_DENIED_IN_PRODUCTION',
        reason: allowed
          ? `${input.feature} allowed in sandbox for jurisdiction ${input.jurisdiction}`
          : `${input.feature} sandbox-only — denied in production for jurisdiction ${input.jurisdiction}`,
        gateId: gate.gateId,
      });
    }

    return Object.freeze({
      allowed: false,
      mode: 'DISABLED',
      reasonCode: 'FEATURE_GATE_NOT_CONFIGURED',
      reason: `${input.feature} not configured for jurisdiction ${input.jurisdiction}`,
      gateId: gate.gateId,
    });
  }
}
