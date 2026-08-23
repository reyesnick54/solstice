/**
 * Separate Mainnet and Exchange production gates.
 * Fail closed until external/human inputs exist. Placeholders do not satisfy.
 * Building software is not activation.
 */

import { PHASE_G_PRODUCTION_FLAGS, buildingMainnetIsNotActivation } from './taxonomy.ts';

export const GATE_STATUSES = ['MISSING', 'RECORDED_INTERNAL', 'EXTERNAL_REQUIRED', 'SATISFIED'] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export type GateRequirement = {
  readonly id: string;
  readonly label: string;
  readonly kind: 'EXTERNAL_HUMAN' | 'EXTERNAL_PROVIDER' | 'EXTERNAL_AUDIT' | 'INTERNAL_SOFTWARE';
  readonly status: GateStatus;
  readonly satisfiableByPlaceholder: false;
  readonly notes: string;
};

export type ProductionGate = {
  readonly schema: string;
  readonly id: string;
  readonly evaluatedAtPolicy: 'FAIL_CLOSED';
  readonly passed: false;
  readonly softwareCompleteInternally: boolean;
  readonly activationSeparatedFromBuild: true;
  readonly productionActivated: false;
  readonly liveFlagsRemainDisabled: true;
  readonly requirements: readonly GateRequirement[];
  readonly missingRequirementIds: readonly string[];
};

function req(
  id: string,
  label: string,
  kind: GateRequirement['kind'],
  status: GateStatus,
  notes: string,
): GateRequirement {
  return Object.freeze({
    id,
    label,
    kind,
    status,
    satisfiableByPlaceholder: false,
    notes,
  });
}

const MAINNET_REQUIREMENTS: readonly GateRequirement[] = Object.freeze([
  req('final_economic_parameters', 'Final economic parameters', 'EXTERNAL_HUMAN', 'EXTERNAL_REQUIRED', 'Chunk 71 remains the mint. Fixture packages cannot authorize production.'),
  req('human_governance_signatures', 'Human governance signatures', 'EXTERNAL_HUMAN', 'MISSING', 'Launch authorization candidate is not MAINNET_ACTIVE.'),
  req('external_security_audit', 'External security audit', 'EXTERNAL_AUDIT', 'MISSING', 'No fabricated audit evidence.'),
  req('protocol_audit', 'Protocol audit', 'EXTERNAL_AUDIT', 'MISSING', 'External protocol review is not present.'),
  req('penetration_test', 'Penetration test', 'EXTERNAL_AUDIT', 'MISSING', 'Range work is not a live pentest report.'),
  req('legal_counsel_review', 'Legal / counsel review', 'EXTERNAL_HUMAN', 'MISSING', 'Do not mark CONFIRMED_BY_COUNSEL here.'),
  req('licenses_regulatory_approvals', 'Licenses / regulatory approvals', 'EXTERNAL_HUMAN', 'MISSING', 'Unknown corridors stay RESEARCH_REQUIRED.'),
  req('custody_provider', 'Production custody provider', 'EXTERNAL_PROVIDER', 'MISSING', 'Fixture adapters only.'),
  req('travel_rule_provider', 'Travel Rule provider', 'EXTERNAL_PROVIDER', 'MISSING', 'Simulation Travel Rule is not a network membership.'),
  req('production_hsm_kms', 'Production HSM / KMS', 'EXTERNAL_PROVIDER', 'MISSING', 'Development HSM simulator is not a launch key.'),
  req('validator_operators', 'Validator operators', 'EXTERNAL_HUMAN', 'MISSING', 'Testnet lifecycle is not production operator acceptance.'),
  req('production_infrastructure', 'Production infrastructure', 'EXTERNAL_PROVIDER', 'MISSING', 'Simulation hosts are not production.'),
  req('dns_certificates', 'DNS / certificates', 'EXTERNAL_PROVIDER', 'MISSING', 'Not present in this repository.'),
  req('monitoring_oncall', 'Monitoring / on-call', 'EXTERNAL_HUMAN', 'MISSING', 'Operational staffing is an external slot.'),
  req('incident_response', 'Incident response', 'EXTERNAL_HUMAN', 'MISSING', 'Runbooks exist; staffing does not.'),
  req('genesis_approvals', 'Genesis approvals', 'EXTERNAL_HUMAN', 'MISSING', 'Ceremony candidate is not genesis.'),
  req('mainnet_ceremony_approval', 'Mainnet ceremony approval', 'EXTERNAL_HUMAN', 'MISSING', 'LAUNCH_AUTHORIZATION_CANDIDATE is not MAINNET_ACTIVE.'),
  req('software_runtime', 'SunRey Chain runtime (internal)', 'INTERNAL_SOFTWARE', 'RECORDED_INTERNAL', 'Testnet-deployable runtime exists. This does not activate mainnet.'),
]);

