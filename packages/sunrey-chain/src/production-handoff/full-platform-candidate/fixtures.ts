/**
 * Current-repository bindings for the full-platform candidate.
 * Uses rehearsal / simulation parameter packages only.
 */

import { evaluateProductionEconomicActivation } from '../../economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from '../../economics/production-activation/fixtures.ts';
import { currentRepositoryCandidateBundle as currentEconomicConstitutionBundle } from '../../release-candidate/economic/production-constitution/fixtures.ts';
import { assembleHandoffPackage } from '../handoff.ts';
import { currentComponentBindings } from './bindings.ts';
import { assembleCandidateBundle, candidateBundleDefaults, componentHashMap, type BundleHashInput } from './bundle.ts';
import { runFullPlatformBurnIn } from './burn-in.ts';
import { hashCanonical } from './hash.ts';
import { COMPONENT_EVIDENCE_KEYS, type BurnInProfile, type ComponentEvidenceKey } from './types.ts';

export function currentRepositoryBundleInput(
  root = process.cwd(),
  profile: BurnInProfile = 'SMOKE',
): { readonly hashes: BundleHashInput; readonly burnIn: ReturnType<typeof runFullPlatformBurnIn> } {
  const defaults = candidateBundleDefaults(root, profile);
  const firewall = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  const constitution = currentEconomicConstitutionBundle(firewall.decisionId, root);
  const handoff = assembleHandoffPackage(root);
  const burnIn = runFullPlatformBurnIn({ profile, seed: defaults.seed });
  const bindings = currentComponentBindings({
    sourceCommit: defaults.sourceCommit,
    firewallDecisionHash: firewall.decisionId,
    economicConstitutionHash: constitution.bundleHash,
    mainnetRcHash: handoff.mainnetRcHash ?? hashCanonical(handoff.mainnetRcId),
    handoffPackageHash: handoff.hash,
  });
  const componentHashes = {} as Record<ComponentEvidenceKey, string>;
  for (const key of COMPONENT_EVIDENCE_KEYS) {
    componentHashes[key] = bindings.find((row) => row.key === key)?.contentHash ?? hashCanonical(key);
  }
  return Object.freeze({
    burnIn,
    hashes: Object.freeze({
      ...defaults,
      mainnetRcHash: handoff.mainnetRcHash ?? hashCanonical(handoff.mainnetRcId),
      economicConstitutionHash: constitution.bundleHash,
      firewallDecisionHash: firewall.decisionId,
      productionHandoffPackageHash: handoff.hash,
      componentHashes: componentHashMap(componentHashes),
      architectureIntegrityHash: hashCanonical({
        manifest: 'docs/architecture/manifest.json',
        constitution: 'docs/architecture/constitution.md',
        owner: 'sunrey-production-handoff',
      }),
      burnInCanonicalHash: burnIn.canonicalHash,
    }),
  });
}

export function currentRepositoryCandidateBundle(
  root = process.cwd(),
  profile: BurnInProfile = 'SMOKE',
) {
  return assembleCandidateBundle(currentRepositoryBundleInput(root, profile).hashes);
}
