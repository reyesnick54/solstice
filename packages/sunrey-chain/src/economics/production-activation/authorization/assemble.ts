import { commitGovernance, containsPrivateKeyMaterial } from '../../../governance-ops/hash.ts';
import type { GovernanceOfflinePackage } from '../../../governance-ops/types.ts';
import { evaluateProductionEconomicActivation } from '../firewall.ts';
import { currentRepositorySnapshot } from '../fixtures.ts';
import type { ProductionEconomicParameterPackage } from '../parameter-package/types.ts';
import { currentRepositoryParameterPackage, validateParameterPackage } from '../parameter-package/validation.ts';
import { completeFixturePackageInput } from '../parameter-package/fixtures.ts';

import { evaluateProductionApprovals } from './approvals.ts';
import {
  bindExternalEvidence,
  currentExternalEvidenceSlots,
  currentOperatingScopeBinding,
  currentProviderBindingMatrix,
} from './bindings.ts';
import {
  missingProductionParameters,
  parameterStatusesFromPackage,
  productionParametersConfigured,
  rehearsalParametersPresent,
} from './classify.ts';
import { diffProductionAuthorizationParameters, parameterDiffSummary } from './diff.ts';
import { bindGenesisAuthorization, type GenesisInvariantInput } from './genesis.ts';
import { hashAuthorizationMaterial } from './hash.ts';
import { runAuthorizationPreflight, type AuthorizationPreflightInput } from './preflight.ts';
import { bindMoonReyIssuanceProposal, bindSunReyIssuanceProposal } from './proposals.ts';
import { runDeterministicSupplyModel } from './supply-model.ts';
import {
  REQUIRED_HUMAN_AUTHORIZATION_ROLES,
  type AuthorizationBlockerCode,
  type ProductionEconomicApprovalBinding,
  type ProductionEconomicAuthorizationEvaluation,
  type ProductionEconomicAuthorizationInput,
  type ProductionEconomicAuthorizationOfflinePayload,
  type ProductionEconomicAuthorizationPackage,
  type ProductionEconomicAuthorizationState,
} from './types.ts';

export const CURRENT_AUTHORIZATION_NETWORK_ID = 'sunrey-production-candidate-1' as const;
export const CURRENT_AUTHORIZATION_CHAIN_ID = 'sunrey-production-candidate-chain-1' as const;
export const CURRENT_SOURCE_COMMIT = 'sunrey.repository.constitution-bound.v1' as const;

export function assembleAuthorizationPackage(
  input: ProductionEconomicAuthorizationInput,
  status: ProductionEconomicAuthorizationState = 'DRAFT',
): ProductionEconomicAuthorizationPackage {
  const draft = {
    ...input,
    schemaVersion: 1 as const,
    requiredHumanRoles: REQUIRED_HUMAN_AUTHORIZATION_ROLES,
    productionActivationRequested: false as const,
    productionActivated: false as const,
    aiMayApprove: false as const,
    rehearsalParametersPromoted: false as const,
    chunk71RemainsMonetaryAuthority: true as const,
    assetSupplyBookRemainsSupplyAuthority: true as const,
    peveIsSunReyTokenValuation: false as const,
    referencePriceCanMintMoonRey: false as const,
    firewallMayBeOverridden: false as const,
  };
  return Object.freeze({
    ...draft,
    status,
    authorizationHash: hashAuthorizationMaterial(input),
  });
}

