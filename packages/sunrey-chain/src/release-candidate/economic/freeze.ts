import { nativeAssetConstitution, currentPolicyVersion } from '../../economics/constitution.ts';
import { PROTOCOL_TREASURY_CLASS, PRODUCTION_PARAMETER_UNCONFIGURED } from '../../economics/types.ts';
import {
  developmentFeeDispositionPolicyV2,
  hashFeeDispositionPolicyV2,
} from '../../fees/v2/disposition.ts';
import { developmentFeePolicyV2, hashFeePolicyV2, productionUnconfiguredFeePolicyV2 } from '../../fees/v2/policy.ts';
import { developmentResourceWeightSchedule, hashResourceWeightSchedule } from '../../fees/v2/weights.ts';
import { commitCanonical } from '../../hash.ts';
import { developmentPolicyBundle, hashPolicyBundle } from '../../productive/policy-governance/registry.ts';
import { sha256File, sha256Text } from '../../supply-chain/inventory.ts';
import { TESTNET_PROTOCOL_VERSION } from '../../testnet/identity.ts';
import { freezeArtifacts, testnetIdentityFreeze } from '../freeze.ts';
import { createEconomicPolicy, productionBondPolicy } from '../../validator-economics/policy.ts';
import {
  ECONOMIC_POLICY_FREEZE_KEYS,
  ECONOMIC_SCHEMA_FREEZE_KEYS,
  PRODUCTION_PARAMETER_UNCONFIGURED as UNCONFIGURED,
  type EconomicPolicyFreeze,
  type EconomicPolicyFreezeKey,
  type EconomicSchemaFreeze,
  type EconomicSchemaFreezeKey,
  type EconomicSourceBinding,
  type UnconfiguredProductionValue,
} from './types.ts';

const SCHEMA_PATHS: Readonly<Record<EconomicSchemaFreezeKey, readonly string[]>> = {
  monetaryPolicy: [
    'packages/sunrey-chain/src/economics/types.ts',
    'packages/sunrey-chain/src/economics/constitution.ts',
  ],
  issuanceAuthority: [
    'packages/sunrey-chain/src/economics/issuance.ts',
    'packages/sunrey-chain/src/economics/types.ts',
  ],
  validatorEconomics: [
    'packages/sunrey-chain/src/validator-economics/types.ts',
    'packages/sunrey-chain/src/validator-economics/policy.ts',
  ],
  feePolicy: [
    'packages/sunrey-chain/src/fees/v2/types.ts',
    'packages/sunrey-chain/src/fees/v2/policy.ts',
  ],
  moonreyContributionPolicy: [
    'packages/sunrey-chain/src/productive/policy-governance/types.ts',
    'packages/sunrey-chain/src/productive/policy-governance/registry.ts',
  ],
  treasuryBudget: [
    'packages/sunrey-chain/src/fees/v2/disposition.ts',
    'packages/sunrey-chain/src/economics/types.ts',
  ],
  treasuryDisbursement: [
    'packages/sunrey-chain/src/fees/v2/disposition.ts',
    'packages/sunrey-chain/src/economics/types.ts',
  ],
  economicReports: [
    'packages/sunrey-chain/src/economics/auditor.ts',
    'packages/sunrey-chain/src/economics/readiness.ts',
    'packages/sunrey-economics/src/types.ts',
  ],
};

function digestPaths(root: string, paths: readonly string[]): string {
  return sha256Text(paths.map((rel) => `${rel}:${sha256File(root, rel) ?? `missing:${rel}`}`).join('\n'));
}

export function unconfiguredProductionValues(): readonly UnconfiguredProductionValue[] {
  const productionBond = productionBondPolicy();
  const productionFee = productionUnconfiguredFeePolicyV2();
  return Object.freeze([
    Object.freeze({
      id: 'sunrey.maximumSupply',
      value: UNCONFIGURED,
      notes: 'Chunk 71 constitution. Production maximum supply is not invented.',
    }),
    Object.freeze({
      id: 'moonrey.maximumSupply',
      value: UNCONFIGURED,
      notes: 'Chunk 71 constitution. Production MoonRey maximum supply is not invented.',
    }),
    Object.freeze({
      id: 'validator.bondAsset',
      value: UNCONFIGURED,
      notes: `Chunk 72 production bond asset remains ${productionBond.bondAssetStatus}.`,
    }),
    Object.freeze({
      id: 'validator.minimumBond',
      value: UNCONFIGURED,
      notes: 'Chunk 72 production minimum bond remains UNCONFIGURED.',
    }),
    Object.freeze({
      id: 'fee.productionParameters',
      value: UNCONFIGURED,
      notes: `FeePolicyV2 productionParametersConfigured=${String(productionFee.productionParametersConfigured)}.`,
    }),
    Object.freeze({
      id: 'treasury.productionBudget',
      value: UNCONFIGURED,
      notes: 'Protocol treasury production budget is not populated to complete qualification.',
    }),
    Object.freeze({
      id: 'treasury.productionDisbursement',
      value: UNCONFIGURED,
      notes: 'Protocol treasury production disbursement is not populated to complete qualification.',
    }),
    Object.freeze({
      id: 'public.tickers',
      value: UNCONFIGURED,
      notes: 'Tickers remain NOT_ASSIGNED. NOT_ASSIGNED is not a production ticker.',
    }),
  ]);
}

