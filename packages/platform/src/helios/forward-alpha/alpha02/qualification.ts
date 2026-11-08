/**
 * HELIOS Forward Alpha ALPHA02 — engineering qualification gate.
 */

import { campaignFingerprintMatchesRegistration } from './immutability.ts';
import {
  HELIOS_ALPHA02_PREREGISTRATION_BLOCKED,
  HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED,
  HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
} from './taxonomy.ts';
import type { Alpha02PreregistrationEvidence, ForwardCampaignRegistration } from './types.ts';

export type Alpha02QualificationResult = {
  readonly marker: typeof HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED | typeof HELIOS_ALPHA02_PREREGISTRATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function pushBlocker(target: string[], message: string): void {
  target.push(message);
}

export function evaluateAlpha02PreregistrationQualification(
  registration: ForwardCampaignRegistration,
): Alpha02QualificationResult {
  const blockers: string[] = [];

  if (registration.schema !== HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA) {
    pushBlocker(blockers, 'forward-campaign-registration.schema mismatch');
  }
  if (registration.simulationOnly !== true) {
    pushBlocker(blockers, 'forward campaign must remain simulationOnly');
  }
  if (registration.grantsExecutionAuthority !== false) {
    pushBlocker(blockers, 'forward campaign must not grant execution authority');
  }
  if (!registration.campaignFingerprint.trim()) {
    pushBlocker(blockers, 'campaignFingerprint required');
  }
  if (!campaignFingerprintMatchesRegistration(registration)) {
    pushBlocker(blockers, 'campaignFingerprint does not match frozen configuration material');
  }
  if (registration.manifest.featureSet.length === 0) {
    pushBlocker(blockers, 'manifest.featureSet must be non-empty');
  }
  if (registration.manifest.modelVersions.length === 0) {
    pushBlocker(blockers, 'manifest.modelVersions must be non-empty');
  }
  if (registration.manifest.evaluationMetrics.length === 0) {
    pushBlocker(blockers, 'manifest.evaluationMetrics required');
  }
  if (registration.manifest.statisticalTests.length === 0) {
    pushBlocker(blockers, 'manifest.statisticalTests required');
  }
  if (registration.manifest.promotionThresholds.length === 0) {
    pushBlocker(blockers, 'manifest.promotionThresholds required');
  }
  if (registration.hypothesis.statement.trim().length === 0) {
    pushBlocker(blockers, 'hypothesis.statement required');
  }
  if (registration.adaptationPolicy.manualOverrideForbidden !== true) {
    pushBlocker(blockers, 'adaptationPolicy.manualOverrideForbidden must be true');
  }
  if (
    registration.adaptationPolicy.onlineLearningPermitted &&
    registration.adaptationPolicy.permittedRules.length === 0
  ) {
    pushBlocker(blockers, 'online learning permitted but no adaptation rules predeclared');
  }

  const lifecycle = registration.lifecycle.state;
  if (lifecycle === 'ACTIVE' && registration.lifecycle.startedAt === null) {
    pushBlocker(blockers, 'ACTIVE campaign requires startedAt');
  }
  if (lifecycle === 'SEALED' && registration.lifecycle.startedAt !== null) {
    pushBlocker(blockers, 'SEALED campaign must not have startedAt');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED : HELIOS_ALPHA02_PREREGISTRATION_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
  });
}

export function buildAlpha02PreregistrationEvidence(
  registration: ForwardCampaignRegistration,
): Alpha02PreregistrationEvidence {
  const gate = evaluateAlpha02PreregistrationQualification(registration);
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    qualificationMarker: gate.marker,
    campaign: registration,
    blockers: gate.blockers,
  });
}