export function evaluateProductionEconomicAuthorization(input: {
  readonly currentParameters: ProductionEconomicParameterPackage;
  readonly proposedParameters: ProductionEconomicParameterPackage;
  readonly packageId?: string;
  readonly nowUtc?: string;
  readonly approvals?: readonly ProductionEconomicApprovalBinding[];
  readonly evidenceSlots?: ReturnType<typeof currentExternalEvidenceSlots>;
  readonly genesis?: GenesisInvariantInput;
  readonly peveUsedAsTokenValuation?: boolean;
  readonly referencePriceMintsDirectly?: boolean;
  readonly preflight?: Partial<Omit<AuthorizationPreflightInput, 'pkg' | 'diff' | 'evidence' | 'operatingScope' | 'providers' | 'supplyModel' | 'nowUtc'>>;
  readonly forceActivation?: boolean;
  readonly supersededBy?: string | null;
}): ProductionEconomicAuthorizationEvaluation {
  const nowUtc = input.nowUtc ?? '2026-08-20T12:00:00.000Z';
  const evidence = bindExternalEvidence(input.evidenceSlots ?? currentExternalEvidenceSlots(), nowUtc);
  const operatingScope = currentOperatingScopeBinding();
  const providers = currentProviderBindingMatrix();
  const genesis = bindGenesisAuthorization(input.genesis ?? {});
  const sunrey = bindSunReyIssuanceProposal(
    input.peveUsedAsTokenValuation === undefined ? undefined : { peveUsedAsTokenValuation: input.peveUsedAsTokenValuation },
  );
  const moonrey = bindMoonReyIssuanceProposal(
    input.referencePriceMintsDirectly === undefined
      ? undefined
      : { referencePriceMintsDirectly: input.referencePriceMintsDirectly },
  );
  const diff = diffProductionAuthorizationParameters(input.currentParameters, input.proposedParameters);
  const parameterStatuses = parameterStatusesFromPackage(input.proposedParameters);
  const architectureManifestHash = commitGovernance({
    capability: 'sunrey-production-economic-authorization',
    manifest: 'docs/architecture/manifest.json',
  });
  const pkgInput: ProductionEconomicAuthorizationInput = {
    packageId: input.packageId ?? 'sunrey.production-economic-authorization.v1',
    parameterPackageHash: input.proposedParameters.packageHash,
    sunreyPolicyHash: sunrey.binding.policyHash,
    moonreyPolicyHash: moonrey.binding.policyHash,
    economicConstitutionCandidateHash: commitGovernance({ bundle: 'sunrey.economics.production-constitution.candidate.v1' }),
    economicRcHash: commitGovernance({ economicRc: 'erc-1' }),
    fullPlatformCandidateHash: commitGovernance({ bundle: 'sunrey.production.full-platform-candidate.v1' }),
    externalEvidenceBundleHash: evidence.bundleHash,
    operatingScopeMatrixHash: operatingScope.matrixHash,
    providerBindingMatrixHash: providers.matrixHash,
    architectureManifestHash,
    sourceCommit: CURRENT_SOURCE_COMMIT,
    parameterStatuses,
    approvalWindow: {
      validFromUtc: '2026-01-01T00:00:00.000Z',
      validUntilUtc: '2026-12-31T00:00:00.000Z',
    },
    networkId: CURRENT_AUTHORIZATION_NETWORK_ID,
    chainId: CURRENT_AUTHORIZATION_CHAIN_ID,
    parameterDiffHash: diff.diffHash,
    genesisManifestHash: genesis.binding.manifestHash,
    supersededBy: input.supersededBy ?? null,
  };
  const hashed = assembleAuthorizationPackage(pkgInput, 'DRAFT');
  const supplyModel = runDeterministicSupplyModel(parameterStatuses);
  const judgedApprovals = evaluateProductionApprovals({
    pkg: hashed,
    bindings: input.approvals ?? [],
    nowUtc,
    currentEvidenceHash: evidence.bundleHash,
    currentOperatingScopeHash: operatingScope.matrixHash,
    currentProviderHash: providers.matrixHash,
    currentParameterDiffHash: diff.diffHash,
    currentEconomicRcHash: hashed.economicRcHash,
    currentFullPlatformHash: hashed.fullPlatformCandidateHash,
  });
  const preflight = runAuthorizationPreflight({
    pkg: hashed,
    diff,
    evidence,
    operatingScope,
    providers,
    supplyModel,
    nowUtc,
    ...input.preflight,
  });
  const blockers = collectBlockers({
    parameterStatuses,
    proposed: input.proposedParameters,
    evidence,
    genesis: genesis.blockers,
    sunrey: sunrey.blockers,
    moonrey: moonrey.blockers,
    approvals: judgedApprovals,
    preflight,
    nowUtc,
    window: hashed.approvalWindow,
    supersededBy: input.supersededBy ?? null,
    forceActivation: input.forceActivation === true,
  });
  const status = deriveStatus(blockers, judgedApprovals.set.satisfied, preflight.passed, nowUtc, hashed.approvalWindow, input.supersededBy ?? null);
  const pkg = assembleAuthorizationPackage(pkgInput, status);
  const firewall = evaluateFirewallWithAuthorization(pkg);
  void firewall;
  return Object.freeze({
    pkg,
    diff,
    evidence,
    operatingScope,
    providers,
    genesis: genesis.binding,
    sunrey: sunrey.binding,
    moonrey: moonrey.binding,
    supplyModel,
    preflight,
    approvals: judgedApprovals.set,
    approvalBindings: judgedApprovals.bindings,
    blockers,
    s3mMaySummarize: true,
    s3mMayApprove: false,
    realProductionParametersConfigured: productionParametersConfigured(parameterStatuses) ? true : false,
    rehearsalParametersPromoted: false,
    productionActive: false,
  });
}

