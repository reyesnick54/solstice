import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
} from '../../../config/src/flags.ts';
import { emptyBook } from './supply.ts';
import { currentLiveFlags } from './production-activation/invariants.ts';
import { currentRepositoryParameterPackage, validateParameterPackage } from './production-activation/parameter-package/validation.ts';
import { completeFixturePackageInput } from './production-activation/parameter-package/fixtures.ts';
import {
  ASSET_SUPPLY_BOOK_REMAINS_SUPPLY_AUTHORITY,
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  PEVE_IS_SUNREY_TOKEN_VALUATION,
  REFERENCE_PRICE_CAN_MINT_MOONREY,
  attemptForceActivation,
  attemptOverrideFirewall,
  bindExternalEvidence,
  bindGenesisAuthorization,
  bindMoonReyIssuanceProposal,
  bindSunReyIssuanceProposal,
  buildProductionAuthorizationOfflinePackage,
  currentExternalEvidenceSlots,
  currentOperatingScopeBinding,
  currentProviderBindingMatrix,
  diffProductionAuthorizationParameters,
  evaluateCurrentRepositoryAuthorization,
  evaluateFirewallWithAuthorization,
  evaluateProductionApprovals,
  evaluateProductionEconomicAuthorization,
  evaluateRehearsalPromotionAttempt,
  fixtureProcessApprovals,
  hashAuthorizationMaterial,
  missingProviderBlocksOnlyBoundDomain,
  runAuthorizationPreflight,
  signProductionApproval,
} from './production-activation/authorization/index.ts';