export function freezeEconomicPolicies(root: string): EconomicPolicyFreeze {
  const constitution = nativeAssetConstitution();
  const sunrey = constitution.assets.find((row) => row.assetId === 'SUNREY_COIN');
  const moonrey = constitution.assets.find((row) => row.assetId === 'MOONREY_COIN');
  const version = currentPolicyVersion('DEVELOPMENT_ACTIVE');
  const validator = createEconomicPolicy('development', 1);
  const fee = developmentFeePolicyV2();
  const weights = developmentResourceWeightSchedule();
  const disposition = developmentFeeDispositionPolicyV2();
  const moonreyBundle = developmentPolicyBundle();
  const hashes: Record<EconomicPolicyFreezeKey, string> = {
    sunreyMonetaryPolicy: commitCanonical({
      versionId: version.versionId,
      assetId: 'SUNREY_COIN',
      purpose: sunrey?.assetPurpose ?? 'HUMAN_ECONOMIC_LAYER',
      issuance: sunrey?.issuancePolicy.policyVersion ?? 'missing',
      productionActivation: sunrey?.issuancePolicy.productionActivation ?? PRODUCTION_PARAMETER_UNCONFIGURED,
    }),
    moonreyMonetaryPolicy: commitCanonical({
      versionId: version.versionId,
      assetId: 'MOONREY_COIN',
      purpose: moonrey?.assetPurpose ?? 'AUTONOMOUS_PRODUCTIVE_ECONOMY',
      issuance: moonrey?.issuancePolicy.policyVersion ?? 'missing',
      productionActivation: moonrey?.issuancePolicy.productionActivation ?? PRODUCTION_PARAMETER_UNCONFIGURED,
    }),
    validatorBondPolicy: commitCanonical(validator.bond),
    validatorRewardPolicy: commitCanonical(validator.reward),
    validatorPenaltyPolicy: commitCanonical(validator.penalty),
    feePolicyV2: hashFeePolicyV2(fee),
    resourceWeightSchedule: hashResourceWeightSchedule(weights),
    feeDispositionPolicy: hashFeeDispositionPolicyV2(disposition),
    moonreyProductivePolicy: hashPolicyBundle(moonreyBundle),
    normalizationRules: commitCanonical(moonreyBundle.normalizationRules),
    issuanceBudgets: commitCanonical(moonreyBundle.budget),
    protocolTreasuryPolicy: commitCanonical({
      class: PROTOCOL_TREASURY_CLASS,
      disposition: hashFeeDispositionPolicyV2(disposition),
      productionBudget: UNCONFIGURED,
      productionDisbursement: UNCONFIGURED,
    }),
    dualEconomyScenarioSchema: digestPaths(root, [
      'packages/sunrey-economics/src/types.ts',
      'packages/sunrey-economics/src/ids.ts',
      'packages/sunrey-economics/config/scenarios/baseline.json',
    ]),
  };
  return Object.freeze({
    schemaVersion: 1,
    hashes: Object.freeze(hashes),
    unconfiguredProductionValues: unconfiguredProductionValues(),
    combinedHash: sha256Text(ECONOMIC_POLICY_FREEZE_KEYS.map((key) => `${key}:${hashes[key]}`).join('|')),
  });
}

export function freezeEconomicSchemas(root: string): EconomicSchemaFreeze {
  const hashes = Object.fromEntries(
    ECONOMIC_SCHEMA_FREEZE_KEYS.map((key) => [key, digestPaths(root, SCHEMA_PATHS[key])]),
  ) as Record<EconomicSchemaFreezeKey, string>;
  return Object.freeze({
    schemaVersion: 1,
    hashes: Object.freeze(hashes),
    breakingChangeRequiresNewRc: true,
    combinedHash: sha256Text(ECONOMIC_SCHEMA_FREEZE_KEYS.map((key) => `${key}:${hashes[key]}`).join('|')),
  });
}

export function bindEconomicSource(input: {
  readonly root: string;
  readonly sourceCommit: string;
  readonly policy: EconomicPolicyFreeze;
  readonly schema: EconomicSchemaFreeze;
  readonly formalDigest: string;
  readonly stressDigest: string;
  readonly supplyChainDigest: string;
}): EconomicSourceBinding {
  const identity = testnetIdentityFreeze();
  const artifacts = freezeArtifacts(input.root);
  return Object.freeze({
    sourceCommit: input.sourceCommit,
    protocolVersion: TESTNET_PROTOCOL_VERSION,
    networkId: identity.networkId,
    chainId: identity.chainId,
    releaseArtifactDigest: artifacts.combinedDigest,
    economicSchemaVersions: Object.freeze({
      monetary: 'sunrey.monetary.constitution.v1',
      validatorEconomics: '1',
      feePolicyV2: '2',
      moonreyPolicy: 'sunrey.moonrey.policy.v1',
      dualEconomy: '1',
      schemaFreeze: input.schema.combinedHash,
    }),
    policyHashes: input.policy.hashes,
    formalEvidenceDigest: input.formalDigest,
    stressEvidenceDigest: input.stressDigest,
    supplyChainEvidenceDigest: input.supplyChainDigest,
  });
}

export function economicMaterialChange(left: EconomicPolicyFreeze, right: EconomicPolicyFreeze): boolean {
  return left.combinedHash !== right.combinedHash;
}

export function economicSchemaChange(left: EconomicSchemaFreeze, right: EconomicSchemaFreeze): boolean {
  return left.combinedHash !== right.combinedHash;
}
