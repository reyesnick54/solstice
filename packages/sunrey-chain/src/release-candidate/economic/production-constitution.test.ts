import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTION_PARAMETER_IDS } from '../../economics/production-activation/types.ts';
import { allConfiguredParameters, configuredParameter, evaluateProductionEconomicActivation } from '../../economics/production-activation/index.ts';
import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_MONEY_ENABLED,
} from '../../../../config/src/flags.ts';

import {
  analyzeEconomicConstitutionChange,
  assembleCandidateBundle,
  bindExact,
  freezeCandidateBundle,
  hashBundleFields,
  hashEconomicConstitution,
  implicitVersionRejected,
  missingParameterIds,
  parameterCoverage,
  qualifyProductionEconomicConstitutionCandidate,
  refuseAiHumanAuthorization,
  refuseAiMarkExternalEvidencePresent,
  refuseFreezeAndActivate,
  refuseMonetaryAuthorityInvocation,
  refuseNonHumanApproval,
  runRehearsalOnlyEndToEnd,
  currentActivationSnapshot,
  currentRepositoryBundleInput,
  currentRepositoryConstitutionSnapshot,
  withConstitutionSnapshot,
  currentExternalEvidenceInventory,
  legacyPathInventory,
  CANONICAL_AUTHORITIES,
} from './production-constitution/index.ts';

function qualifyCurrent(overlay: Parameters<typeof withConstitutionSnapshot>[1] = {}) {
  const activation = currentActivationSnapshot();
  const firewall = evaluateProductionEconomicActivation(activation);
  const snapshot = withConstitutionSnapshot(currentRepositoryConstitutionSnapshot(), overlay);
  const hashes = currentRepositoryBundleInput(firewall.decisionId);
  return {
    firewall,
    snapshot,
    hashes,
    decision: qualifyProductionEconomicConstitutionCandidate({ snapshot, hashes, firewall }),
    bundle: assembleCandidateBundle(hashes),
  };
}