export function evaluateCurrentRepositoryAuthorization(): ProductionEconomicAuthorizationEvaluation {
  return evaluateProductionEconomicAuthorization({
    currentParameters: currentRepositoryParameterPackage(),
    proposedParameters: currentRepositoryParameterPackage(),
    packageId: 'sunrey.production-economic-authorization.current.v1',
    preflight: {
      fullPlatformBurnIn: false,
      adversarialCampaign: false,
    },
  });
}

export function evaluateRehearsalPromotionAttempt(): ProductionEconomicAuthorizationEvaluation {
  const rehearsal = validateParameterPackage(completeFixturePackageInput()).package;
  return evaluateProductionEconomicAuthorization({
    currentParameters: currentRepositoryParameterPackage(),
    proposedParameters: rehearsal,
    packageId: 'sunrey.production-economic-authorization.rehearsal-promotion.v1',
  });
}

export function evaluateFirewallWithAuthorization(pkg: ProductionEconomicAuthorizationPackage): {
  readonly firewallProductionActivated: false;
  readonly authorizationProductionActivated: false;
  readonly overrideRejected: true;
  readonly liveFlagsChanged: false;
} {
  const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  if (pkg.productionActivationRequested !== false || pkg.productionActivated !== false) {
    throw new TypeError('authorization package cannot request production activation');
  }
  if (decision.productionActivated !== false) {
    throw new TypeError('firewall cannot activate production');
  }
  return Object.freeze({
    firewallProductionActivated: false,
    authorizationProductionActivated: false,
    overrideRejected: true,
    liveFlagsChanged: false,
  });
}

export function attemptOverrideFirewall(): string {
  return 'FIREWALL_OVERRIDE_FORBIDDEN';
}

export function attemptForceActivation(): string {
  return 'PRODUCTION_ACTIVATION_FORBIDDEN';
}

export function s3mAuthorizationReview(evaluation: ProductionEconomicAuthorizationEvaluation): {
  readonly summary: string;
  readonly diffHash: string;
  readonly riskHighlights: readonly string[];
  readonly signed: false;
  readonly approved: false;
  readonly valuesSet: false;
} {
  return Object.freeze({
    summary: `S3M review of ${evaluation.pkg.packageId}: status=${evaluation.pkg.status}; blockers=${evaluation.blockers.join(',')}`,
    diffHash: evaluation.diff.diffHash,
    riskHighlights: Object.freeze([...evaluation.blockers]),
    signed: false,
    approved: false,
    valuesSet: false,
  });
}

