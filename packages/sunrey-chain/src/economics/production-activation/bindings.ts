/**
 * Cross-policy version bindings.
 *
 * "latest" is never a legal reference. Incompatible policy pairs
 * return POLICY_BINDING_MISMATCH.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';

import {
  BINDING_KEYS,
  type PolicyBindingPair,
  type ProductionEconomicActivationManifest,
  type VersionBinding,
} from './types.ts';

export const MANIFEST_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_ACTIVATION_MANIFEST_V1' as const;

const UNBOUND = 'UNBOUND' as const;

export function bindingRejectedAsLatest(versionId: string): boolean {
  return versionId.trim().toLowerCase() === 'latest';
}

export function manifestFromBindings(bindings: readonly VersionBinding[]): ProductionEconomicActivationManifest {
  const ordered = BINDING_KEYS.map((key) => {
    const found = bindings.find((row) => row.key === key);
    return Object.freeze({
      key,
      versionId: found && !bindingRejectedAsLatest(found.versionId) ? found.versionId : UNBOUND,
      contentHash: found && !bindingRejectedAsLatest(found.versionId) ? found.contentHash : UNBOUND,
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    firewallId: 'sunrey.economics.production-activation.firewall.v1',
    bindings: Object.freeze(ordered),
    unboundLatestRejected: true,
  });
}

export function activationManifestHash(manifest: ProductionEconomicActivationManifest): string {
  const parts = [
    encodeString(MANIFEST_DOMAIN),
    encodeString(String(manifest.schemaVersion)),
    encodeString(manifest.firewallId),
  ];
  for (const row of manifest.bindings) {
    parts.push(encodeString(row.key), encodeString(row.versionId), encodeString(row.contentHash));
  }
  return sha256Hex(Buffer.concat(parts));
}

export function policyBindingStatus(
  bindings: readonly VersionBinding[],
  pairs: readonly PolicyBindingPair[],
): 'BOUND' | 'UNBOUND' | 'MISMATCH' {
  if (pairs.some((pair) => !pair.compatible)) {
    return 'MISMATCH';
  }
  const manifest = manifestFromBindings(bindings);
  if (manifest.bindings.some((row) => row.versionId === UNBOUND || row.contentHash === UNBOUND)) {
    return 'UNBOUND';
  }
  if (bindings.some((row) => bindingRejectedAsLatest(row.versionId))) {
    return 'UNBOUND';
  }
  return 'BOUND';
}

export function incompatiblePair(
  leftKey: PolicyBindingPair['leftKey'],
  leftVersionId: string,
  rightKey: PolicyBindingPair['rightKey'],
  rightVersionId: string,
): PolicyBindingPair {
  return Object.freeze({
    leftKey,
    leftVersionId,
    rightKey,
    rightVersionId,
    compatible: false,
  });
}

export function compatiblePair(
  leftKey: PolicyBindingPair['leftKey'],
  leftVersionId: string,
  rightKey: PolicyBindingPair['rightKey'],
  rightVersionId: string,
): PolicyBindingPair {
  return Object.freeze({
    leftKey,
    leftVersionId,
    rightKey,
    rightVersionId,
    compatible: true,
  });
}
