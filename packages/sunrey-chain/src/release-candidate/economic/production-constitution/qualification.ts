/**
 * Qualify a production economic constitution candidate.
 *
 * Production activation remains a separate human decision. Parameter
 * selection is not final activation authorization. AI / S3M / Grok
 * cannot approve, fabricate evidence, or invoke monetary authority.
 */

import {
  evaluateProductionEconomicActivation,
  type ProductionEconomicActivationDecision,
} from '../../../economics/production-activation/index.ts';

import { assembleCandidateBundle, type BundleHashInput } from './bundle.ts';
import { currentExternalEvidenceInventory, legacyPathInventory } from './limitations.ts';
import { compatibilityFrom, reconcileConstitution } from './reconcile.ts';
import {
  additionalUnconfiguredPolicyDecisions,
  humanActivationAuthorizationRequired,
  humanParameterSelectionDecisions,
  parameterCoverage,
  visibleUnconfiguredParameters,
} from './requirements.ts';
import type {
  ProductionEconomicConstitutionBundleState,
  ProductionEconomicConstitutionQualification,
  ProductionEconomicConstitutionQualificationDecision,
  ProductionEconomicConstitutionSnapshot,
} from './types.ts';

const NON_HUMAN = new Set(['AI', 'S3M', 'GROK', 'AGENT', 'AUTOMATION', 'SERVICE']);

export function qualifyProductionEconomicConstitutionCandidate(input: {
  readonly snapshot: ProductionEconomicConstitutionSnapshot;
  readonly hashes: BundleHashInput;
  readonly firewall?: ProductionEconomicActivationDecision;
}): ProductionEconomicConstitutionQualificationDecision {
  const bundle = assembleCandidateBundle(input.hashes);
  const firewall = input.firewall ?? null;
  const firewallHash = firewall?.decisionId ?? bundle.firewallDecisionHash;
  const coverage = parameterCoverage(input.snapshot.parameters);
  const missingParameters = visibleUnconfiguredParameters(coverage);
  const reconciliation = reconcileConstitution(input.snapshot);
  const compatibility = compatibilityFrom(input.snapshot, reconciliation.implicitVersionRejected);
  const uniqueSelection = uniqueDecisions([
    ...humanParameterSelectionDecisions(coverage),
    ...(missingParameters.length > 0 ? additionalUnconfiguredPolicyDecisions() : []),
  ]);
  const authorization = humanActivationAuthorizationRequired();
  const external = currentExternalEvidenceInventory();
  const blockers: string[] = [...reconciliation.failures];

  if (input.snapshot.bindings.length === 0) {
    blockers.push('bundle-incomplete');
  }
  if (reconciliation.implicitVersionRejected) {
    blockers.push('implicit-version-rejected');
  }
  if (input.snapshot.sunrey.legacyFixturePath) {
    blockers.push('legacy-sunrey-fixture-cannot-qualify');
  }
  if (input.snapshot.moonrey.legacyV1Path) {
    blockers.push('moonrey-v1-cannot-qualify');
  }
  if (coverage.some((row) => row.status === 'FIXTURE_ONLY')) {
    blockers.push('rehearsal-values-cannot-qualify');
  }
  if (firewall && firewall.decisionId !== bundle.firewallDecisionHash) {
    blockers.push('bundle-cannot-override-firewall');
  }
  if (firewall && firewall.overallState === 'ECONOMIC_ACTIVATION_BLOCKED') {
    blockers.push(`firewall:${firewall.overallState}`);
  }
  if (NON_HUMAN.has(input.snapshot.actorKind)) {
    blockers.push(`ai-cannot-approve:${input.snapshot.actorKind}`);
  }
  if (input.snapshot.finalActivationAuthorization && NON_HUMAN.has(input.snapshot.actorKind)) {
    blockers.push('ai-cannot-create-human-authorization');
  }
  if (input.snapshot.frozen && input.snapshot.finalActivationAuthorization) {
    blockers.push('ai-cannot-freeze-and-activate');
  }

  const bundleState = deriveBundleState({
    incomplete: input.snapshot.bindings.length === 0 || reconciliation.implicitVersionRejected,
    reconciliationFailed: !reconciliation.ok,
    parametersSelected: missingParameters.length === 0 && !coverage.some((row) => row.status === 'FIXTURE_ONLY'),
    externalReady: external.every((row) => row.present),
    governanceReady: input.snapshot.humanGovernanceComplete,
    activationAuthorized: input.snapshot.finalActivationAuthorization && input.snapshot.actorKind === 'HUMAN',
    firewallBlocked: firewall?.overallState === 'ECONOMIC_ACTIVATION_BLOCKED',
  });
  const result = qualificationFrom(bundleState);

  if (missingParameters.length > 0) {
    blockers.push('awaiting-parameter-selection');
  }
  if (external.some((row) => !row.present)) {
    blockers.push('awaiting-external-evidence');
  }
  if (!input.snapshot.humanGovernanceComplete) {
    blockers.push('awaiting-human-governance');
  }
  if (!input.snapshot.finalActivationAuthorization) {
    blockers.push('awaiting-human-activation-authorization');
  }

  return Object.freeze({
    result,
    bundleState,
    bundleHash: bundle.bundleHash,
    economicConstitutionHash: bundle.economicConstitutionHash,
    firewallDecisionHash: firewallHash,
    parameterCoverage: coverage,
    missingParameters,
    humanDecisionsRequired: uniqueSelection,
    humanAuthorizationRequired: authorization,
    externalEvidence: external,
    legacyPaths: legacyPathInventory(),
    compatibility,
    reconciliation,
    openBlockers: Object.freeze([...new Set(blockers)]),
    productionActivated: false,
    parameterSelectionIsFinalAuthorization: false,
    aiCanAuthorize: false,
  });
}

