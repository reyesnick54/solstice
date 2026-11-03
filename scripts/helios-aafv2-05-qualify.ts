#!/usr/bin/env node
/**
 * HELIOS AAFV2.5 — bias sentinel qualification gate.
 */

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED,
  assessResearchBias,
  biasSentinelInputFromCoverageTensor,
  biasSentinelProfilesFromCompilerManifest,
  buildCleanControlUniverse,
  buildDelistingOmissionUniverse,
  buildLiquidityBiasUniverse,
  buildMegaCapAltDataBiasUniverse,
  buildProviderUsBiasUniverse,
  buildSectorTechDoublingUniverse,
  buildSurvivorshipBiasUniverse,
  evaluateAafv205Qualification,
  evaluateBiasPromotionGate,
  observedIdsForCleanControl,
  sealBiasSentinelAssessmentEvidence,
} from '../packages/platform/src/helios/feature-fabric/bias-sentinel/index.ts';
import { buildCoverageTensor } from '../packages/platform/src/helios/feature-fabric/coverage/tensor.ts';
import type { FeatureCoverageProbe } from '../packages/platform/src/helios/feature-fabric/coverage/types.ts';

const EVAL_AT = asUtcInstant('2026-04-01T12:00:00.000Z');

function runCase(
  id: string,
  fixture: {
    readonly intended: readonly import('../packages/platform/src/helios/feature-fabric/bias-sentinel/types.ts').UniverseMemberProfile[];
    readonly observedIds: readonly string[];
  },
) {
  return assessResearchBias({
    assessmentId: id,
    researchDatasetId: 'ds_qualify',
    evaluatedAt: EVAL_AT,
    intendedEligibleUniverse: fixture.intended,
    observedUsableEntityIds: fixture.observedIds,
  });
}

function main(): void {
  const mega = runCase('qualify_mega', buildMegaCapAltDataBiasUniverse());
  const surv = runCase('qualify_surv', buildSurvivorshipBiasUniverse());
  const sector = runCase('qualify_sector', buildSectorTechDoublingUniverse());
  const provider = runCase('qualify_provider', buildProviderUsBiasUniverse());
  const liq = runCase('qualify_liq', buildLiquidityBiasUniverse());
  const delist = runCase('qualify_delist', buildDelistingOmissionUniverse());
  const cleanUniverse = buildCleanControlUniverse(40);
  const clean = assessResearchBias({
    assessmentId: 'qualify_clean',
    researchDatasetId: 'ds_qualify',
    evaluatedAt: EVAL_AT,
    intendedEligibleUniverse: cleanUniverse,
    observedUsableEntityIds: observedIdsForCleanControl(cleanUniverse),
  });

  const vault = new EvidenceVault(new FrozenClock(EVAL_AT));
  const evidenceId = sealBiasSentinelAssessmentEvidence(vault, mega);

  const signal = Object.freeze({
    published: true,
    providerAvailable: true,
    providerCoversInstrument: true,
    entitlementState: 'USABLE' as const,
    entityResolved: true,
    applicable: true,
    qualityState: 'VALID' as const,
    historicalGap: false,
    knowableAtEvaluationTime: true,
    valuePresent: true,
  });
  const probes: FeatureCoverageProbe[] = [];
  for (let i = 0; i < 35; i += 1) {
    probes.push(
      Object.freeze({
        member: Object.freeze({
          canonicalEntityId: `q_ent_${i}`,
          canonicalInstrumentId: `q_inst_${i}`,
          evaluationTimestamp: EVAL_AT,
          sector: 'TECH',
          industry: 'SOFTWARE',
          marketCapBucket: 'LARGE',
          liquidityBucket: 'HIGH',
          geography: 'US',
          venue: 'NYSE',
          assetClass: 'EQUITY',
        }),
        featureId: 'alt.sentiment',
        providerId: 'provider_a',
        signal: i < 30 ? signal : Object.freeze({ ...signal, valuePresent: false }),
      }),
    );
  }
  const tensor = buildCoverageTensor({
    universeId: 'qualify_uni',
    universeDefinition: 'qualify',
    evaluationTimestamp: EVAL_AT,
    eligibleMembers: probes.map((row) => row.member),
    featureIds: ['alt.sentiment'],
    probes,
  });
  const bridged = biasSentinelInputFromCoverageTensor({ tensor });

  const manifestOk =
    biasSentinelProfilesFromCompilerManifest({
      manifest: { manifestId: 'pitmf_qualify', strategyEvaluationId: 'qualify_eval' },
      intendedEligibleUniverse: bridged.intendedEligibleUniverse,
      observedUsableEntityIds: bridged.observedUsableEntityIds,
    }).researchDatasetId === 'qualify_eval';

  const result = evaluateAafv205Qualification({
    deterministicDiagnostics: true,
    megaCapAltDataDetected: mega.severity === 'SEVERE',
    survivorshipDetected: surv.findings.some((row) => row.dimension === 'SURVIVORSHIP_BIAS'),
    sectorBiasDetected: sector.findings.some((row) => row.dimension === 'SECTOR_BIAS'),
    providerBiasDetected: provider.findings.some((row) =>
      ['PROVIDER_BIAS', 'GEOGRAPHIC_BIAS'].includes(row.dimension),
    ),
    liquidityBiasDetected: liq.findings.some((row) => row.dimension === 'LIQUIDITY_BIAS'),
    delistingBiasDetected: delist.findings.some((row) => row.dimension === 'DELISTING_BIAS'),
    cleanControlPasses: clean.severity === 'PASS',
    severeBlocksPromotion: evaluateBiasPromotionGate({ assessment: mega }).permitted === false,
    warningRequiresReview:
      evaluateBiasPromotionGate({ assessment: sector }).decision === 'REVIEW_REQUIRED' ||
      sector.severity === 'SEVERE',
    noCausalClaimsFromCorrelation: mega.findings.every((f) =>
      f.evidence.every((e) => e.correlationIsNotCausation),
    ),
    evidenceVaultIntegration: evidenceId !== null,
    coverageTensorBridge: bridged.intendedEligibleUniverse.length >= 30,
    compilerManifestBridge: manifestOk,
    noExecutionAuthority:
      clean.grantsExecutionAuthority === false &&
      ENVIRONMENT === 'simulation' &&
      LIVE_TRADING_ENABLED === false,
  });

  console.log(JSON.stringify({ marker: result.marker, qualified: result.qualified, blockers: result.blockers }, null, 2));
  process.exit(result.marker === HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED ? 0 : 1);
}

main();
