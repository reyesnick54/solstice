/**
 * Production Economic Constitution Candidate report.
 */

import {
  PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID,
  PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION,
  PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION,
  PRODUCTION_ECONOMIC_CONSTITUTION_TOOL_VERSION,
  CANONICAL_AUTHORITIES,
  type FirewallBinding,
  type ProductionEconomicConstitutionCandidateBundle,
  type ProductionEconomicConstitutionCandidateReport,
  type ProductionEconomicConstitutionQualificationDecision,
  type ProductionEconomicConstitutionSnapshot,
} from './types.ts';

export function buildProductionEconomicConstitutionCandidateReport(input: {
  readonly bundle: ProductionEconomicConstitutionCandidateBundle;
  readonly snapshot: ProductionEconomicConstitutionSnapshot;
  readonly decision: ProductionEconomicConstitutionQualificationDecision;
  readonly firewall: FirewallBinding;
}): ProductionEconomicConstitutionCandidateReport {
  return Object.freeze({
    schemaVersion: PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION,
    toolVersion: PRODUCTION_ECONOMIC_CONSTITUTION_TOOL_VERSION,
    identity: Object.freeze({
      bundleId: PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID,
      bundleVersion: PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION,
      sourceCommit: input.bundle.sourceCommit,
      economicRcId: input.bundle.economicRcId,
      mainnetRcId: input.bundle.mainnetRcId,
      bundleHash: input.bundle.bundleHash,
      economicConstitutionHash: input.bundle.economicConstitutionHash,
    }),
    versionBindings: input.snapshot.bindings,
    parameterCoverage: input.decision.parameterCoverage,
    sunreyConstitution: input.snapshot.sunrey,
    moonreyConstitution: input.snapshot.moonrey,
    supply: input.snapshot.supply,
    genesis: input.snapshot.genesis,
    fees: Object.freeze({
      policyHash: input.bundle.feePolicyHash,
      productionConfigured: false,
    }),
    burns: Object.freeze({
      policyHash: input.bundle.burnPolicyHash,
      productionConfigured: false,
    }),
    hin: Object.freeze({
      policyHash: input.bundle.HINPolicyHash,
      chainAnchorHash: input.bundle.HINChainAnchorCapabilityHash,
    }),
    oracleProductiveData: Object.freeze({
      certificationHash: input.bundle.oracleCertificationPolicyHash,
      fabricHash: input.bundle.economicDataFabricHash,
      sourceTaxonomyHash: input.bundle.sourceTaxonomyHash,
    }),
    exchange: Object.freeze({ owner: CANONICAL_AUTHORITIES.EXCHANGE }),
    economicRehearsal: input.snapshot.rehearsal,
    stress: input.snapshot.stress,
    externalEvidence: input.decision.externalEvidence,
    humanDecisionsRequired: input.decision.humanDecisionsRequired,
    humanAuthorizationRequired: input.decision.humanAuthorizationRequired,
    firewall: input.firewall,
    openBlockers: input.decision.openBlockers,
    qualification: input.decision.result,
    productionActive: false,
  });
}

export function formatConstitutionReport(report: ProductionEconomicConstitutionCandidateReport): string {
  const lines = [
    `ECONOMIC_CONSTITUTION_HASH=${report.identity.economicConstitutionHash}`,
    'PARAMETERS_SELECTED_FOR_PRODUCTION=false',
    `SUNREY_POLICY_STRUCTURALLY_READY=${String(report.sunreyConstitution.structurallyReady)}`,
    `MOONREY_POLICY_STRUCTURALLY_READY=${String(report.moonreyConstitution.structurallyReady)}`,
    'SUPPLY_AUTHORITY=AssetSupplyBook',
    'MONETARY_AUTHORITY=Chunk71',
    'LEGACY_V1_MOONREY_PRODUCTION_ELIGIBLE=false',
    'PEVE_IS_TOKEN_VALUATION=false',
    'GPUV_EQUALS_MOONREY=false',
    'AI_CAN_AUTHORIZE=false',
    `FIREWALL_STATE=${report.firewall.overallState}`,
    `QUALIFICATION=${report.qualification}`,
    'PRODUCTION_ACTIVE=false',
  ];
  return lines.join('\n');
}