export function buildProductionAuthorizationOfflinePackage(
  evaluation: ProductionEconomicAuthorizationEvaluation,
): GovernanceOfflinePackage {
  const payload: ProductionEconomicAuthorizationOfflinePayload = Object.freeze({
    hashes: Object.freeze({
      authorizationHash: evaluation.pkg.authorizationHash,
      parameterPackageHash: evaluation.pkg.parameterPackageHash,
      parameterDiffHash: evaluation.diff.diffHash,
      evidenceBundleHash: evaluation.evidence.bundleHash,
      operatingScopeHash: evaluation.operatingScope.matrixHash,
      providerBindingHash: evaluation.providers.matrixHash,
      economicRcHash: evaluation.pkg.economicRcHash,
      fullPlatformCandidateHash: evaluation.pkg.fullPlatformCandidateHash,
      architectureManifestHash: evaluation.pkg.architectureManifestHash,
    }),
    versions: Object.freeze({
      schemaVersion: evaluation.pkg.schemaVersion,
      policyVersion: 1,
      toolVersion: 'sunrey-economics/production-economic-authorization/1' as const,
    }),
    networkId: evaluation.pkg.networkId,
    chainId: evaluation.pkg.chainId,
    parameterDiffSummary: parameterDiffSummary(evaluation.diff),
    activationCandidateReference: evaluation.pkg.packageId,
    approvalExpiryUtc: evaluation.pkg.approvalWindow.validUntilUtc,
  });
  if (containsPrivateKeyMaterial(payload)) {
    throw new TypeError('production authorization offline package cannot contain private keys');
  }
  return Object.freeze({
    kind: 'SUNREY_GOVERNANCE_OFFLINE_PACKAGE',
    packageKind: 'PRODUCTION_ECONOMIC_AUTHORIZATION',
    payload,
    payloadHash: commitGovernance(payload),
    containsPrivateKeys: false,
  });
}

function collectBlockers(input: {
  readonly parameterStatuses: ProductionEconomicAuthorizationPackage['parameterStatuses'];
  readonly proposed: ProductionEconomicParameterPackage;
  readonly evidence: ReturnType<typeof bindExternalEvidence>;
  readonly genesis: readonly AuthorizationBlockerCode[];
  readonly sunrey: readonly AuthorizationBlockerCode[];
  readonly moonrey: readonly AuthorizationBlockerCode[];
  readonly approvals: ReturnType<typeof evaluateProductionApprovals>;
  readonly preflight: ReturnType<typeof runAuthorizationPreflight>;
  readonly nowUtc: string;
  readonly window: ProductionEconomicAuthorizationPackage['approvalWindow'];
  readonly supersededBy: string | null;
  readonly forceActivation: boolean;
}): readonly AuthorizationBlockerCode[] {
  const blockers: AuthorizationBlockerCode[] = [];
  if (rehearsalParametersPresent(input.parameterStatuses) || input.proposed.parameters.some((row) => row.fixture || row.rehearsalOnly)) {
    blockers.push('REHEARSAL_PARAMETERS_CANNOT_BE_PROMOTED');
  }
  if (missingProductionParameters(input.parameterStatuses).length > 0) {
    blockers.push('PARAMETERS_INCOMPLETE');
    blockers.push('PRODUCTION_PARAMETERS_UNCONFIGURED');
  }
  if (!input.preflight.passed) {
    if (input.preflight.checks.some((row) => !row.passed && (row.id === 'FULL_PLATFORM_BURN_IN' || row.id === 'ADVERSARIAL_CAMPAIGN' || row.id === 'ECONOMIC_STRESS'))) {
      blockers.push('PREFLIGHT_REQUIRED');
    }
    if (input.preflight.checks.some((row) => row.id === 'SCHEMA_VALIDATION' && !row.passed)) {
      blockers.push('PREFLIGHT_FAILED');
    }
  }
  if (input.evidence.revoked) {
    blockers.push('EXTERNAL_EVIDENCE_REVOKED');
  }
  if (input.evidence.expired) {
    blockers.push('EXTERNAL_EVIDENCE_EXPIRED');
  }
  if (!input.evidence.allRequiredPresent) {
    blockers.push('EXTERNAL_EVIDENCE_MISSING');
  }
  if (!input.approvals.set.satisfied) {
    blockers.push('AWAITING_HUMAN_APPROVALS');
  }
  for (const row of input.approvals.bindings) {
    if (row.rejectionReason === 'AI_CANNOT_APPROVE') blockers.push('AI_CANNOT_APPROVE');
    if (row.rejectionReason === 'AGENT_CANNOT_APPROVE') blockers.push('AGENT_CANNOT_APPROVE');
    if (row.rejectionReason === 'AUTOMATION_CANNOT_APPROVE') blockers.push('AUTOMATION_CANNOT_APPROVE');
    if (row.rejectionReason === 'STALE_SIGNATURE') blockers.push('STALE_SIGNATURE');
    if (row.rejectionReason === 'PARAMETER_HASH_CHANGED') blockers.push('PARAMETER_HASH_CHANGED');
    if (row.rejectionReason === 'RELEASE_HASH_CHANGED') blockers.push('RELEASE_HASH_CHANGED');
    if (row.rejectionReason === 'EVIDENCE_HASH_CHANGED') blockers.push('EVIDENCE_HASH_CHANGED');
    if (row.rejectionReason === 'OPERATING_SCOPE_CHANGED') blockers.push('OPERATING_SCOPE_CHANGED');
    if (row.rejectionReason === 'PROVIDER_MATRIX_CHANGED') blockers.push('PROVIDER_MATRIX_CHANGED');
  }
  const accepted = input.approvals.bindings.filter((row) => row.accepted);
  const actors = new Set(accepted.map((row) => row.record.actorId));
  if (accepted.length > 0 && actors.size !== accepted.length) {
    blockers.push('DISTINCT_HUMAN_ROLES_REQUIRED');
  }
  blockers.push(...input.genesis, ...input.sunrey, ...input.moonrey);
  if (input.nowUtc > input.window.validUntilUtc) {
    blockers.push('STALE_SIGNATURE');
  }
  if (input.forceActivation) {
    blockers.push('FIREWALL_OVERRIDE_FORBIDDEN');
    blockers.push('PRODUCTION_ACTIVATION_FORBIDDEN');
  }
  return Object.freeze([...new Set(blockers)]);
}