describe('Chunk 148 production economic constitution candidate', () => {
  it('1. deterministic bundle hash', () => {
    const first = qualifyCurrent();
    const second = assembleCandidateBundle(first.hashes);
    assert.equal(first.bundle.bundleHash, second.bundleHash);
    assert.equal(hashBundleFields(first.hashes), first.bundle.bundleHash);
  });

  it('2. deterministic constitution hash', () => {
    const first = qualifyCurrent();
    const second = assembleCandidateBundle(first.hashes);
    assert.equal(first.bundle.economicConstitutionHash, second.economicConstitutionHash);
    assert.equal(hashEconomicConstitution(first.hashes), first.bundle.economicConstitutionHash);
  });

  it('3. every 15 parameter IDs accounted for', () => {
    const { decision } = qualifyCurrent();
    assert.equal(decision.parameterCoverage.length, 15);
    assert.deepEqual(
      decision.parameterCoverage.map((row) => row.id),
      [...PRODUCTION_PARAMETER_IDS],
    );
  });

  it('4. duplicate parameter rejected', () => {
    const snapshot = currentRepositoryConstitutionSnapshot();
    const duplicate = Object.freeze([...snapshot.parameters, snapshot.parameters[0]!]);
    const { hashes, firewall } = qualifyCurrent();
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot: withConstitutionSnapshot(snapshot, { parameters: duplicate }),
      hashes,
      firewall,
    });
    assert.equal(decision.reconciliation.failures.some((row) => row.startsWith('duplicate-parameter:')), true);
    assert.notEqual(decision.result, 'PRODUCTION_CANDIDATE_PACKAGE_READY');
  });

  it('5. missing parameter visible', () => {
    const snapshot = currentRepositoryConstitutionSnapshot();
    const missing = snapshot.parameters.filter((row) => row.id !== 'SUNREY_MAXIMUM_SUPPLY');
    assert.deepEqual(missingParameterIds(missing), ['SUNREY_MAXIMUM_SUPPLY']);
    const coverage = parameterCoverage(missing);
    assert.equal(coverage.find((row) => row.id === 'SUNREY_MAXIMUM_SUPPLY')?.status, 'UNCONFIGURED');
    assert.match(coverage.find((row) => row.id === 'SUNREY_MAXIMUM_SUPPLY')?.notes ?? '', /cannot silently pass/);
  });

  it('6. SunRey policy bindings complete', () => {
    const { snapshot, decision } = qualifyCurrent();
    assert.equal(snapshot.sunrey.issuanceClass, 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION');
    assert.equal(snapshot.sunrey.supplyBook, 'AssetSupplyBook');
    assert.equal(decision.reconciliation.sunreyOk, true);
  });

  it('7. MoonRey policy bindings complete', () => {
    const { snapshot, decision } = qualifyCurrent();
    assert.equal(snapshot.moonrey.issuanceClass, 'VERIFIED_PRODUCTIVE_CONTRIBUTION');
    assert.equal(snapshot.moonrey.productiveValueOutputUnit, 'GPUV');
    assert.equal(decision.reconciliation.moonreyOk, true);
  });

  it('8. valuation denomination reconciliation', () => {
    const { snapshot, hashes, firewall } = qualifyCurrent();
    assert.equal(snapshot.sunrey.valuationOutputDenomination, snapshot.sunrey.conversionInputDenomination);
    const broken = withConstitutionSnapshot(snapshot, {
      sunrey: Object.freeze({ ...snapshot.sunrey, conversionInputDenomination: 'SUNREY_COIN' }),
    });
    const decision = qualifyProductionEconomicConstitutionCandidate({ snapshot: broken, hashes, firewall });
    assert.equal(decision.reconciliation.sunreyOk, false);
    assert.equal(decision.reconciliation.failures.includes('sunrey-denomination-mismatch'), true);
  });

  it('9. GPUV conversion reconciliation', () => {
    const { snapshot } = qualifyCurrent();
    assert.equal(snapshot.moonrey.productiveValueOutputUnit, 'GPUV');
    assert.equal(snapshot.moonrey.conversionInputUnit, 'GPUV');
    assert.equal(snapshot.moonrey.conversionOutputAsset, 'MOONREY_COIN');
    assert.equal(snapshot.moonrey.gpuvEqualsMoonRey, false);
  });

  it('10. source taxonomy version binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'sourceTaxonomy');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
    assert.equal(row.contentHash.length, 64);
  });

  it('11. unit version binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'unitConstitution');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
  });

  it('12. attribution version binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'attribution');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
  });

  it('13. provider certification version binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'oracleCertification');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
  });

  it('14. HIN version binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'hinPolicy');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
  });

  it('15. HIN anchor version binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'hinChainAnchor');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
  });

  it('16. Economic Asset verification binding', () => {
    const { snapshot } = qualifyCurrent();
    const row = snapshot.bindings.find((item) => item.key === 'economicAssetVerification');
    assert.ok(row);
    assert.equal(implicitVersionRejected(row.versionId), false);
  });

  it('17. max-supply consistency', () => {
    const current = qualifyCurrent();
    assert.equal(current.snapshot.maxSupply.sunreyConsistent, null);
    assert.equal(current.snapshot.maxSupply.duplicateMaxSupplyField, false);
    const broken = withConstitutionSnapshot(current.snapshot, {
      maxSupply: Object.freeze({ sunreyConsistent: false, moonreyConsistent: false, duplicateMaxSupplyField: true }),
    });
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot: broken,
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.reconciliation.failures.includes('duplicate-max-supply-field'), true);
    assert.equal(decision.reconciliation.failures.includes('sunrey-max-supply-inconsistent'), true);
  });

  it('18. genesis consistency', () => {
    const current = qualifyCurrent();
    assert.equal(current.snapshot.genesis.hiddenAllocation, false);
    assert.equal(current.snapshot.genesis.sunreyAllocationEqualsGenesis, null);
    const broken = withConstitutionSnapshot(current.snapshot, {
      genesis: Object.freeze({
        ...current.snapshot.genesis,
        sunreyAllocationEqualsGenesis: false,
        hiddenAllocation: true,
      }),
    });
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot: broken,
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.reconciliation.failures.includes('hidden-allocation'), true);
    assert.equal(decision.reconciliation.failures.includes('sunrey-genesis-inconsistent'), true);
  });

  it('19. supply reconciliation', () => {
    const { snapshot, decision } = qualifyCurrent();
    assert.equal(snapshot.supply.canonicalSupplyBook, true);
    assert.equal(snapshot.supply.usedExistingChunk71Auditor, true);
    assert.equal(decision.reconciliation.supplyOk, true);
  });

  it('20. no hidden premint', () => {
    const { snapshot } = qualifyCurrent();
    assert.equal(snapshot.supply.hiddenPremint, false);
  });

  it('21. no faucet migration', () => {
    const { snapshot } = qualifyCurrent();
    assert.equal(snapshot.supply.faucetMigration, false);
    assert.equal(snapshot.genesis.inheritedFaucet, false);
  });

  it('22. legacy SunRey fixture cannot qualify', () => {
    const current = qualifyCurrent();
    const snapshot = withConstitutionSnapshot(current.snapshot, {
      sunrey: Object.freeze({ ...current.snapshot.sunrey, legacyFixturePath: true, productionEligible: true }),
    });
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot,
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.openBlockers.includes('legacy-sunrey-fixture-cannot-qualify'), true);
    assert.notEqual(decision.result, 'PRODUCTION_CANDIDATE_PACKAGE_READY');
  });

  it('23. MoonRey V1 cannot qualify', () => {
    const current = qualifyCurrent();
    const snapshot = withConstitutionSnapshot(current.snapshot, {
      moonrey: Object.freeze({ ...current.snapshot.moonrey, legacyV1Path: true, productionEligible: true }),
    });
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot,
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.openBlockers.includes('moonrey-v1-cannot-qualify'), true);
    assert.equal(decision.reconciliation.failures.includes('legacy-v1-qualified'), true);
  });

  it('24. rehearsal values cannot qualify', () => {
    const current = qualifyCurrent();
    const rehearsal = allConfiguredParameters().map((row) =>
      Object.freeze({ ...row, sourceClass: 'REHEARSAL', governed: true }),
    );
    const snapshot = withConstitutionSnapshot(current.snapshot, { parameters: rehearsal });
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot,
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.parameterCoverage.every((row) => row.status === 'FIXTURE_ONLY'), true);
    assert.equal(decision.openBlockers.includes('rehearsal-values-cannot-qualify'), true);
    assert.notEqual(decision.result, 'PRODUCTION_CANDIDATE_PACKAGE_READY');
  });

  it('25. duplicate authority fails', () => {
    const current = qualifyCurrent();
    const authorities = current.snapshot.authorities.map((row) =>
      row.domain === 'MONETARY_ISSUANCE'
        ? Object.freeze({ ...row, competingOwners: Object.freeze(['packages/tokenomics-v2']) })
        : row,
    );
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot: withConstitutionSnapshot(current.snapshot, { authorities }),
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.reconciliation.failures.includes('duplicate-authority:MONETARY_ISSUANCE'), true);
    assert.equal(decision.reconciliation.authorityOk, false);
  });

  it('26. firewall result included by hash', () => {
    const { firewall, bundle, decision } = qualifyCurrent();
    assert.equal(bundle.firewallDecisionHash, firewall.decisionId);
    assert.equal(decision.firewallDecisionHash, firewall.decisionId);
  });

  it('27. bundle cannot override firewall', () => {
    const current = qualifyCurrent();
    const hashes = { ...current.hashes, firewallDecisionHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' };
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot: current.snapshot,
      hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.openBlockers.includes('bundle-cannot-override-firewall'), true);
  });

  it('28. external evidence not fabricated', () => {
    const inventory = currentExternalEvidenceInventory();
    assert.equal(inventory.every((row) => row.fabricated === false && row.present === false), true);
    assert.ok(inventory.some((row) => row.evidenceId === 'external-security-review'));
    assert.ok(inventory.some((row) => row.evidenceId === 'legal-counsel'));
  });

  it('29. missing human decisions listed', () => {
    const { decision } = qualifyCurrent();
    assert.ok(decision.humanDecisionsRequired.length >= 15);
    assert.equal(decision.humanDecisionsRequired.every((row) => row.kind === 'PARAMETER_SELECTION'), true);
    assert.equal(decision.humanDecisionsRequired.every((row) => row.aiMayDecide === false), true);
  });

  it('30. parameter selection != final authorization', () => {
    const { decision } = qualifyCurrent();
    assert.equal(decision.parameterSelectionIsFinalAuthorization, false);
    assert.equal(decision.humanAuthorizationRequired[0]?.kind, 'FINAL_ACTIVATION_AUTHORIZATION');
    assert.notEqual(decision.humanDecisionsRequired[0]?.kind, 'FINAL_ACTIVATION_AUTHORIZATION');
  });

  it('31. AI cannot approve', () => {
    const refused = refuseNonHumanApproval('AI');
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'AI_CANNOT_APPROVE');
    const current = qualifyCurrent({ actorKind: 'AI', finalActivationAuthorization: true });
    assert.equal(current.decision.openBlockers.some((row) => row.startsWith('ai-cannot-approve')), true);
    assert.equal(refuseAiMarkExternalEvidencePresent().ok, false);
    assert.equal(refuseAiHumanAuthorization().ok, false);
  });

  it('32. S3M cannot approve', () => {
    assert.equal(refuseNonHumanApproval('S3M').code, 'S3M_CANNOT_APPROVE');
    const current = qualifyCurrent({ actorKind: 'S3M' });
    assert.equal(current.decision.aiCanAuthorize, false);
  });

  it('33. Grok cannot approve', () => {
    assert.equal(refuseNonHumanApproval('GROK').code, 'GROK_CANNOT_APPROVE');
    const current = qualifyCurrent({ actorKind: 'GROK' });
    assert.equal(current.decision.aiCanAuthorize, false);
  });

  it('34. end-to-end SunRey rehearsal path', () => {
    const result = runRehearsalOnlyEndToEnd();
    assert.equal(result.label, 'REHEARSAL_ONLY');
    assert.equal(result.sunreyPath.verificationState, 'VERIFIED');
    assert.equal(result.sunreyPath.valuationDenomination, result.sunreyPath.conversionInputDenomination);
    assert.equal(result.sunreyPath.issuanceClass, 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION');
    assert.equal(result.sunreyPath.supplyReconciles, true);
    assert.ok(result.sunreyPath.authorizedQuantity > 0n);
    assert.equal(result.productionCandidateEligible, false);
  });

  it('35. end-to-end MoonRey rehearsal path', () => {
    const result = runRehearsalOnlyEndToEnd();
    assert.equal(result.moonreyPath.productiveValueUnit, 'GPUV');
    assert.equal(result.moonreyPath.conversionInputUnit, 'GPUV');
    assert.equal(result.moonreyPath.conversionOutputAsset, 'MOONREY_COIN');
    assert.equal(result.moonreyPath.legacyV1, false);
    assert.equal(result.moonreyPath.supplyReconciles, true);
    assert.ok(result.moonreyPath.authorizedQuantity > 0n);
  });

  it('36. Exchange DVP reconciliation', () => {
    const result = runRehearsalOnlyEndToEnd();
    assert.equal(result.exchangeDvp.pair, 'SUNREY_COIN/MOONREY_COIN');
    assert.equal(result.exchangeDvp.owner, 'SunReyExchange');
    assert.equal(result.exchangeDvp.settled, true);
    assert.equal(result.exchangeDvp.sunreyReconciles, true);
    assert.equal(result.exchangeDvp.moonreyReconciles, true);
    assert.equal(result.exchangeDvp.custodyReconciles, true);
  });

  it('37. all LIVE flags false', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
  });

  it('38. production remains inactive', () => {
    const { bundle, decision, firewall } = qualifyCurrent();
    assert.equal(bundle.productionActivated, false);
    assert.equal(decision.productionActivated, false);
    assert.equal(firewall.productionActivated, false);
    assert.equal(
      ['AWAITING_PARAMETER_SELECTION', 'INCOMPLETE', 'ENGINEERING_RECONCILED'].includes(decision.result),
      true,
    );
    assert.equal(decision.result, 'AWAITING_PARAMETER_SELECTION');
    const frozen = freezeCandidateBundle(bundle);
    assert.equal(frozen.approved, false);
    assert.equal(frozen.activated, false);
    assert.equal(frozen.authorized, false);
    assert.equal(refuseFreezeAndActivate().code, 'FREEZE_IS_NOT_ACTIVATION');
    assert.equal(refuseMonetaryAuthorityInvocation().ok, false);
  });

  it('rejects implicit latest/current/default bindings', () => {
    assert.equal(implicitVersionRejected('latest'), true);
    assert.equal(implicitVersionRejected('CURRENT'), true);
    assert.equal(implicitVersionRejected('default'), true);
    const current = qualifyCurrent();
    const snapshot = withConstitutionSnapshot(current.snapshot, {
      bindings: Object.freeze([bindExact('monetaryConstitution', 'latest')]),
    });
    const decision = qualifyProductionEconomicConstitutionCandidate({
      snapshot,
      hashes: current.hashes,
      firewall: current.firewall,
    });
    assert.equal(decision.bundleState, 'BUNDLE_INCOMPLETE');
    assert.equal(decision.result, 'INCOMPLETE');
  });

  it('constitution hash changes when max supply binding changes', () => {
    const current = qualifyCurrent();
    const changed = assembleCandidateBundle({
      ...current.hashes,
      parameterPackageHash: 'aa'.repeat(32),
      supplyGuardHash: 'bb'.repeat(32),
    });
    assert.notEqual(changed.economicConstitutionHash, current.bundle.economicConstitutionHash);
    const impact = analyzeEconomicConstitutionChange(current.bundle, changed);
    assert.equal(impact.supplyChanged, true);
    assert.equal(impact.silentlyActivates, false);
  });

  it('current repository does not treat configuredParameter fixtures as production defaults', () => {
    const configured = configuredParameter('SUNREY_MAXIMUM_SUPPLY', '1');
    assert.equal(configured.status, 'CONFIGURED');
    const { decision } = qualifyCurrent();
    assert.equal(decision.parameterCoverage.every((row) => row.status === 'UNCONFIGURED'), true);
  });

  it('legacy path inventory never marks historical paths production-eligible', () => {
    assert.equal(legacyPathInventory().every((row) => row.productionCandidateEligible === false), true);
    assert.equal(CANONICAL_AUTHORITIES.MONETARY_ISSUANCE, 'Chunk71');
    assert.equal(CANONICAL_AUTHORITIES.SUPPLY, 'AssetSupplyBook');
  });
});
