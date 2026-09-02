import { commitCanonical } from '../hash.ts';

import type { EvidenceCommitment } from './commitment.ts';
import {
  ECONOMIC_CLAIM_ECONOMIES,
  EVIDENCE_BUNDLE_DOMAIN,
  EVIDENCE_BUNDLE_ROLES,
} from './constants.ts';
import { merkleRootFromEntries } from './merkle.ts';

export type EconomicClaimEconomy = (typeof ECONOMIC_CLAIM_ECONOMIES)[number];

export type EconomicClaimRef = {
  readonly claimId: string;
  readonly economy: EconomicClaimEconomy;
  readonly claimFingerprint: string;
};

export type EvidenceBundleRole = (typeof EVIDENCE_BUNDLE_ROLES)[number];

export type EvidenceBundleEntry = {
  readonly commitment: EvidenceCommitment;
  readonly role: EvidenceBundleRole;
};

export type EvidenceBundle = {
  readonly bundleId: string;
  readonly claim: EconomicClaimRef;
  readonly entries: readonly EvidenceBundleEntry[];
  readonly bundleRoot: string;
};

const ROLE_ORDER: Record<EvidenceBundleRole, number> = {
  SUPPORTING: 0,
  CONTRADICTING: 1,
  CHALLENGED: 2,
  SUPERSEDED: 3,
  REVOKED: 4,
};

function bundleIdFor(claim: EconomicClaimRef): string {
  return commitCanonical({
    domain: 'sunrey.evidence.bundle.id.v1',
    claimId: claim.claimId,
    economy: claim.economy,
    claimFingerprint: claim.claimFingerprint,
  });
}

function canonicalizeEntries(entries: readonly EvidenceBundleEntry[]): readonly EvidenceBundleEntry[] {
  const byHash = new Map<string, EvidenceBundleEntry>();
  for (const entry of entries) {
    const existing = byHash.get(entry.commitment.commitmentHash);
    if (!existing) {
      byHash.set(entry.commitment.commitmentHash, entry);
      continue;
    }
    if (ROLE_ORDER[entry.role] < ROLE_ORDER[existing.role]) {
      byHash.set(entry.commitment.commitmentHash, entry);
    }
  }
  return Object.freeze(
    [...byHash.values()].sort((left, right) => {
      const hashOrder = left.commitment.commitmentHash.localeCompare(right.commitment.commitmentHash);
      if (hashOrder !== 0) {
        return hashOrder;
      }
      return ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
    }),
  );
}

export function evidenceBundleMaterial(input: {
  readonly claim: EconomicClaimRef;
  readonly entries: readonly EvidenceBundleEntry[];
}): string {
  const entries = canonicalizeEntries(input.entries);
  return commitCanonical({
    domain: EVIDENCE_BUNDLE_DOMAIN,
    claimId: input.claim.claimId,
    economy: input.claim.economy,
    claimFingerprint: input.claim.claimFingerprint,
    entries: entries.map((entry) => ({
      commitmentHash: entry.commitment.commitmentHash,
      role: entry.role,
    })),
  });
}

export function evidenceBundleRoot(input: {
  readonly claim: EconomicClaimRef;
  readonly entries: readonly EvidenceBundleEntry[];
}): string {
  return evidenceBundleMaterial({
    claim: input.claim,
    entries: canonicalizeEntries(input.entries),
  });
}

export function evidenceBundleMerkleRoot(entries: readonly EvidenceBundleEntry[]): string {
  const canonical = canonicalizeEntries(entries);
  return merkleRootFromEntries(
    canonical.map((entry) => ({
      key: entry.commitment.commitmentHash,
      valueHex: entry.commitment.commitmentHash,
    })),
  );
}

export function createEvidenceBundle(input: {
  readonly claim: EconomicClaimRef;
  readonly entries: readonly EvidenceBundleEntry[];
}): EvidenceBundle {
  if (!ECONOMIC_CLAIM_ECONOMIES.includes(input.claim.economy)) {
    throw new TypeError(`unsupported economic claim economy: ${input.claim.economy}`);
  }
  const entries = canonicalizeEntries(input.entries);
  const bundleRoot = evidenceBundleRoot({ claim: input.claim, entries });
  return Object.freeze({
    bundleId: bundleIdFor(input.claim),
    claim: Object.freeze({ ...input.claim }),
    entries,
    bundleRoot,
  });
}

export function assertEvidenceBundle(bundle: EvidenceBundle): boolean {
  return evidenceBundleRoot({ claim: bundle.claim, entries: bundle.entries }) === bundle.bundleRoot;
}

export function bundleMerkleEntries(bundle: EvidenceBundle): ReadonlyArray<{ readonly key: string; readonly valueHex: string }> {
  return bundle.entries.map((entry) => ({
    key: entry.commitment.commitmentHash,
    valueHex: entry.commitment.commitmentHash,
  }));
}
