/**
 * Bind existing component evidence by capability ID, version ID,
 * content hash, and test receipt. Implicit versions are rejected.
 * This module does not import every domain package.
 */

import { FIRST_MAINNET_RC_ID } from '../../release-candidate/mainnet/types.ts';
import { FIRST_ECONOMIC_RC_ID } from '../../release-candidate/economic/types.ts';
import { BINDING_DOMAIN, hashOf, implicitVersionRejected } from './hash.ts';
import {
  COMPONENT_EVIDENCE_KEYS,
  type ComponentEvidenceKey,
  type ExactVersionBinding,
  type EvidenceReference,
} from './types.ts';

const CAPABILITY_FOR: Readonly<Record<ComponentEvidenceKey, string>> = Object.freeze({
  repositoryIntegrity: 'architecture-linting',
  architectureManifest: 'architecture-linting',
  buildProvenance: 'sunrey-supply-chain',
  securityAuditBundle: 'sunrey-audit-readiness',
  persistenceRecovery: 'persistence',
  idempotencyReconciliation: 'event-fabric',
  controlRoom: 'sunrey-production-handoff',
  adversarialCampaign: 'sunrey-adversarial-range',
  mainnetRc: 'sunrey-mainnet-rc',
  economicConstitutionCandidate: 'sunrey-economic-rc',
  productionActivationFirewall: 'sunrey-production-economic-activation-firewall',
  providerAcceptance: 'sunrey-production-provider-acceptance',
  credentialPlane: 'sunrey-production-provider-credential-plane',
  oracleProviderCandidates: 'sunrey-production-oracles',
  bankPaymentFxCandidates: 'sunrey-banking-payment-provider-candidates',
  regulatedProviderCandidates: 'sunrey-regulated-provider-candidates',
  custodyProviderCandidates: 'sunrey-dual-asset-custody-provider-candidate',
  kernelInvariants: 'kernel',
  ledgerInvariants: 'ledger',
  evidenceVault: 'evidence',
  sunreyChain: 'sunrey-chain',
  assetSupplyBook: 'sunrey-monetary-constitution',
  sunreyCoinPolicyCandidate: 'sunrey-production-issuance-policy-candidate',
  moonreyCoinPolicyCandidate: 'moonrey-production-issuance-policy',
  economicAssetRegistry: 'sunrey-economic-asset-verification',
  hin: 'sunrey-human-information-network',
  humanContributions: 'sunrey-human-economic-contributions',
  productiveEconomicData: 'sunrey-unified-economic-data-fabric',
  exchange: 'sunrey-exchange',
  custody: 'custody',
  aiRuntimeBoundary: 'sunrey-ai-runtime',
  sunreyAgentBoundary: 'sunrey-user-agent-mandates',
});

export function bindExact(
  key: string,
  versionId: string,
  capabilityId: string,
  content?: string,
): ExactVersionBinding {
  return Object.freeze({
    key,
    versionId,
    capabilityId,
    contentHash: hashOf(content ?? `${key}:${versionId}:${capabilityId}`),
  });
}

export function bindComponent(
  key: ComponentEvidenceKey,
  versionId: string,
  content?: string,
): EvidenceReference {
  const capabilityId = CAPABILITY_FOR[key];
  return Object.freeze({
    key,
    capabilityId,
    versionId,
    contentHash: hashOf(content ?? `${key}:${versionId}:${capabilityId}`),
    testReceiptId: `receipt.${key}.${versionId}`,
    lane: engineeringLane(key),
    fabricated: false,
  });
}

export function currentComponentBindings(input: {
  readonly sourceCommit: string;
  readonly firewallDecisionHash: string;
  readonly economicConstitutionHash: string;
  readonly mainnetRcHash: string;
  readonly handoffPackageHash: string;
}): readonly EvidenceReference[] {
  const version = `v1:${input.sourceCommit.slice(0, 12)}`;
  return Object.freeze(
    COMPONENT_EVIDENCE_KEYS.map((key) => {
      const special =
        key === 'productionActivationFirewall'
          ? input.firewallDecisionHash
          : key === 'economicConstitutionCandidate'
            ? input.economicConstitutionHash
            : key === 'mainnetRc'
              ? input.mainnetRcHash
              : key === 'controlRoom' || key === 'persistenceRecovery' || key === 'idempotencyReconciliation'
                ? input.handoffPackageHash
                : undefined;
      return bindComponent(key, version, special);
    }),
  );
}

export function rejectImplicitBindings(bindings: readonly ExactVersionBinding[]): readonly string[] {
  const failures: string[] = [];
  for (const row of bindings) {
    if (row.versionId.trim().length === 0) {
      failures.push(`${row.key}:unversioned`);
    }
    if (implicitVersionRejected(row.versionId)) {
      failures.push(`${row.key}:${row.versionId.toLowerCase()}`);
    }
  }
  return Object.freeze(failures);
}

export function orderedBindingHash(bindings: readonly ExactVersionBinding[]): string {
  const sorted = [...bindings].sort((a, b) => a.key.localeCompare(b.key));
  return hashOf(
    [BINDING_DOMAIN, String(sorted.length), ...sorted.flatMap((row) => [row.key, row.versionId, row.contentHash])].join(
      '|',
    ),
  );
}

export function defaultReleaseIds(): { readonly mainnetRcId: string; readonly economicRcId: string } {
  return Object.freeze({
    mainnetRcId: FIRST_MAINNET_RC_ID,
    economicRcId: FIRST_ECONOMIC_RC_ID,
  });
}

function engineeringLane(key: ComponentEvidenceKey): EvidenceReference['lane'] {
  if (key === 'securityAuditBundle') {
    return 'EXTERNAL';
  }
  return 'ENGINEERING';
}
