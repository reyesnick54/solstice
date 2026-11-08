/**
 * HELIOS Forward Alpha ALPHA02 — post-start configuration immutability (no hindsight configuration).
 */

import { computeCampaignFingerprint, stableStringify, type CampaignFingerprintMaterial } from './fingerprint.ts';
import type { ForwardCampaignRegistration } from './types.ts';

export type CampaignConfigurationPatch = Partial<CampaignFingerprintMaterial>;

export function campaignFingerprintMatchesRegistration(registration: ForwardCampaignRegistration): boolean {
  const recomputed = computeCampaignFingerprint({
    manifest: registration.manifest,
    hypothesis: registration.hypothesis,
    benchmarkPolicy: registration.benchmarkPolicy,
    costPolicy: registration.costPolicy,
    sizingPolicy: registration.sizingPolicy,
    adaptationPolicy: registration.adaptationPolicy,
  });
  return recomputed === registration.campaignFingerprint;
}

/**
 * Reject any attempt to mutate frozen configuration after the campaign has started.
 */
export function assertCampaignConfigurationImmutable(
  registration: ForwardCampaignRegistration,
  proposed?: CampaignConfigurationPatch,
): void {
  if (registration.lifecycle.state === 'SEALED') {
    if (proposed !== undefined) {
      throw new Error('ALPHA02 configuration patches are forbidden before explicit seal verification');
    }
    return;
  }

  if (registration.lifecycle.state !== 'ACTIVE' && registration.lifecycle.state !== 'COMPLETED') {
    return;
  }

  if (!campaignFingerprintMatchesRegistration(registration)) {
    throw new Error('ALPHA02 campaignFingerprint no longer matches frozen configuration body');
  }

  if (proposed !== undefined) {
    const material: CampaignFingerprintMaterial = {
      manifest: proposed.manifest ?? registration.manifest,
      hypothesis: proposed.hypothesis ?? registration.hypothesis,
      benchmarkPolicy: proposed.benchmarkPolicy ?? registration.benchmarkPolicy,
      costPolicy: proposed.costPolicy ?? registration.costPolicy,
      sizingPolicy: proposed.sizingPolicy ?? registration.sizingPolicy,
      adaptationPolicy: proposed.adaptationPolicy ?? registration.adaptationPolicy,
    };
    const patchedFingerprint = computeCampaignFingerprint(material);
    if (patchedFingerprint !== registration.campaignFingerprint) {
      throw new Error('ALPHA02 hindsight configuration change rejected after campaign start');
    }
  }
}

export function rejectHindsightConfigurationPatch(
  registration: ForwardCampaignRegistration,
  patchLabel: string,
  patchBody: unknown,
): never {
  const digest = stableStringify({ patchLabel, patchBody });
  assertCampaignConfigurationImmutable(registration, undefined);
  throw new Error(`ALPHA02 hindsight configuration patch forbidden (${patchLabel}): ${digest.slice(0, 120)}`);
}
