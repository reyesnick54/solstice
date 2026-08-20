import {
  buildOperationPackage,
  developmentEvidence,
  runPreflight,
} from '../../../governance-ops/engine.ts';

import {
  AUTHORIZATION_PREFLIGHT_CHECKS,
  type AuthorizationPreflightCheck,
  type AuthorizationPreflightReport,
  type ExternalEvidenceBinding,
  type OperatingScopeBinding,
  type ProductionEconomicAuthorizationPackage,
  type ProductionEconomicParameterDiff,
  type ProviderBindingMatrix,
  type SupplyModelReport,
} from './types.ts';

export type AuthorizationPreflightInput = {
  readonly pkg: ProductionEconomicAuthorizationPackage;
  readonly diff: ProductionEconomicParameterDiff;
  readonly evidence: ExternalEvidenceBinding;
  readonly operatingScope: OperatingScopeBinding;
  readonly providers: ProviderBindingMatrix;
  readonly supplyModel: SupplyModelReport;
  readonly nowUtc: string;
  readonly schemaValid?: boolean;
  readonly formalSmoke?: boolean;
  readonly propertyTests?: boolean;
  readonly economicStress?: boolean;
  readonly dualEconomySimulation?: boolean;
  readonly supplyInvariants?: boolean;
  readonly economicRcBound?: boolean;
  readonly mainnetRcBound?: boolean;
  readonly fullPlatformBurnIn?: boolean;
  readonly adversarialCampaign?: boolean;
  readonly expectedParameterHash?: string;
  readonly expectedEconomicRcHash?: string;
  readonly expectedReleaseHash?: string;
};

export function runAuthorizationPreflight(input: AuthorizationPreflightInput): AuthorizationPreflightReport {
  const governancePkg = buildOperationPackage({
    packageId: `gov.${input.pkg.packageId}`,
    operationType: 'MONETARY_POLICY',
    networkId: input.pkg.networkId,
    chainId: input.pkg.chainId,
    networkClass: 'PRODUCTION_CANDIDATE',
    activation: { kind: 'HEIGHT', height: 0, epoch: null },
    approvalValidFromUtc: input.pkg.approvalWindow.validFromUtc,
    approvalValidUntilUtc: input.pkg.approvalWindow.validUntilUtc,
    evidence: developmentEvidence(input.pkg.packageId),
  });
  const governance = runPreflight({
    pkg: governancePkg,
    nowUtc: input.nowUtc,
    ...(input.schemaValid === undefined ? {} : { schemaValid: input.schemaValid }),
    ...(input.formalSmoke === undefined ? {} : { formalSmoke: input.formalSmoke }),
    ...(input.propertyTests === undefined ? {} : { propertyTests: input.propertyTests }),
    ...(input.economicStress === undefined ? {} : { economicStress: input.economicStress }),
    ...(input.supplyInvariants === undefined ? {} : { supplyInvariants: input.supplyInvariants }),
    ...(input.expectedEconomicRcHash === undefined ? {} : { expectedEconomicRcHash: input.expectedEconomicRcHash }),
    ...(input.expectedReleaseHash === undefined ? {} : { expectedReleaseHash: input.expectedReleaseHash }),
  });
  const parameterHashOk =
    (input.expectedParameterHash ?? input.pkg.parameterPackageHash) === input.pkg.parameterPackageHash;
  const extra: readonly AuthorizationPreflightCheck[] = [
    check('SCHEMA_VALIDATION', input.schemaValid !== false && input.pkg.schemaVersion === 1, 'authorization schema v1'),
    check('FORMAL_SMOKE', input.formalSmoke !== false && governance.checks.some((row) => row.id === 'FORMAL_SMOKE' && row.passed), 'governance formal smoke reused'),
    check('PROPERTY_TESTS', input.propertyTests !== false, 'property checks bound'),
    check('ECONOMIC_STRESS', input.economicStress !== false, 'economic stress evidence required'),
    check('DUAL_ECONOMY_SIMULATION', input.dualEconomySimulation !== false, 'dual-economy simulation required'),
    check(
      'SUPPLY_INVARIANTS',
      input.supplyInvariants !== false && input.supplyModel.supplyBookAuthority === 'CHUNK_71_ASSET_SUPPLY_BOOK',
      'AssetSupplyBook remains supply authority',
    ),
    check('ECONOMIC_RC', input.economicRcBound !== false && input.pkg.economicRcHash.length === 64, 'economic RC hash bound'),
    check('MAINNET_RC', input.mainnetRcBound !== false, 'mainnet RC bound'),
    check('FULL_PLATFORM_BURN_IN', input.fullPlatformBurnIn === true, 'full-platform burn-in required'),
    check('ADVERSARIAL_CAMPAIGN', input.adversarialCampaign === true, 'adversarial campaign required'),
    check('PARAMETER_HASH_VERIFICATION', parameterHashOk && input.diff.diffHash === input.pkg.parameterDiffHash, 'parameter and diff hashes bound'),
    check(
      'PROVIDER_READINESS',
      input.providers.unrelatedProviderMissingBlocksProtocol === false,
      'provider matrix bound; unrelated providers do not block protocol',
    ),
    check(
      'OPERATING_SCOPE',
      input.operatingScope.nativeProtocolSeparatedFromRegulatedServices &&
        input.operatingScope.matrixHash === input.pkg.operatingScopeMatrixHash,
      'operating scope matrix bound',
    ),
    check(
      'EXTERNAL_EVIDENCE',
      input.evidence.bundleHash === input.pkg.externalEvidenceBundleHash,
      'external evidence bundle hash bound',
    ),
  ];
  const checks = AUTHORIZATION_PREFLIGHT_CHECKS.map(
    (id) => extra.find((row) => row.id === id) ?? check(id, false, 'missing'),
  );
  return Object.freeze({
    authorizationHash: input.pkg.authorizationHash,
    checks: Object.freeze(checks),
    passed: checks.every((row) => row.passed),
    governancePreflightPassed: governance.passed,
    binaryInstallActivatesPolicy: false,
    productionActivated: false,
  });
}

function check(id: AuthorizationPreflightCheck['id'], passed: boolean, detail: string): AuthorizationPreflightCheck {
  return Object.freeze({ id, passed, detail });
}
