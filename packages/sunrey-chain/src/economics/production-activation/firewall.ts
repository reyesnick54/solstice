/**
 * Production Economic Activation Firewall.
 *
 * Answers whether the economic system is ready to be presented to
 * authorized humans for a future production activation decision.
 * It does not activate production. There is no activateProduction().
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';

import { activationManifestHash, manifestFromBindings, policyBindingStatus } from './bindings.ts';
import {
  actorLooksNonHuman,
  humanSlotSatisfied,
  isFixtureEvidence,
  partitionEvidence,
} from './evidence.ts';
import { liveFlagsRemainDisabled } from './invariants.ts';
import {
  overallParameterStatus,
  parameterConfigured,
  parameterManifestHash,
} from './parameters.ts';
import { ACTIVATION_REQUIREMENTS, DOMAIN_TO_MAINNET } from './requirements.ts';
import {
  REJECTED_PARAMETER_SOURCES,
  type ActivationEvidenceRecord,
  type DomainActivationDecision,
  type EconomicActivationBlockerCode,
  type EconomicActivationDomain,
  type EconomicActivationState,
  type ProductionEconomicActivationDecision,
  type ProductionEconomicActivationSnapshot,
  type RequirementEvaluation,
} from './types.ts';

export const ProductionEconomicActivationFirewall = Object.freeze({
  evaluate(snapshot: ProductionEconomicActivationSnapshot): ProductionEconomicActivationDecision {
    return evaluateProductionEconomicActivation(snapshot);
  },
});

export function evaluateProductionEconomicActivation(
  snapshot: ProductionEconomicActivationSnapshot,
): ProductionEconomicActivationDecision {
  const evaluations = ACTIVATION_REQUIREMENTS.map((requirement) => evaluateOne(requirement.requirementId, snapshot));
  const fixtureBlock = snapshot.evidence.some(isFixtureEvidence);
  const extra = extraBlockers(snapshot, fixtureBlock);
  const requirements = mergeExtra(evaluations, extra);
  const satisfiedRequirements = requirements.filter((row) => row.satisfied).map((row) => row.requirementId);
  const missingRequirements = requirements.filter((row) => !row.satisfied).map((row) => row.requirementId);
  const blockingRequirements = requirements.filter((row) => row.blocking).map((row) => row.requirementId);
  const domainDecisions = (['SUNREY_COIN_ISSUANCE', 'MOONREY_COIN_ISSUANCE', 'HUMAN_INFORMATION_MARKET', 'PRODUCTIVE_ECONOMIC_DATA', 'SUNREY_EXCHANGE_SETTLEMENT'] as const).map(
    (domain) => domainDecision(domain, requirements, snapshot),
  );
  const overallState = combineStates(domainDecisions.map((row) => row.state));
  const partitioned = partitionEvidence(snapshot.evidence);
  const manifest = manifestFromBindings(snapshot.bindings);
  const manifestHash = activationManifestHash(manifest);
  const parameterHash = parameterManifestHash(snapshot.parameters);
  const decisionId = sha256Hex(
    Buffer.concat([
      encodeString('SUNREY_PRODUCTION_ECONOMIC_ACTIVATION_DECISION_V1'),
      encodeString(manifestHash),
      encodeString(parameterHash),
      encodeString(overallState),
    ]),
  );
  return Object.freeze({
    decisionId,
    manifestHash,
    parameterManifestHash: parameterHash,
    overallState,
    domainDecisions: Object.freeze(domainDecisions),
    requirements: Object.freeze(requirements),
    satisfiedRequirements: Object.freeze(satisfiedRequirements),
    missingRequirements: Object.freeze(missingRequirements),
    blockingRequirements: Object.freeze(blockingRequirements),
    engineeringEvidence: Object.freeze(partitioned.engineering),
    externalEvidence: Object.freeze(partitioned.external),
    humanEvidence: Object.freeze(partitioned.human),
    parameterStatus: overallParameterStatus(snapshot.parameters),
    policyBindingStatus: policyBindingStatus(snapshot.bindings, snapshot.policyBindings),
    supplyStatus: supplyStatusOf(snapshot),
    mainnetReadinessReference: bindingRef(snapshot, 'sourceCommit'),
    economicRcReference: bindingRef(snapshot, 'economicRc'),
    mainnetRcReference: bindingRef(snapshot, 'mainnetRc'),
    pregenesisReference: bindingRef(snapshot, 'pregenesisQualification'),
    handoffReference: bindingRef(snapshot, 'productionHandoff'),
    productionActivated: false,
    liveFlagsChanged: false,
    monetaryAuthorityInvoked: false,
  });
}

function bindingRef(
  snapshot: ProductionEconomicActivationSnapshot,
  key: 'sourceCommit' | 'economicRc' | 'mainnetRc' | 'pregenesisQualification' | 'productionHandoff',
): string {
  return snapshot.bindings.find((row) => row.key === key)?.versionId ?? 'UNBOUND';
}

function supplyStatusOf(snapshot: ProductionEconomicActivationSnapshot): 'RECONCILED' | 'FAILED' | 'NOT_CANONICAL' {
  if (!snapshot.supply.canonicalSupplyBook) {
    return 'NOT_CANONICAL';
  }
  if (
    !snapshot.supply.sunreyReconciles ||
    !snapshot.supply.moonreyReconciles ||
    snapshot.supply.hiddenPremint ||
    snapshot.supply.faucetMigration ||
    snapshot.supply.rehearsalBalanceMigration ||
    snapshot.supply.automaticApplicationLedgerMigration
  ) {
    return 'FAILED';
  }
  return 'RECONCILED';
}

function evidenceFor(snapshot: ProductionEconomicActivationSnapshot, requirementId: string): ActivationEvidenceRecord | undefined {
  return snapshot.evidence.find((row) => row.requirementId === requirementId);
}

function evaluateOne(
  requirementId: string,
  snapshot: ProductionEconomicActivationSnapshot,
): RequirementEvaluation {
  const requirement = ACTIVATION_REQUIREMENTS.find((row) => row.requirementId === requirementId)!;
  const evidence = evidenceFor(snapshot, requirementId);
  if (evidence && isFixtureEvidence(evidence)) {
    return result(requirement, false, true, 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY', 'fixture evidence is not production authority');
  }
  if (evidence && requirement.evidenceClass === 'HUMAN') {
    if (evidence.actorKind && actorLooksNonHuman(evidence.actorId ?? evidence.reference ?? '', evidence.actorKind)) {
      return result(requirement, false, true, 'AI_CANNOT_AUTHORIZE_PRODUCTION', 'non-human actor cannot satisfy a human slot');
    }
    if (evidence.actorKind && evidence.actorKind !== 'HUMAN') {
      return result(requirement, false, true, 'AI_CANNOT_AUTHORIZE_PRODUCTION', 'non-human actor cannot satisfy a human slot');
    }
    if (evidence.evidenceClass !== 'HUMAN') {
      return result(requirement, false, true, requirement.blockerCode, 'evidence class cannot satisfy HUMAN');
    }
  }
  if (evidence && requirement.evidenceClass === 'EXTERNAL' && evidence.evidenceClass !== 'EXTERNAL') {
    return result(requirement, false, true, requirement.blockerCode, 'engineering evidence cannot satisfy EXTERNAL');
  }

  switch (requirementId) {
    case 'SHARED.LIVE_FLAGS_DISABLED':
      return liveFlagsRemainDisabled(snapshot.liveFlags)
        ? result(requirement, true, false, null, 'LIVE_* remain disabled')
        : result(requirement, false, true, 'LIVE_FLAGS_MUST_REMAIN_DISABLED', 'LIVE_* must remain disabled');
    case 'SHARED.PRODUCTION_PARAMETERS':
      return overallParameterStatus(snapshot.parameters) === 'CONFIGURED'
        ? result(requirement, true, false, null, 'parameters configured')
        : result(requirement, false, true, 'PRODUCTION_PARAMETER_UNCONFIGURED', 'production parameters UNCONFIGURED');
    case 'SHARED.SUNREY_MAXIMUM_SUPPLY':
      return parameterConfigured(snapshot.parameters, 'SUNREY_MAXIMUM_SUPPLY')
        ? result(requirement, true, false, null, 'SunRey maximum supply configured')
        : result(requirement, false, true, 'MAXIMUM_SUPPLY_UNCONFIGURED', 'SunRey maximum supply UNCONFIGURED');
    case 'SHARED.MOONREY_MAXIMUM_SUPPLY':
      return parameterConfigured(snapshot.parameters, 'MOONREY_MAXIMUM_SUPPLY')
        ? result(requirement, true, false, null, 'MoonRey maximum supply configured')
        : result(requirement, false, true, 'MAXIMUM_SUPPLY_UNCONFIGURED', 'MoonRey maximum supply UNCONFIGURED');
    case 'SHARED.SUNREY_GENESIS_SUPPLY':
      return parameterConfigured(snapshot.parameters, 'SUNREY_GENESIS_SUPPLY')
        ? result(requirement, true, false, null, 'SunRey genesis supply configured')
        : result(requirement, false, true, 'GENESIS_SUPPLY_UNCONFIGURED', 'SunRey genesis supply UNCONFIGURED');
    case 'SHARED.MOONREY_GENESIS_SUPPLY':
      return parameterConfigured(snapshot.parameters, 'MOONREY_GENESIS_SUPPLY')
        ? result(requirement, true, false, null, 'MoonRey genesis supply configured')
        : result(requirement, false, true, 'GENESIS_SUPPLY_UNCONFIGURED', 'MoonRey genesis supply UNCONFIGURED');
    case 'SHARED.ISSUANCE_POLICY':
      return parameterConfigured(snapshot.parameters, 'SUNREY_POST_GENESIS_ISSUANCE_POLICY') &&
        parameterConfigured(snapshot.parameters, 'MOONREY_POST_GENESIS_ISSUANCE_POLICY')
        ? result(requirement, true, false, null, 'issuance policies configured')
        : result(requirement, false, true, 'ISSUANCE_POLICY_UNCONFIGURED', 'issuance policy UNCONFIGURED');
    case 'SHARED.POLICY_BINDINGS':
      return policyBindingStatus(snapshot.bindings, snapshot.policyBindings) === 'MISMATCH'
        ? result(requirement, false, true, 'POLICY_BINDING_MISMATCH', 'incompatible policy versions')
        : policyBindingStatus(snapshot.bindings, snapshot.policyBindings) === 'BOUND'
          ? result(requirement, true, false, null, 'bindings consistent')
          : result(requirement, false, true, 'POLICY_BINDING_MISMATCH', 'bindings unbound or latest rejected');
    case 'SHARED.SUPPLY_RECONCILIATION':
      return supplyStatusOf(snapshot) === 'RECONCILED'
        ? result(requirement, true, false, null, 'supply reconciles')
        : result(requirement, false, true, 'SUPPLY_RECONCILIATION_FAILED', 'supply reconciliation failed');
    case 'SHARED.GENESIS_ALLOCATION':
      return snapshot.supply.genesisAllocationAuthorized
        ? result(requirement, true, false, null, 'genesis allocation authorized')
        : result(requirement, false, true, 'GENESIS_ALLOCATION_NOT_AUTHORIZED', 'genesis allocation not authorized');
    case 'SHARED.EXTERNAL_SECURITY':
      return snapshot.externalSecurity.assessmentProvided &&
        snapshot.externalSecurity.openCriticalFindings === 0 &&
        snapshot.externalSecurity.openHighFindings === 0 &&
        snapshot.externalSecurity.retestEvidence &&
        evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'external security review present')
        : result(requirement, false, true, 'EXTERNAL_SECURITY_REVIEW_MISSING', 'external security review missing');
    case 'SHARED.LEGAL_EVIDENCE':
      return snapshot.legalRegulatory.counselOpinion && evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'counsel opinion recorded')
        : result(requirement, false, true, 'LEGAL_EVIDENCE_MISSING', 'legal evidence missing');
    case 'SHARED.REGULATORY_EVIDENCE':
      return snapshot.legalRegulatory.regulatoryApproval && evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'regulatory evidence recorded')
        : result(requirement, false, true, 'REGULATORY_EVIDENCE_MISSING', 'regulatory evidence missing');
    case 'SHARED.PARTNER_EVIDENCE':
      return snapshot.legalRegulatory.partnerAgreement && evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'partner evidence recorded')
        : result(requirement, false, true, 'PARTNER_EVIDENCE_MISSING', 'partner evidence missing');
    case 'SHARED.HUMAN_AUTHORIZATION':
      return evaluateHumanAuthorization(requirement, snapshot);
    case 'SUNREY.CONVERSION_POLICY':
      return parameterConfigured(snapshot.parameters, 'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION')
        ? result(requirement, true, false, null, 'SunRey conversion production-class')
        : result(requirement, false, true, 'CONVERSION_POLICY_NOT_PRODUCTION', 'SunRey conversion is not production');
    case 'MOONREY.CONVERSION_POLICY':
      return parameterConfigured(snapshot.parameters, 'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION')
        ? result(requirement, true, false, null, 'MoonRey conversion production-class')
        : result(requirement, false, true, 'CONVERSION_POLICY_NOT_PRODUCTION', 'MoonRey conversion is not production');
    case 'MOONREY.VALUE_POLICY':
      if (snapshot.moonreyLegacyV1Only && !snapshot.moonreyV2EngineeringReady) {
        return result(requirement, false, true, 'VALUE_POLICY_NOT_PRODUCTION', 'legacy V1 MoonRey cannot qualify production');
      }
      if ((REJECTED_PARAMETER_SOURCES as readonly string[]).includes(snapshot.moonreyValuePolicyClass)) {
        return result(requirement, false, true, 'VALUE_POLICY_NOT_PRODUCTION', 'engineering Productive Value is not production');
      }
      return parameterConfigured(snapshot.parameters, 'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION') &&
        snapshot.moonreyV2EngineeringReady &&
        !snapshot.moonreyLegacyV1Only
        ? result(requirement, true, false, null, 'MoonRey V2 production-class value policy')
        : result(requirement, false, true, 'VALUE_POLICY_NOT_PRODUCTION', 'engineering Productive Value is not production');
    case 'ORACLE.PROVIDER_EVIDENCE':
      return snapshot.oracleEvidence.realProviderOnboarding &&
        !snapshot.oracleEvidence.sandboxProvider &&
        evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'real provider onboarding recorded')
        : result(requirement, false, true, 'ORACLE_PROVIDER_EVIDENCE_MISSING', 'oracle provider evidence missing');
    case 'ORACLE.LICENSE_EVIDENCE':
      return snapshot.oracleEvidence.dataLicense && snapshot.oracleEvidence.usageRight && evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'oracle license evidence recorded')
        : result(requirement, false, true, 'ORACLE_LICENSE_EVIDENCE_MISSING', 'oracle license evidence missing');
    case 'ORACLE.SOURCE_DIVERSITY':
      return snapshot.oracleEvidence.sourceDiversity
        ? result(requirement, true, false, null, 'source diversity sufficient')
        : result(requirement, false, true, 'SOURCE_DIVERSITY_INSUFFICIENT', 'source diversity insufficient');
    case 'ORACLE.COVERAGE':
      return coverageReady(snapshot)
        ? result(requirement, true, false, null, 'fabric coverage ready')
        : result(requirement, false, true, 'ECONOMIC_DATA_COVERAGE_GAP', 'economic data coverage gap');
    case 'HIN.PRIVACY_REVIEW':
      return snapshot.hinGates.privacyReview && evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'HIN privacy review recorded')
        : result(requirement, false, true, 'HIN_PRIVACY_REVIEW_MISSING', 'HIN privacy review missing');
    case 'HIN.LEGAL_REVIEW':
      return snapshot.hinGates.legalAnalysis && evidenceClassOk(evidence, 'EXTERNAL')
        ? result(requirement, true, false, null, 'HIN legal review recorded')
        : result(requirement, false, true, 'HIN_LEGAL_REVIEW_MISSING', 'HIN legal review missing');
    case 'HIN.HUMAN_AUTHORIZATION':
      return snapshot.hinGates.humanAuthorization && humanAuthorizationReady(snapshot)
        ? result(requirement, true, false, null, 'HIN human authorization recorded')
        : result(requirement, false, true, 'HIN_HUMAN_AUTHORIZATION_MISSING', 'HIN human authorization missing');
    case 'HIN.CHAIN_ANCHOR':
      return hinAnchorReady(snapshot.hinChainAnchor)
        ? result(requirement, true, false, null, 'HIN chain-anchor engineering ready')
        : result(requirement, false, true, 'HIN_CHAIN_ANCHOR_NOT_READY', 'HIN chain-anchor not ready');
    default:
      return result(requirement, false, true, requirement.blockerCode, 'unknown requirement');
  }
}

function evaluateHumanAuthorization(
  requirement: (typeof ACTIVATION_REQUIREMENTS)[number],
  snapshot: ProductionEconomicActivationSnapshot,
): RequirementEvaluation {
  if (snapshot.humanAuthorizations.length === 0) {
    return result(requirement, false, true, 'HUMAN_AUTHORIZATION_MISSING', 'human authorization missing');
  }
  let aiAttempt = false;
  let fixtureAttempt = false;
  const acceptedRoles = new Set<string>();
  for (const slot of snapshot.humanAuthorizations) {
    const judged = humanSlotSatisfied(slot);
    if (judged.fixtureAttempt) {
      fixtureAttempt = true;
      continue;
    }
    if (judged.aiAttempt) {
      aiAttempt = true;
      continue;
    }
    if (judged.ok) {
      acceptedRoles.add(slot.role);
    }
  }
  if (fixtureAttempt && acceptedRoles.size === 0) {
    return result(requirement, false, true, 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY', 'fixture human signature is not authority');
  }
  if (aiAttempt && acceptedRoles.size === 0) {
    return result(requirement, false, true, 'AI_CANNOT_AUTHORIZE_PRODUCTION', 'AI cannot authorize production');
  }
  const required = ['PROTOCOL_AUTHORITY', 'SECURITY_AUTHORITY', 'RELEASE_AUTHORITY', 'LEGAL_AUTHORITY'];
  if (required.every((role) => acceptedRoles.has(role))) {
    return result(requirement, true, false, null, 'required human roles present');
  }
  return result(requirement, false, true, 'HUMAN_AUTHORIZATION_MISSING', 'required human roles missing');
}

function humanAuthorizationReady(snapshot: ProductionEconomicActivationSnapshot): boolean {
  return evaluateHumanAuthorization(ACTIVATION_REQUIREMENTS.find((row) => row.requirementId === 'SHARED.HUMAN_AUTHORIZATION')!, snapshot)
    .satisfied;
}

function coverageReady(snapshot: ProductionEconomicActivationSnapshot): boolean {
  const intended = snapshot.intendedProductionCategories;
  const gaps = new Set([
    ...snapshot.coverageGaps.unitExtensionRequired,
    ...snapshot.coverageGaps.semanticReviewRequired,
    ...snapshot.coverageGaps.missingProviderCoverage,
  ]);
  if (intended.length === 0) {
    return gaps.size === 0;
  }
  return intended.every((category) => !gaps.has(category));
}

function hinAnchorReady(anchor: ProductionEconomicActivationSnapshot['hinChainAnchor']): boolean {
  return (
    anchor.consentAnchorPath &&
    anchor.usageAnchorPath &&
    anchor.revocationAnchorPath &&
    anchor.finality &&
    anchor.reconciliation &&
    anchor.reorgHandling &&
    anchor.privacyClassification
  );
}

function evidenceClassOk(
  evidence: ActivationEvidenceRecord | undefined,
  required: 'EXTERNAL' | 'HUMAN' | 'ENGINEERING',
): boolean {
  if (!evidence) {
    return required === 'ENGINEERING';
  }
  if (required === 'EXTERNAL') {
    return evidence.evidenceClass === 'EXTERNAL';
  }
  if (required === 'HUMAN') {
    return evidence.evidenceClass === 'HUMAN';
  }
  return true;
}

function extraBlockers(
  snapshot: ProductionEconomicActivationSnapshot,
  fixtureBlock: boolean,
): readonly RequirementEvaluation[] {
  const extra: RequirementEvaluation[] = [];
  if (fixtureBlock) {
    extra.push(
      Object.freeze({
        requirementId: 'SHARED.FIXTURE_FIREWALL',
        domain: 'SHARED',
        evidenceClass: 'HUMAN',
        satisfied: false,
        blocking: true,
        blockerCode: 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY',
        notes: 'fixture evidence is not production authority',
      }),
    );
  }
  if (snapshot.oracleEvidence.sandboxProvider) {
    extra.push(
      Object.freeze({
        requirementId: 'ORACLE.SANDBOX_PROVIDER',
        domain: 'PRODUCTIVE_ECONOMIC_DATA',
        evidenceClass: 'EXTERNAL',
        satisfied: false,
        blocking: true,
        blockerCode: 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY',
        notes: 'sandbox oracle provider is not production authority',
      }),
    );
  }
  return extra;
}

function mergeExtra(
  evaluations: readonly RequirementEvaluation[],
  extra: readonly RequirementEvaluation[],
): RequirementEvaluation[] {
  return [...evaluations, ...extra];
}

function domainDecision(
  domain: EconomicActivationDomain,
  requirements: readonly RequirementEvaluation[],
  snapshot: ProductionEconomicActivationSnapshot,
): DomainActivationDecision {
  const relevant = requirements.filter((row) => row.domain === domain || row.domain === 'SHARED');
  const blockers = unique(relevant.filter((row) => row.blocking && row.blockerCode).map((row) => row.blockerCode!));
  const engineeringReady = engineeringReadyFor(domain, snapshot, relevant);
  const externalEvidenceReady = relevant
    .filter((row) => row.evidenceClass === 'EXTERNAL')
    .every((row) => row.satisfied);
  const humanAuthorizationReady = relevant
    .filter((row) => row.evidenceClass === 'HUMAN')
    .every((row) => row.satisfied);
  const parametersConfigured = overallParameterStatus(snapshot.parameters) === 'CONFIGURED';
  const state = deriveState({
    blockers,
    engineeringReady,
    externalEvidenceReady,
    humanAuthorizationReady,
    parametersConfigured,
  });
  return Object.freeze({
    domain,
    mainnetDomain: DOMAIN_TO_MAINNET[domain],
    state,
    engineeringReady,
    externalEvidenceReady,
    humanAuthorizationReady,
    parametersConfigured,
    runtimeEnabled: false,
    blockers,
  });
}

function engineeringReadyFor(
  domain: EconomicActivationDomain,
  snapshot: ProductionEconomicActivationSnapshot,
  relevant: readonly RequirementEvaluation[],
): boolean {
  const engineeringSatisfied = relevant.filter((row) => row.evidenceClass === 'ENGINEERING').every((row) => row.satisfied);
  if (!engineeringSatisfied) {
    return false;
  }
  if (domain === 'SUNREY_COIN_ISSUANCE') {
    return snapshot.sunreyEngineeringReady;
  }
  if (domain === 'MOONREY_COIN_ISSUANCE') {
    return snapshot.moonreyV2EngineeringReady && !snapshot.moonreyLegacyV1Only;
  }
  if (domain === 'SUNREY_EXCHANGE_SETTLEMENT') {
    return snapshot.exchangeEngineeringReady;
  }
  return true;
}

function deriveState(input: {
  readonly blockers: readonly EconomicActivationBlockerCode[];
  readonly engineeringReady: boolean;
  readonly externalEvidenceReady: boolean;
  readonly humanAuthorizationReady: boolean;
  readonly parametersConfigured: boolean;
}): EconomicActivationState {
  const hard = input.blockers.filter((code) =>
    [
      'PRODUCTION_PARAMETER_UNCONFIGURED',
      'MAXIMUM_SUPPLY_UNCONFIGURED',
      'GENESIS_SUPPLY_UNCONFIGURED',
      'ISSUANCE_POLICY_UNCONFIGURED',
      'CONVERSION_POLICY_NOT_PRODUCTION',
      'VALUE_POLICY_NOT_PRODUCTION',
      'ECONOMIC_DATA_COVERAGE_GAP',
      'POLICY_BINDING_MISMATCH',
      'SUPPLY_RECONCILIATION_FAILED',
      'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY',
      'LIVE_FLAGS_MUST_REMAIN_DISABLED',
      'AI_CANNOT_AUTHORIZE_PRODUCTION',
    ].includes(code),
  );
  if (hard.length > 0 || !input.parametersConfigured) {
    return 'ECONOMIC_ACTIVATION_BLOCKED';
  }
  if (!input.engineeringReady) {
    return 'ECONOMIC_ACTIVATION_BLOCKED';
  }
  if (!input.externalEvidenceReady) {
    return 'AWAITING_EXTERNAL_EVIDENCE';
  }
  if (!input.humanAuthorizationReady) {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  if (input.blockers.length > 0) {
    return 'ECONOMIC_ACTIVATION_BLOCKED';
  }
  return 'PRODUCTION_CANDIDATE_READY';
}

function combineStates(states: readonly EconomicActivationState[]): EconomicActivationState {
  if (states.every((state) => state === 'PRODUCTION_CANDIDATE_READY')) {
    return 'PRODUCTION_CANDIDATE_READY';
  }
  if (states.some((state) => state === 'ECONOMIC_ACTIVATION_BLOCKED')) {
    return 'ECONOMIC_ACTIVATION_BLOCKED';
  }
  if (states.some((state) => state === 'AWAITING_EXTERNAL_EVIDENCE')) {
    return 'AWAITING_EXTERNAL_EVIDENCE';
  }
  if (states.some((state) => state === 'AWAITING_HUMAN_AUTHORIZATION')) {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  return 'ENGINEERING_READY';
}

function unique(codes: readonly EconomicActivationBlockerCode[]): readonly EconomicActivationBlockerCode[] {
  return Object.freeze([...new Set(codes)]);
}

function result(
  requirement: (typeof ACTIVATION_REQUIREMENTS)[number],
  satisfied: boolean,
  blocking: boolean,
  blockerCode: EconomicActivationBlockerCode | null,
  notes: string,
): RequirementEvaluation {
  return Object.freeze({
    requirementId: requirement.requirementId,
    domain: requirement.domain,
    evidenceClass: requirement.evidenceClass,
    satisfied,
    blocking,
    blockerCode,
    notes,
  });
}

export function summarizeMissingEvidence(decision: ProductionEconomicActivationDecision): readonly string[] {
  return Object.freeze(
    decision.requirements.filter((row) => !row.satisfied).map((row) => `${row.requirementId}:${row.blockerCode ?? 'MISSING'}`),
  );
}

export function domainState(
  decision: ProductionEconomicActivationDecision,
  domain: EconomicActivationDomain,
): EconomicActivationState {
  return decision.domainDecisions.find((row) => row.domain === domain)?.state ?? 'ECONOMIC_ACTIVATION_BLOCKED';
}
