/**
 * Wave 2 — protocol version handling.
 *
 * Nodes reject incompatible consensus-critical protocol versions rather
 * than silently diverging. No uncontrolled automatic upgrades.
 */

import { PROTOCOL_SCHEMA_VERSION } from '../protocol/constants.ts';

export const SUPPORTED_PROTOCOL_VERSIONS = ['1'] as const;
export type SupportedProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

export const PROTOCOL_UPGRADE_POLICY = Object.freeze({
  automaticUpgrade: false,
  requiresGovernanceAuthorization: true,
  requiresScheduledActivationHeight: true,
  incompatibleNodesMustRefuse: true,
  schemaVersion: PROTOCOL_SCHEMA_VERSION,
});

export type ProtocolCompatibilityResult =
  | { readonly ok: true; readonly version: SupportedProtocolVersion }
  | { readonly ok: false; readonly reason: 'UNSUPPORTED_VERSION' | 'VERSION_MISMATCH'; readonly detail: string };

export function assertProtocolCompatible(input: {
  readonly localVersion: string;
  readonly networkVersion: string;
}): ProtocolCompatibilityResult {
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(input.localVersion as SupportedProtocolVersion)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED_VERSION',
      detail: `local ${input.localVersion} not in [${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}]`,
    };
  }
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(input.networkVersion as SupportedProtocolVersion)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED_VERSION',
      detail: `network ${input.networkVersion} not in [${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}]`,
    };
  }
  if (input.localVersion !== input.networkVersion) {
    return {
      ok: false,
      reason: 'VERSION_MISMATCH',
      detail: `local ${input.localVersion} != network ${input.networkVersion}`,
    };
  }
  return { ok: true, version: input.localVersion as SupportedProtocolVersion };
}

export type UpgradeMechanismRequirements = {
  readonly governanceProposalRequired: true;
  readonly accountableThresholdRequired: true;
  readonly activationHeightRequired: true;
  readonly binaryCompatibilityCheckRequired: true;
  readonly rollbackPlanRequired: true;
  readonly automaticUpgradeForbidden: true;
};

export const FUTURE_UPGRADE_REQUIREMENTS: UpgradeMechanismRequirements = Object.freeze({
  governanceProposalRequired: true,
  accountableThresholdRequired: true,
  activationHeightRequired: true,
  binaryCompatibilityCheckRequired: true,
  rollbackPlanRequired: true,
  automaticUpgradeForbidden: true,
});
