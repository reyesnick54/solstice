/**
 * Machine-readable production data gates.
 * Backend readiness does not satisfy these. No placeholder completion.
 */

export const PRODUCTION_DATA_GATE_REQUIREMENTS = [
  'privacy_policy_and_terms',
  'jurisdictional_privacy_analysis',
  'data_processing_agreements',
  'provider_contracts',
  'consent_language_approval',
  'retention_policy_approval',
  'security_review',
  'external_penetration_test',
  'hsm_kms',
  'production_infrastructure',
  'operational_data_governance_staff',
  'incident_response',
  'rights_request_operations',
  'approved_hin_valuation_methodology',
  'approved_compensation_methodology',
  'approved_productive_value_methodology',
  'approved_sunrey_moonrey_governance_parameters',
] as const;

export const MARKETPLACE_GATE_REQUIREMENTS = [
  'legal_structure',
  'privacy_review',
  'security_review',
  'commercial_agreements',
  'operational_staff',
  'consent_language_approval',
  'payment_settlement_authorization',
] as const;

export type GateRequirementId =
  | (typeof PRODUCTION_DATA_GATE_REQUIREMENTS)[number]
  | (typeof MARKETPLACE_GATE_REQUIREMENTS)[number];

export type GateRequirementState = {
  readonly id: string;
  readonly satisfied: false;
  readonly evidence: null;
  readonly blocker: string;
};

function unsatisfied(id: string, blocker: string): GateRequirementState {
  return Object.freeze({ id, satisfied: false, evidence: null, blocker });
}

export function evaluateProductionDataGates(): {
  readonly schema: 'sunrey.phase-h.production-data-gates.v1';
  readonly gate: 'PRODUCTION_DATA_ECONOMIC_ACTIVITY';
  readonly allSatisfied: false;
  readonly liveActivityAuthorized: false;
  readonly requirements: readonly GateRequirementState[];
} {
  return Object.freeze({
    schema: 'sunrey.phase-h.production-data-gates.v1',
    gate: 'PRODUCTION_DATA_ECONOMIC_ACTIVITY',
    allSatisfied: false,
    liveActivityAuthorized: false,
    requirements: Object.freeze(
      PRODUCTION_DATA_GATE_REQUIREMENTS.map((id) =>
        unsatisfied(id, 'external counsel, contract, or operational evidence is not on file'),
      ),
    ),
  });
}

export function evaluateInformationRightsMarketplaceGate(): {
  readonly schema: 'sunrey.phase-h.marketplace-gate.v1';
  readonly gate: 'LIVE_INFORMATION_RIGHTS_MARKETPLACE';
  readonly allSatisfied: false;
  readonly marketplaceEconomicsAuthorized: false;
  readonly technicalReadinessDoesNotActivate: true;
  readonly requirements: readonly GateRequirementState[];
} {
  return Object.freeze({
    schema: 'sunrey.phase-h.marketplace-gate.v1',
    gate: 'LIVE_INFORMATION_RIGHTS_MARKETPLACE',
    allSatisfied: false,
    marketplaceEconomicsAuthorized: false,
    technicalReadinessDoesNotActivate: true,
    requirements: Object.freeze(
      MARKETPLACE_GATE_REQUIREMENTS.map((id) =>
        unsatisfied(id, 'marketplace legal/privacy/security/commercial/operational evidence is not on file'),
      ),
    ),
  });
}