const EXCHANGE_REQUIREMENTS: readonly GateRequirement[] = Object.freeze([
  req('licenses_permissions', 'Exchange licenses / permissions', 'EXTERNAL_HUMAN', 'MISSING', 'Unlicensed activation remains incomplete.'),
  req('custody', 'Qualified custody', 'EXTERNAL_PROVIDER', 'MISSING', 'Simulation custody is not a qualified custodian.'),
  req('market_surveillance_operations', 'Market surveillance operations', 'EXTERNAL_HUMAN', 'MISSING', 'Detectors exist; an operations desk does not.'),
  req('compliance_provider', 'Compliance provider', 'EXTERNAL_PROVIDER', 'MISSING', 'Kernel fixtures are not a live AML vendor.'),
  req('travel_rule', 'Travel Rule where required', 'EXTERNAL_PROVIDER', 'MISSING', 'Pending Travel Rule blocks withdrawal. No network is connected.'),
  req('banking_settlement', 'Banking / settlement', 'EXTERNAL_PROVIDER', 'MISSING', 'LIVE_BANKING_RAILS stays false.'),
  req('approved_listings', 'Approved listings', 'EXTERNAL_HUMAN', 'MISSING', 'Simulation listings are not counsel-approved.'),
  req('market_rules', 'Market rules', 'EXTERNAL_HUMAN', 'MISSING', 'Internal policy is not an approved rulebook.'),
  req('operational_staff', 'Operational staff', 'EXTERNAL_HUMAN', 'MISSING', 'Staffing is an external input.'),
  req('security_review', 'Security review', 'EXTERNAL_AUDIT', 'MISSING', 'Internal red-team tests are not an external review.'),
  req('incident_procedures', 'Incident procedures', 'EXTERNAL_HUMAN', 'MISSING', 'Procedures require named operators.'),
  req('exchange_core_software', 'Exchange core (internal)', 'INTERNAL_SOFTWARE', 'RECORDED_INTERNAL', 'Matching, clearing, settlement, and consumer APIs are productized internally.'),
]);

function evaluate(schema: string, id: string, requirements: readonly GateRequirement[], softwareComplete: boolean): ProductionGate {
  const missing = requirements.filter((row) => row.status === 'MISSING' || row.status === 'EXTERNAL_REQUIRED').map((row) => row.id);
  return Object.freeze({
    schema,
    id,
    evaluatedAtPolicy: 'FAIL_CLOSED',
    passed: false,
    softwareCompleteInternally: softwareComplete,
    activationSeparatedFromBuild: true,
    productionActivated: false,
    liveFlagsRemainDisabled: true,
    requirements,
    missingRequirementIds: Object.freeze(missing),
  });
}

export function evaluateMainnetReadinessGate(): ProductionGate {
  return evaluate(
    'sunrey.mainnet.readiness.gate.v1',
    'sunrey-mainnet-readiness-gate',
    MAINNET_REQUIREMENTS,
    true,
  );
}

export function evaluateExchangeProductionGate(): ProductionGate {
  return evaluate(
    'sunrey.exchange.production.gate.v1',
    'sunrey-exchange-production-gate',
    EXCHANGE_REQUIREMENTS,
    true,
  );
}

export function evaluatePhaseGGates(): {
  readonly mainnet: ProductionGate;
  readonly exchange: ProductionGate;
  readonly combinedBooleanForbidden: true;
  readonly activation: ReturnType<typeof buildingMainnetIsNotActivation>;
  readonly flags: typeof PHASE_G_PRODUCTION_FLAGS;
} {
  const mainnet = evaluateMainnetReadinessGate();
  const exchange = evaluateExchangeProductionGate();
  if (mainnet.passed || exchange.passed) {
    throw new Error('gates must fail until external inputs exist');
  }
  return Object.freeze({
    mainnet,
    exchange,
    combinedBooleanForbidden: true,
    activation: buildingMainnetIsNotActivation(),
    flags: PHASE_G_PRODUCTION_FLAGS,
  });
}

export function serializeGate(gate: ProductionGate): Record<string, unknown> {
  return {
    schema: gate.schema,
    id: gate.id,
    evaluatedAtPolicy: gate.evaluatedAtPolicy,
    passed: gate.passed,
    softwareCompleteInternally: gate.softwareCompleteInternally,
    activationSeparatedFromBuild: gate.activationSeparatedFromBuild,
    productionActivated: gate.productionActivated,
    liveFlagsRemainDisabled: gate.liveFlagsRemainDisabled,
    requirements: gate.requirements,
    missingRequirementIds: gate.missingRequirementIds,
  };
}
