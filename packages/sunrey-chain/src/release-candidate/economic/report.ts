import { sha256Text } from '../../supply-chain/inventory.ts';
import type {
  EconomicCompatibilityReport,
  EconomicQualificationReport,
  EconomicReleaseReadinessReport,
  SignedEconomicRcBundle,
} from './types.ts';

export function buildEconomicQualificationReport(bundle: SignedEconomicRcBundle): EconomicQualificationReport {
  return Object.freeze({
    rcId: bundle.manifest.economic_rc_id,
    sourceCommit: bundle.manifest.source_commit,
    policyHashes: Object.freeze({
      sunreyMonetary: bundle.manifest.monetary_policy_hashes.sunrey,
      moonreyMonetary: bundle.manifest.monetary_policy_hashes.moonrey,
      feePolicyV2: bundle.manifest.fee_policy_hash,
      validatorEconomics: bundle.manifest.validator_economics_hash,
      moonreyPolicy: bundle.manifest.moonrey_policy_hash,
      treasuryPolicy: bundle.manifest.treasury_policy_hash,
    }),
    matrix: Object.freeze(bundle.qualification.cells.map((row) => Object.freeze({ category: row.category, state: row.state }))),
    formalResult: bundle.evidence.formal.result,
    stressResult: bundle.evidence.stress.ok ? 'PASS' : `FAIL:${bundle.evidence.stress.criticalFailures.join(',')}`,
    simulationResult: bundle.evidence.simulation.ok ? `PASS:${bundle.evidence.simulation.scenarios.join(',')}` : 'FAIL',
    sevenValidatorResult: bundle.evidence.sevenValidator.ok ? 'PASS' : 'FAIL',
    supplyReconciliation: bundle.evidence.supply,
    recoveryResult: bundle.evidence.recovery.invariantsIdentical && bundle.evidence.recovery.snapshot && bundle.evidence.recovery.postgres && bundle.evidence.recovery.explorer
      ? 'PASS'
      : 'FAIL',
    performanceContext: bundle.evidence.performance.context,
    knownLimitations: Object.freeze(bundle.limitations.map((row) => row.id)),
    unconfiguredProductionValues: bundle.policyFreeze.unconfiguredProductionValues,
    mainnetReady: false,
    regulatoryApproval: false,
  });
}

export function buildEconomicCompatibilityReport(bundle: SignedEconomicRcBundle): EconomicCompatibilityReport {
  return Object.freeze({
    typescriptSdkReadsFrozenPolicies: bundle.evidence.compatibility.typescriptSdk,
    rustSdkReadsFrozenPolicies: bundle.evidence.compatibility.rustSdk,
    typescriptSdkReadsReceipts: bundle.evidence.compatibility.typescriptSdk,
    rustSdkReadsReceipts: bundle.evidence.compatibility.rustSdk,
    explorerMonetary: bundle.evidence.compatibility.explorer,
    explorerSupply: bundle.evidence.compatibility.explorer,
    explorerValidatorEconomics: bundle.evidence.compatibility.explorer,
    explorerFees: bundle.evidence.compatibility.explorer,
    explorerMoonreyProvenance: bundle.evidence.compatibility.explorer,
    explorerTreasury: bundle.evidence.compatibility.explorer,
    digest: bundle.evidence.compatibility.digest,
  });
}

export function buildEconomicReadinessReport(bundle: SignedEconomicRcBundle): EconomicReleaseReadinessReport {
  const engineering = bundle.manifest.qualification_result === 'QUALIFICATION_IN_PROGRESS'
    ? 'QUALIFICATION_IN_PROGRESS'
    : 'ENGINEERING_VERIFIED';
  return Object.freeze({
    rcId: bundle.manifest.economic_rc_id,
    engineeringStatus: engineering,
    mainnetAuthorized: false,
    externalApprovalsRemain: true,
    digest: sha256Text(JSON.stringify({
      rcId: bundle.manifest.economic_rc_id,
      engineering,
      mainnetAuthorized: false,
    })),
  });
}