describe('Chunk 163 production economic authorization', () => {
  it('1. authorization hash is deterministic', () => {
    const first = evaluateCurrentRepositoryAuthorization();
    const second = evaluateCurrentRepositoryAuthorization();
    assert.equal(first.pkg.authorizationHash, second.pkg.authorizationHash);
    assert.equal(first.pkg.authorizationHash.length, 64);
    assert.equal(
      hashAuthorizationMaterial({
        ...first.pkg,
        supersededBy: first.pkg.supersededBy ?? null,
      }),
      first.pkg.authorizationHash,
    );
  });

  it('2. parameter diff is deterministic', () => {
    const rehearsal = validateParameterPackage(completeFixturePackageInput()).package;
    const current = currentRepositoryParameterPackage();
    const first = diffProductionAuthorizationParameters(current, rehearsal);
    const second = diffProductionAuthorizationParameters(current, rehearsal);
    assert.equal(first.diffHash, second.diffHash);
    assert.equal(first.diffHash.length, 64);
    assert.equal(first.autoApproved, false);
    assert.equal(first.rehearsalPromoted, false);
  });

  it('3. missing production parameters blocks', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    assert.equal(evaluation.pkg.status, 'PARAMETERS_INCOMPLETE');
    assert.equal(evaluation.blockers.includes('PARAMETERS_INCOMPLETE'), true);
    assert.equal(evaluation.blockers.includes('PRODUCTION_PARAMETERS_UNCONFIGURED'), true);
    assert.equal(evaluation.pkg.parameterStatuses.every((row) => !row.productionEligible), true);
    assert.equal(evaluation.pkg.parameterStatuses.every((row) => row.authorizationClass === 'UNCONFIGURED'), true);
  });

  it('4. rehearsal parameters cannot become production', () => {
    const evaluation = evaluateRehearsalPromotionAttempt();
    assert.equal(evaluation.pkg.parameterStatuses.some((row) => row.authorizationClass === 'REHEARSAL_REFERENCE'), true);
    assert.equal(evaluation.rehearsalParametersPromoted, false);
    assert.equal(evaluation.blockers.includes('REHEARSAL_PARAMETERS_CANNOT_BE_PROMOTED'), true);
    assert.equal(evaluation.pkg.status, 'REJECTED');
  });

  it('5. AI approval is rejected', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const signed = signProductionApproval({
      actorId: 's3m-reviewer',
      actorKind: 'AI',
      role: 'ECONOMIC_POLICY_AUTHORITY',
      pkg: base.pkg,
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    });
    assert.equal(signed.accepted, false);
    assert.equal(signed.rejectionReason, 'AI_CANNOT_APPROVE');
    const evaluated = evaluateProductionEconomicAuthorization({
      currentParameters: currentRepositoryParameterPackage(),
      proposedParameters: currentRepositoryParameterPackage(),
      approvals: [signed],
    });
    assert.equal(evaluated.blockers.includes('AI_CANNOT_APPROVE'), true);
  });

  it('6. agent approval is rejected', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const signed = signProductionApproval({
      actorId: 'agent-1',
      actorKind: 'AGENT',
      role: 'PROTOCOL_AUTHORITY',
      pkg: base.pkg,
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    });
    assert.equal(signed.accepted, false);
    assert.equal(signed.rejectionReason, 'AGENT_CANNOT_APPROVE');
  });

  it('7. automation approval is rejected', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const signed = signProductionApproval({
      actorId: 'cron-1',
      actorKind: 'AUTOMATION',
      role: 'OPERATIONS_AUTHORITY',
      pkg: base.pkg,
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    });
    assert.equal(signed.accepted, false);
    assert.equal(signed.rejectionReason, 'AUTOMATION_CANNOT_APPROVE');
  });

  it('8. distinct human-role requirements are enforced', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const hashes = {
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    };
    const first = signProductionApproval({
      actorId: 'same-human',
      actorKind: 'HUMAN',
      role: 'PROTOCOL_AUTHORITY',
      pkg: base.pkg,
      ...hashes,
    });
    const second = signProductionApproval({
      actorId: 'same-human',
      actorKind: 'HUMAN',
      role: 'SECURITY_AUTHORITY',
      pkg: base.pkg,
      ...hashes,
    });
    const judged = evaluateProductionApprovals({
      pkg: base.pkg,
      bindings: [first, second],
      nowUtc: '2026-08-20T12:00:00.000Z',
      currentEvidenceHash: base.evidence.bundleHash,
      currentOperatingScopeHash: base.operatingScope.matrixHash,
      currentProviderHash: base.providers.matrixHash,
      currentParameterDiffHash: base.diff.diffHash,
      currentEconomicRcHash: base.pkg.economicRcHash,
      currentFullPlatformHash: base.pkg.fullPlatformCandidateHash,
    });
    assert.equal(judged.set.satisfied, false);
    assert.equal(judged.set.minimumDistinctActors, 6);
    const evaluated = evaluateProductionEconomicAuthorization({
      currentParameters: currentRepositoryParameterPackage(),
      proposedParameters: currentRepositoryParameterPackage(),
      packageId: base.pkg.packageId,
      approvals: [first, second],
    });
    assert.equal(evaluated.blockers.includes('DISTINCT_HUMAN_ROLES_REQUIRED'), true);
  });

  it('9. stale signature is rejected', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const signed = signProductionApproval({
      actorId: 'human-protocol-1',
      actorKind: 'HUMAN',
      role: 'PROTOCOL_AUTHORITY',
      pkg: base.pkg,
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    });
    const judged = evaluateProductionApprovals({
      pkg: base.pkg,
      bindings: [signed],
      nowUtc: '2027-01-01T00:00:00.000Z',
      currentEvidenceHash: base.evidence.bundleHash,
      currentOperatingScopeHash: base.operatingScope.matrixHash,
      currentProviderHash: base.providers.matrixHash,
      currentParameterDiffHash: base.diff.diffHash,
      currentEconomicRcHash: base.pkg.economicRcHash,
      currentFullPlatformHash: base.pkg.fullPlatformCandidateHash,
    });
    assert.equal(judged.bindings[0]?.accepted, false);
    assert.equal(judged.bindings[0]?.rejectionReason, 'STALE_SIGNATURE');
  });

  it('10. changed parameter hash invalidates approvals', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const signed = fixtureProcessApprovals(base.pkg, {
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    })[0]!;
    const judged = evaluateProductionApprovals({
      pkg: base.pkg,
      bindings: [signed],
      nowUtc: '2026-08-20T12:00:00.000Z',
      currentEvidenceHash: base.evidence.bundleHash,
      currentOperatingScopeHash: base.operatingScope.matrixHash,
      currentProviderHash: base.providers.matrixHash,
      currentParameterDiffHash: '0'.repeat(64),
      currentEconomicRcHash: base.pkg.economicRcHash,
      currentFullPlatformHash: base.pkg.fullPlatformCandidateHash,
    });
    assert.equal(judged.bindings[0]?.accepted, false);
    assert.equal(judged.bindings[0]?.rejectionReason, 'PARAMETER_HASH_CHANGED');
  });

  it('11. changed release hash invalidates approvals', () => {
    const base = evaluateCurrentRepositoryAuthorization();
    const signed = fixtureProcessApprovals(base.pkg, {
      parameterDiffHash: base.diff.diffHash,
      evidenceBundleHash: base.evidence.bundleHash,
      operatingScopeHash: base.operatingScope.matrixHash,
      providerBindingHash: base.providers.matrixHash,
    })[0]!;
    const judged = evaluateProductionApprovals({
      pkg: base.pkg,
      bindings: [signed],
      nowUtc: '2026-08-20T12:00:00.000Z',
      currentEvidenceHash: base.evidence.bundleHash,
      currentOperatingScopeHash: base.operatingScope.matrixHash,
      currentProviderHash: base.providers.matrixHash,
      currentParameterDiffHash: base.diff.diffHash,
      currentEconomicRcHash: 'f'.repeat(64),
      currentFullPlatformHash: base.pkg.fullPlatformCandidateHash,
    });
    assert.equal(judged.bindings[0]?.accepted, false);
    assert.equal(judged.bindings[0]?.rejectionReason, 'RELEASE_HASH_CHANGED');
  });

  it('12. revoked external evidence invalidates the package', () => {
    const slots = currentExternalEvidenceSlots({
      SECURITY_AUDIT: { present: true, revoked: true, contentHash: 'a'.repeat(64) },
    });
    const evaluation = evaluateProductionEconomicAuthorization({
      currentParameters: currentRepositoryParameterPackage(),
      proposedParameters: currentRepositoryParameterPackage(),
      evidenceSlots: slots,
    });
    assert.equal(evaluation.evidence.revoked, true);
    assert.equal(evaluation.blockers.includes('EXTERNAL_EVIDENCE_REVOKED'), true);
  });

  it('13. expired external evidence invalidates the package', () => {
    const slots = currentExternalEvidenceSlots({
      COUNSEL_OPINION: {
        present: true,
        revoked: false,
        expiresAtUtc: '2026-01-01T00:00:00.000Z',
        contentHash: 'b'.repeat(64),
      },
    });
    const evaluation = evaluateProductionEconomicAuthorization({
      currentParameters: currentRepositoryParameterPackage(),
      proposedParameters: currentRepositoryParameterPackage(),
      evidenceSlots: slots,
      nowUtc: '2026-08-20T12:00:00.000Z',
    });
    assert.equal(evaluation.evidence.expired, true);
    assert.equal(evaluation.blockers.includes('EXTERNAL_EVIDENCE_EXPIRED'), true);
  });

  it('14. operating scope is bound', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    const scope = currentOperatingScopeBinding();
    assert.equal(evaluation.pkg.operatingScopeMatrixHash, scope.matrixHash);
    assert.equal(evaluation.operatingScope.nativeProtocolSeparatedFromRegulatedServices, true);
    assert.equal(evaluation.operatingScope.globalPackageActivatesRegulatedProducts, false);
    assert.equal(evaluation.operatingScope.rows.some((row) => row.domain === 'BANKING' && row.kind === 'REGULATED_SERVICE'), true);
    assert.equal(bindExternalEvidence(currentExternalEvidenceSlots(), '2026-08-20T12:00:00.000Z').bundleHash.length, 64);
  });

  it('15. provider matrix is bound', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    const matrix = currentProviderBindingMatrix();
    assert.equal(evaluation.pkg.providerBindingMatrixHash, matrix.matrixHash);
    assert.equal(matrix.unrelatedProviderMissingBlocksProtocol, false);
    assert.equal(missingProviderBlocksOnlyBoundDomain(matrix, 'BANKING'), true);
    assert.equal(missingProviderBlocksOnlyBoundDomain(matrix, 'NATIVE_PROTOCOL'), false);
  });

  it('16. hidden premint is forbidden', () => {
    const result = bindGenesisAuthorization({ hiddenPremint: true });
    assert.equal(result.blockers.includes('HIDDEN_PREMINT_FORBIDDEN'), true);
    assert.equal(result.binding.hiddenPremint, false);
  });

  it('17. testnet faucet migration is forbidden', () => {
    const result = bindGenesisAuthorization({ inheritedTestnetFaucet: true });
    assert.equal(result.blockers.includes('TESTNET_FAUCET_MIGRATION_FORBIDDEN'), true);
    assert.equal(result.binding.inheritedTestnetFaucet, false);
  });

  it('18. application ledger migration is forbidden', () => {
    const result = bindGenesisAuthorization({ migratedApplicationLedgerBalances: true });
    assert.equal(result.blockers.includes('APPLICATION_LEDGER_MIGRATION_FORBIDDEN'), true);
    assert.equal(result.binding.migratedApplicationLedgerBalances, false);
  });

  it('19. PEVE cannot act as SunRey token valuation', () => {
    const result = bindSunReyIssuanceProposal({ peveUsedAsTokenValuation: true });
    assert.equal(result.blockers.includes('PEVE_CANNOT_VALUE_SUNREY'), true);
    assert.equal(result.binding.peveUsedAsTokenValuation, false);
    assert.equal(PEVE_IS_SUNREY_TOKEN_VALUATION, false);
  });

  it('20. reference price cannot directly mint MoonRey', () => {
    const result = bindMoonReyIssuanceProposal({ referencePriceMintsDirectly: true });
    assert.equal(result.blockers.includes('REFERENCE_PRICE_CANNOT_MINT_MOONREY'), true);
    assert.equal(result.binding.referencePriceMintsDirectly, false);
    assert.equal(REFERENCE_PRICE_CAN_MINT_MOONREY, false);
  });

  it('21. Chunk 71 remains monetary authority', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    assert.equal(evaluation.pkg.chunk71RemainsMonetaryAuthority, true);
    assert.equal(CHUNK_71_REMAINS_MONETARY_AUTHORITY, true);
    assert.equal(evaluation.sunrey.chunk71Bound, true);
    assert.equal(evaluation.moonrey.chunk71Bound, true);
  });

  it('22. AssetSupplyBook remains supply authority', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    assert.equal(evaluation.supplyModel.supplyBookAuthority, 'CHUNK_71_ASSET_SUPPLY_BOOK');
    assert.equal(ASSET_SUPPLY_BOOK_REMAINS_SUPPLY_AUTHORITY, true);
    assert.equal(evaluation.pkg.assetSupplyBookRemainsSupplyAuthority, true);
    const book = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
    assert.equal(book.policyVersion, 'sunrey.monetary.constitution.v1');
  });

  it('23. full-platform burn-in is required', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    const check = evaluation.preflight.checks.find((row) => row.id === 'FULL_PLATFORM_BURN_IN');
    assert.equal(check?.passed, false);
    const passed = runAuthorizationPreflight({
      pkg: evaluation.pkg,
      diff: evaluation.diff,
      evidence: evaluation.evidence,
      operatingScope: evaluation.operatingScope,
      providers: evaluation.providers,
      supplyModel: evaluation.supplyModel,
      nowUtc: '2026-08-20T12:00:00.000Z',
      fullPlatformBurnIn: true,
      adversarialCampaign: true,
    });
    assert.equal(passed.checks.find((row) => row.id === 'FULL_PLATFORM_BURN_IN')?.passed, true);
  });

  it('24. adversarial campaign is required', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    const check = evaluation.preflight.checks.find((row) => row.id === 'ADVERSARIAL_CAMPAIGN');
    assert.equal(check?.passed, false);
    assert.equal(evaluation.preflight.passed, false);
  });

  it('25. firewall cannot be overridden', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    const fed = evaluateFirewallWithAuthorization(evaluation.pkg);
    assert.equal(fed.firewallProductionActivated, false);
    assert.equal(fed.overrideRejected, true);
    assert.equal(attemptOverrideFirewall(), 'FIREWALL_OVERRIDE_FORBIDDEN');
    assert.equal(attemptForceActivation(), 'PRODUCTION_ACTIVATION_FORBIDDEN');
    const forced = evaluateProductionEconomicAuthorization({
      currentParameters: currentRepositoryParameterPackage(),
      proposedParameters: currentRepositoryParameterPackage(),
      forceActivation: true,
    });
    assert.equal(forced.blockers.includes('FIREWALL_OVERRIDE_FORBIDDEN'), true);
    assert.equal(forced.productionActive, false);
  });

  it('26. LIVE flags remain false', () => {
    const flags = currentLiveFlags();
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(LIVE_EXTERNAL_BANK_CONNECTION, false);
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(flags.ENVIRONMENT, 'simulation');
    assert.equal(flags.LIVE_MONEY_ENABLED, false);
  });

  it('27. production remains inactive', () => {
    const evaluation = evaluateCurrentRepositoryAuthorization();
    assert.equal(evaluation.productionActive, false);
    assert.equal(evaluation.pkg.productionActivated, false);
    assert.equal(evaluation.pkg.productionActivationRequested, false);
    assert.equal(evaluation.pkg.status === 'AUTHORIZED_CANDIDATE', false);
    const offline = buildProductionAuthorizationOfflinePackage(evaluation);
    assert.equal(offline.containsPrivateKeys, false);
    assert.equal(offline.packageKind, 'PRODUCTION_ECONOMIC_AUTHORIZATION');
    assert.equal(evaluation.blockers.includes('EXTERNAL_EVIDENCE_MISSING'), true);
    assert.equal(evaluation.blockers.includes('AWAITING_HUMAN_APPROVALS'), true);
  });
});