function uniqueDecisions(
  rows: readonly { readonly decisionId: string }[],
): ProductionEconomicConstitutionQualificationDecision['humanDecisionsRequired'] {
  const seen = new Set<string>();
  const out: ProductionEconomicConstitutionQualificationDecision['humanDecisionsRequired'][number][] = [];
  for (const row of rows as ProductionEconomicConstitutionQualificationDecision['humanDecisionsRequired']) {
    if (seen.has(row.decisionId)) {
      continue;
    }
    seen.add(row.decisionId);
    out.push(row);
  }
  return Object.freeze(out);
}

function deriveBundleState(input: {
  readonly incomplete: boolean;
  readonly reconciliationFailed: boolean;
  readonly parametersSelected: boolean;
  readonly externalReady: boolean;
  readonly governanceReady: boolean;
  readonly activationAuthorized: boolean;
  readonly firewallBlocked: boolean;
}): ProductionEconomicConstitutionBundleState {
  if (input.incomplete) {
    return 'BUNDLE_INCOMPLETE';
  }
  if (input.reconciliationFailed) {
    return 'ENGINEERING_RECONCILIATION_FAILED';
  }
  if (!input.parametersSelected) {
    return 'AWAITING_PARAMETER_SELECTION';
  }
  if (!input.externalReady) {
    return 'AWAITING_EXTERNAL_EVIDENCE';
  }
  if (!input.governanceReady) {
    return 'AWAITING_HUMAN_GOVERNANCE';
  }
  if (!input.activationAuthorized || input.firewallBlocked) {
    return 'AWAITING_HUMAN_ACTIVATION_AUTHORIZATION';
  }
  return 'PRODUCTION_CANDIDATE_PACKAGE_READY';
}

function qualificationFrom(
  state: ProductionEconomicConstitutionBundleState,
): ProductionEconomicConstitutionQualification {
  switch (state) {
    case 'BUNDLE_INCOMPLETE':
    case 'ENGINEERING_RECONCILIATION_FAILED':
      return 'INCOMPLETE';
    case 'ENGINEERING_RECONCILED':
      return 'ENGINEERING_RECONCILED';
    case 'AWAITING_PARAMETER_SELECTION':
      return 'AWAITING_PARAMETER_SELECTION';
    case 'AWAITING_EXTERNAL_EVIDENCE':
      return 'AWAITING_EXTERNAL_EVIDENCE';
    case 'AWAITING_HUMAN_GOVERNANCE':
      return 'AWAITING_HUMAN_GOVERNANCE';
    case 'AWAITING_HUMAN_ACTIVATION_AUTHORIZATION':
      return 'AWAITING_HUMAN_ACTIVATION_AUTHORIZATION';
    case 'PRODUCTION_CANDIDATE_PACKAGE_READY':
      return 'PRODUCTION_CANDIDATE_PACKAGE_READY';
  }
}

export function refuseNonHumanApproval(actorKind: ProductionEconomicConstitutionSnapshot['actorKind']): {
  readonly ok: false;
  readonly code: 'AI_CANNOT_APPROVE' | 'S3M_CANNOT_APPROVE' | 'GROK_CANNOT_APPROVE' | 'NON_HUMAN_CANNOT_APPROVE';
} {
  if (actorKind === 'S3M') {
    return Object.freeze({ ok: false, code: 'S3M_CANNOT_APPROVE' });
  }
  if (actorKind === 'GROK') {
    return Object.freeze({ ok: false, code: 'GROK_CANNOT_APPROVE' });
  }
  if (actorKind === 'AI') {
    return Object.freeze({ ok: false, code: 'AI_CANNOT_APPROVE' });
  }
  return Object.freeze({ ok: false, code: 'NON_HUMAN_CANNOT_APPROVE' });
}

export function refuseAiMarkExternalEvidencePresent(): { readonly ok: false; readonly code: 'AI_CANNOT_MARK_EXTERNAL_EVIDENCE' } {
  return Object.freeze({ ok: false, code: 'AI_CANNOT_MARK_EXTERNAL_EVIDENCE' });
}

export function refuseAiHumanAuthorization(): { readonly ok: false; readonly code: 'AI_CANNOT_CREATE_HUMAN_AUTHORIZATION' } {
  return Object.freeze({ ok: false, code: 'AI_CANNOT_CREATE_HUMAN_AUTHORIZATION' });
}

export function refuseFreezeAndActivate(): { readonly ok: false; readonly code: 'FREEZE_IS_NOT_ACTIVATION' } {
  return Object.freeze({ ok: false, code: 'FREEZE_IS_NOT_ACTIVATION' });
}

export function refuseMonetaryAuthorityInvocation(): {
  readonly ok: false;
  readonly code: 'AI_CANNOT_INVOKE_MONETARY_AUTHORITY';
} {
  return Object.freeze({ ok: false, code: 'AI_CANNOT_INVOKE_MONETARY_AUTHORITY' });
}

export function runFirewallOnCandidate(
  snapshot: Parameters<typeof evaluateProductionEconomicActivation>[0],
): ProductionEconomicActivationDecision {
  return evaluateProductionEconomicActivation(snapshot);
}
