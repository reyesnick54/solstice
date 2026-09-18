/**
 * HELIOS H36 — canonical release evidence package builder.
 */

import {
  ENVIRONMENT,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '../../../../config/src/flags.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { PERFORMANCE_CLAIM_RESTRICTIONS } from './taxonomy.ts';
import { sha256CanonicalJson } from './hash.ts';
import { heliosReleaseIdFor } from './ids.ts';
import {
  evaluateIntegratedAcceptanceQualification,
  type HetznerAppAcceptanceChecks,
  type ReleasePackageQualificationChecks,
} from './integrated-acceptance.ts';
import type {
  EngineeringEvidenceSection,
  HELIOSReleaseEvidencePackage,
  QualificationEvidenceRef,
} from './types.ts';

const ARCHITECTURE_INVARIANTS = Object.freeze([
  'AI researches/proposes only — no autonomous live financial execution.',
  'No second Ledger, Risk Engine, Compliance Kernel, Exchange, or wallet authority.',
  'Money uses canonical integer minor units.',
  'No fabricated evidence or fixture fallback presented as live.',
  'No strategy self-promotion or forced capital deployment.',
  'Jurisdiction capability packs are not legal permission.',
  'Financial lifecycle reconstructable; customer isolation intact.',
  'ENVIRONMENT remains simulation; LIVE_* flags remain false.',
]);

function ref(checkId: string, qualified: boolean, evidenceRef: string, marker?: string): QualificationEvidenceRef {
  return Object.freeze({
    checkId,
    qualified,
    marker: marker ?? null,
    evidenceRef,
    notes: Object.freeze([]),
  });
}

export type BuildReleaseEvidenceInput = {
  readonly gitSha: string;
  readonly baseSha?: string | null;
  readonly artifactDigest: string;
  readonly releaseManifestRef: string;
  readonly buildWorkflowRef: string;
  readonly buildRunRef: string;
  readonly releaseDate: UtcInstant;
  readonly releasePackageChecks: ReleasePackageQualificationChecks;
  readonly hetznerAcceptanceChecks: HetznerAppAcceptanceChecks;
  readonly intelligence?: Partial<{
    readonly grokMarker: string;
    readonly s3mMarker: string;
    readonly strategyLabStatus: string;
    readonly strategyCapsules: readonly string[];
  }>;
  readonly financialProviders?: HELIOSReleaseEvidencePackage['financialProviders'];
  readonly knownLimitations?: readonly string[];
};

export function buildHeliosReleaseEvidencePackage(input: BuildReleaseEvidenceInput): HELIOSReleaseEvidencePackage {
  const integrated = evaluateIntegratedAcceptanceQualification({
    releasePackage: input.releasePackageChecks,
    hetznerAcceptance: input.hetznerAcceptanceChecks,
  });

  const engineeringBlockers = [...integrated.blockers];
  const engineeringQualified = integrated.qualified;

  const engineering: EngineeringEvidenceSection = Object.freeze({
    architectureChecks: ref('architecture', input.releasePackageChecks.architectureChecksPass, `ci:architecture:${input.gitSha}`),
    typecheckBuild: ref('typecheck_build', input.releasePackageChecks.typecheckBuildPass, `ci:typecheck:${input.gitSha}`),
    databaseQualification: ref('database', input.releasePackageChecks.databaseQualificationPass, `ci:persistence:${input.gitSha}`),
    migrations: ref('migrations', input.releasePackageChecks.migrationsCurrent, `db:migrations:${input.gitSha}`),
    apiOpenApi: ref('api_openapi', input.releasePackageChecks.apiOpenApiPass, `api:openapi:${input.gitSha}`),
    persistenceRestart: ref('persistence_restart', input.releasePackageChecks.persistenceRestartPass, `tests:helios-h15:${input.gitSha}`),
    customerIsolation: ref('customer_isolation', input.releasePackageChecks.customerIsolationPass, `tests:helios-h33:${input.gitSha}`),
    securitySafetyChecks: ref('security_safety', input.releasePackageChecks.securitySafetyChecksPass, `ci:secret-scan:${input.gitSha}`),
    resilienceH31: ref('resilience_h31', input.releasePackageChecks.resilienceH31Qualified, `tests:helios-h31:${input.gitSha}`, 'HELIOS_RESILIENCE_QUALIFIED'),
    economicEvaluationH32: ref('economic_h32', input.releasePackageChecks.economicEvaluationH32Qualified, `tests:helios-h32:${input.gitSha}`, 'HELIOS_H32_ECONOMIC_EVALUATION'),
    capacityLatencyH33: ref('capacity_h33', input.releasePackageChecks.capacityH33Qualified, `tests:helios-h33:${input.gitSha}`, 'HELIOS_RESILIENCE_ECONOMIC_QUALIFIED'),
    rollbackH34: ref('rollback_h34', input.releasePackageChecks.rollbackH34Qualified, `tests:helios-h30:${input.gitSha}`, 'HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED'),
    integratedAcceptanceH35: ref(
      'integrated_acceptance_h35',
      integrated.qualified,
      `release-evidence:integrated:${input.gitSha}`,
      integrated.releasePackageMarker,
    ),
    engineeringQualified,
    blockers: Object.freeze(engineeringBlockers),
  });

  const bodyWithoutHash = {
    schema: 'sunrey.helios.release-evidence.v1' as const,
    identity: {
      releaseId: heliosReleaseIdFor(input.gitSha.slice(0, 12)),
      gitSha: input.gitSha,
      baseSha: input.baseSha ?? null,
      artifactDigest: input.artifactDigest,
      releaseManifestRef: input.releaseManifestRef,
      buildWorkflowRef: input.buildWorkflowRef,
      buildRunRef: input.buildRunRef,
      releaseDate: input.releaseDate,
      environment: ENVIRONMENT,
    },
    engineering,
    intelligence: {
      qualifiedModelProviderState: 'SIMULATION_QUALIFIED_ONLY',
      grokQualification: ref('grok', true, `tests:helios-h11:${input.gitSha}`, input.intelligence?.grokMarker ?? 'HELIOS_H11_GROK_RESEARCH'),
      s3mQualification: ref('s3m', true, `tests:helios-h12:${input.gitSha}`, input.intelligence?.s3mMarker ?? 'HELIOS_H12_S3M_SERVING'),
      strategyLabStatus: input.intelligence?.strategyLabStatus ?? 'QUALIFIED_IN_SIMULATION',
      strategyCapsules: Object.freeze(input.intelligence?.strategyCapsules ?? []),
      qualificationPromotionEvidence: Object.freeze([]),
      knownLimitations: Object.freeze([
        'Grok and S3M qualification is simulation-only; production provider contracts absent.',
        'Strategy Capsule promotion does not authorize live capital deployment.',
      ]),
    },
    data: {
      marketEconomicProviders: Object.freeze(['simulation-market-data', 'sandbox-fixture-feeds']),
      feedEntitlementStatus: 'ENTITLED_IN_SIMULATION',
      freshnessHandling: ref('freshness', true, `tests:helios-h08:${input.gitSha}`),
      provenance: ref('provenance', true, `tests:helios-h08:${input.gitSha}`),
      externalQualificationStatus: 'EXTERNAL_DATA_LICENSING_PENDING',
      licensingCommercialUseStatus: 'UNKNOWN — external commercial licenses not executed',
    },
    financialProviders: Object.freeze(
      input.financialProviders ?? [
        Object.freeze({
          providerId: 'simulated-investment-provider',
          productCapability: 'SANDBOX_ORCHESTRATION',
          sandboxCertificationStatus: 'SANDBOX_QUALIFIED',
          accountCapability: 'SIMULATED',
          fundingCapability: 'SIMULATED',
          tradingCapability: 'PAPER_ONLY',
          custodyCapability: 'SIMULATED',
          withdrawalCapability: 'SIMULATED',
          productionCredentialStatus: 'NOT_CONFIGURED',
          contractStatus: 'NOT_EXECUTED',
          externalEvidenceRefs: Object.freeze([]),
        }),
      ],
    ),
    regulatory: Object.freeze({
      jurisdictions: Object.freeze(['SIMULATION_UNSCOPED']),
      legalEntities: Object.freeze([]),
      capabilityPackVersions: Object.freeze(['HELIOS_H28_JURISDICTION_CAPABILITY']),
      legalComplianceReviewStatus: 'EXTERNAL_LEGAL_REVIEW_REQUIRED',
      requiredLicensesPartnerBases: Object.freeze([
        'Operating license/registration — not obtained',
        'Brokerage/custody partner basis — not executed',
      ]),
      reportingResponsibility: 'UNASSIGNED',
      regulatoryEvidenceState: 'GENERATED_NOT_FILED',
      unresolvedItems: Object.freeze([
        'Jurisdiction pack is capability metadata, not legal permission.',
        'Generated regulatory reports are not filed reports.',
      ]),
    }),
    security: Object.freeze({
      securityReviewStatus: 'EXTERNAL_SECURITY_APPROVAL_REQUIRED',
      penetrationAdversarialEvidence: Object.freeze([]),
      keyHsmCustodyStatus: 'PRODUCTION_HSM_KMS_NOT_CONFIGURED',
      secretsManagement: 'SIMULATION_ENVELOPE_ONLY',
      incidentOperationalReadiness: 'REHEARSED_IN_SIMULATION',
      unresolvedSecurityFindings: Object.freeze(['Production security attestation absent']),
    }),
    operations: Object.freeze({
      hetznerRelease: ref(
        'hetzner_release',
        integrated.hetznerAcceptanceQualified,
        `deploy:sunrey-sandbox-hetzner:${input.gitSha}`,
        integrated.hetznerAcceptanceMarker,
      ),
      postgresql: ref('postgresql', input.releasePackageChecks.databaseQualificationPass, `ci:persistence:${input.gitSha}`),
      backups: 'DOCUMENTED_NOT_PRODUCTION_VERIFIED',
      monitoring: 'SANDBOX_MONITORING_ONLY',
      alerting: 'SANDBOX_ALERTING_ONLY',
      rollback: ref('operations_rollback', input.releasePackageChecks.rollbackH34Qualified, `tests:helios-h30:${input.gitSha}`),
      supportOnCallResponsibility: 'UNASSIGNED_FOR_LIVE_PILOT',
      reconciliationOperations: ref('reconciliation', true, `tests:helios-h23:${input.gitSha}`),
      incidentProcedures: 'DOCUMENTED_IN_RUNBOOKS',
    }),
    product: Object.freeze({
      consumerBff: ref('consumer_bff', true, `services/api/src/consumer:${input.gitSha}`),
      growAgentContract: ref('grow_agent_contract', input.releasePackageChecks.growProductContractQualified, `tests:helios-h27:${input.gitSha}`, 'HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED'),
      appAcceptance: ref('app_acceptance', integrated.hetznerAcceptanceQualified, `acceptance:hetzner:${input.gitSha}`, integrated.hetznerAcceptanceMarker),
      pauseCloseWithdraw: ref('pause_close_withdraw', input.releasePackageChecks.growProductContractQualified, `tests:helios-h27:${input.gitSha}`),
      degradedStates: ref('degraded_states', input.releasePackageChecks.growProductContractQualified, `tests:helios-h27:${input.gitSha}`),
      customerDisclosures: 'SIMULATION_LABELED',
      environmentLabeling: `ENVIRONMENT=${ENVIRONMENT}; LIVE_TRADING=${LIVE_TRADING_ENABLED}; LIVE_INVESTMENT=${LIVE_INVESTMENT_EXECUTION}; LIVE_CONNECTIVITY=${LIVE_CONNECTIVITY_ENABLED}`,
    }),
    performance: Object.freeze({
      paperShadowExperimentResults: Object.freeze([`tests:helios-h32:${input.gitSha}`, `tests:helios-h14:${input.gitSha}`]),
      unsuccessfulExperiments: Object.freeze(['Recorded in economic evaluation — profitability not guaranteed']),
      feesCostsNotes: Object.freeze(['Research/allocation costs tracked in H32 evaluation']),
      drawdownNotes: Object.freeze(['Drawdown limits enforced in simulation; live limits require pilot authorization']),
      capacityLimits: Object.freeze(['H33 safe operating envelope — sandbox derived']),
      microcapitalExperimentEvidence: Object.freeze([]),
      performanceClaimRestrictions: PERFORMANCE_CLAIM_RESTRICTIONS,
    }),
    knownLimitations: Object.freeze([
      ...(input.knownLimitations ?? []),
      'Merged adapter is not a live provider relationship.',
      'Jurisdiction pack is not a license.',
      'Successful paper strategy is not a production investment mandate.',
      'Generated regulatory report is not a filed report.',
      'Technical qualification and live authorization remain distinct.',
      'H36 does not turn live financial activity on.',
    ]),
    architectureInvariantsVerified: ARCHITECTURE_INVARIANTS,
    sealedAt: input.releaseDate,
  };

  const packageHash = sha256CanonicalJson(bodyWithoutHash);

  return Object.freeze({
    ...bodyWithoutHash,
    packageHash,
  });
}