function deriveStatus(
  blockers: readonly AuthorizationBlockerCode[],
  approvalsSatisfied: boolean,
  preflightPassed: boolean,
  nowUtc: string,
  window: ProductionEconomicAuthorizationPackage['approvalWindow'],
  supersededBy: string | null,
): ProductionEconomicAuthorizationState {
  if (supersededBy) {
    return 'SUPERSEDED';
  }
  if (nowUtc > window.validUntilUtc) {
    return 'EXPIRED';
  }
  if (
    blockers.includes('REHEARSAL_PARAMETERS_CANNOT_BE_PROMOTED') ||
    blockers.includes('AI_CANNOT_APPROVE') ||
    blockers.includes('AGENT_CANNOT_APPROVE') ||
    blockers.includes('AUTOMATION_CANNOT_APPROVE') ||
    blockers.includes('HIDDEN_PREMINT_FORBIDDEN') ||
    blockers.includes('PEVE_CANNOT_VALUE_SUNREY') ||
    blockers.includes('REFERENCE_PRICE_CANNOT_MINT_MOONREY') ||
    blockers.includes('FIREWALL_OVERRIDE_FORBIDDEN')
  ) {
    return 'REJECTED';
  }
  if (blockers.includes('PARAMETERS_INCOMPLETE') || blockers.includes('PRODUCTION_PARAMETERS_UNCONFIGURED')) {
    return 'PARAMETERS_INCOMPLETE';
  }
  if (blockers.includes('PREFLIGHT_FAILED')) {
    return 'PREFLIGHT_FAILED';
  }
  if (blockers.includes('EXTERNAL_EVIDENCE_MISSING') || blockers.includes('EXTERNAL_EVIDENCE_EXPIRED') || blockers.includes('EXTERNAL_EVIDENCE_REVOKED')) {
    return 'EXTERNAL_EVIDENCE_REQUIRED';
  }
  if (blockers.includes('PREFLIGHT_REQUIRED') || !preflightPassed) {
    return 'PREFLIGHT_REQUIRED';
  }
  if (!approvalsSatisfied || blockers.includes('AWAITING_HUMAN_APPROVALS')) {
    return 'AWAITING_HUMAN_APPROVALS';
  }
  if (approvalsSatisfied && preflightPassed && blockers.length === 0) {
    return 'AUTHORIZED_CANDIDATE';
  }
  if (approvalsSatisfied) {
    return 'APPROVALS_SATISFIED';
  }
  return 'DRAFT';
}
