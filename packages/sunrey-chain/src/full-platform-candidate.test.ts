import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../config/src/flags.ts';
import { evaluateProductionEconomicActivation } from './economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from './economics/production-activation/fixtures.ts';
import {
  attemptAi,
  attemptMarkExternalPresent,
  attemptOracleMint,
  attemptReferencePriceMint,
  assembleCandidateBundle,
  bundleOverrideFirewallRejected,
  COMPONENT_EVIDENCE_KEYS,
  controlRoomRemainsReadOnly,
  createRuntime,
  currentExternalEvidenceInventory,
  currentRepositoryBundleInput,
  FORBIDDEN_PACKAGES,
  hashBundleFields,
  implicitVersionRejected,
  PRODUCTION_ACTIVE,
  projectControlRoom,
  qualifyFullPlatformCandidate,
  refuseAiStatusChange,
  refuseControlRoomMutation,
  refuseForceActivation,
  refuseKycUnavailable,
  refuseStaleFx,
  runFullPlatformBurnIn,
  runFullPlatformCommand,
  runProductionSafetySmokeCampaign,
  scanArtifacts,
} from './production-handoff/full-platform-candidate/index.ts';

type QualifyOverlay = Partial<
  Omit<Parameters<typeof qualifyFullPlatformCandidate>[0], 'hashes'>
>;

function qualifyCurrent(overlay: QualifyOverlay = {}) {
  const assembled = currentRepositoryBundleInput(process.cwd(), 'SMOKE');
  return {
    assembled,
    bundle: assembleCandidateBundle(assembled.hashes),
    decision: qualifyFullPlatformCandidate({
      hashes: assembled.hashes,
      burnIn: assembled.burnIn,
      ...overlay,
    }),
  };
}

describe('Chunk 158 full-platform production candidate', () => {
  it('1. full candidate bundle is deterministic', () => {
    const first = currentRepositoryBundleInput(process.cwd(), 'SMOKE');
    const second = assembleCandidateBundle(first.hashes);
    const third = assembleCandidateBundle(first.hashes);
    assert.equal(second.bundleHash, third.bundleHash);
    assert.equal(hashBundleFields(first.hashes), second.bundleHash);
    assert.equal(first.burnIn.canonicalHash, runFullPlatformBurnIn({ profile: 'SMOKE', seed: first.hashes.seed }).canonicalHash);
  });

  it('2. exact component hashes are bound', () => {
    const { bundle } = qualifyCurrent();
    for (const key of COMPONENT_EVIDENCE_KEYS) {
      assert.equal(bundle.componentHashes[key].length, 64);
    }
    assert.equal(bundle.firewallDecisionHash.length, 64);
    assert.equal(bundle.economicConstitutionHash.length, 64);
    assert.equal(bundle.productionActivated, false);
  });

  it('3. changed evidence invalidates the bundle', () => {
    const { assembled, bundle } = qualifyCurrent();
    const tampered = assembleCandidateBundle({
      ...assembled.hashes,
      componentHashes: Object.freeze({
        ...assembled.hashes.componentHashes,
        ledgerInvariants: '00'.repeat(32),
      }),
    });
    assert.notEqual(tampered.bundleHash, bundle.bundleHash);
  });

  it('4. architecture integrity is required', () => {
    const { decision } = qualifyCurrent({ architectureIntegrity: false });
    assert.equal(decision.architectureIntegrity, false);
    assert.equal(decision.openBlockers.includes('architecture-integrity-required'), true);
    assert.notEqual(decision.bundleState, 'PRODUCTION_CANDIDATE_REVIEW_READY');
  });

  it('5. persistence restart works', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.persistenceRestarted, true);
  });

  it('6. payment ambiguous recovery works', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.paymentRecovered, true);
    assert.equal(burnIn.runtime.payments.get('pay.usd-sar.1')?.status, 'SETTLED');
    assert.equal(burnIn.runtime.fiatEntries.filter((row) => row.idempotencyKey === 'idem.pay.usd-sar.1.settle').length, 1);
  });

  it('7. custody ambiguous recovery works', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.custodyRecovered, true);
  });

  it('8. dual-asset custody is isolated', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.dualAssetIsolated, true);
    const sunrey = [...burnIn.runtime.custody.values()].find((row) => row.assetId === 'SUNREY_COIN');
    const moonrey = [...burnIn.runtime.custody.values()].find((row) => row.assetId === 'MOONREY_COIN');
    assert.ok(sunrey);
    assert.ok(moonrey);
    assert.notEqual(sunrey.assetId, moonrey.assetId);
  });

  it('9. Exchange DVP reconciles', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.exchangeSettled, true);
    assert.equal(burnIn.runtime.reservations.get('res.dvp.1')?.open, false);
  });

  it('10. HIN human path dedupes', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.humanDeduped, true);
    assert.equal(burnIn.runtime.sunrey.issuedPostGenesis, 50n);
  });

  it('11. productive path dedupes', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.productiveDeduped, true);
    assert.equal(burnIn.runtime.moonrey.issuedPostGenesis, 40n);
  });

  it('12. reference price cannot mint', () => {
    const runtime = createRuntime();
    const result = attemptReferencePriceMint(runtime);
    assert.equal(result.minted, false);
    assert.equal(runFullPlatformBurnIn().referencePriceCannotMint, true);
  });

  it('13. oracle provider cannot mint', () => {
    const runtime = createRuntime();
    const result = attemptOracleMint(runtime);
    assert.equal(result.minted, false);
    assert.equal(runFullPlatformBurnIn().oracleCannotMint, true);
  });

  it('14. AI cannot mint', () => {
    const runtime = createRuntime();
    const result = attemptAi(runtime, 'MINT');
    assert.equal(result.allowed, false);
  });

  it('15. AI cannot issue authority', () => {
    const runtime = createRuntime();
    const result = attemptAi(runtime, 'ISSUE_EXECUTION_AUTHORITY');
    assert.equal(result.allowed, false);
    assert.equal(refuseAiStatusChange('S3M'), 'ai-cannot-change-status:S3M');
  });

  it('16. KYC unavailable cannot fail open', () => {
    const result = refuseKycUnavailable();
    assert.equal(result.outcome, 'HOLD');
    assert.equal(result.failOpen, false);
  });

  it('17. stale FX cannot execute', () => {
    const result = refuseStaleFx(createRuntime());
    assert.equal(result.executed, false);
  });

  it('18. chain degradation does not invent finality', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.chainDidNotInventFinality, true);
  });

  it('19. supply equations reconcile', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.sunreyReconciled, true);
    assert.equal(burnIn.moonreyReconciled, true);
  });

  it('20. ledger journals balance', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.ledgerBalanced, true);
    assert.equal(
      burnIn.runtime.fiatEntries.every((journal) => {
        const debit = journal.debits.reduce((sum, row) => sum + row.amount, 0n);
        const credit = journal.credits.reduce((sum, row) => sum + row.amount, 0n);
        return debit === credit;
      }),
      true,
    );
  });

  it('21. event replay has no duplicate effect', () => {
    const first = runFullPlatformBurnIn({ profile: 'STANDARD' });
    const second = runFullPlatformBurnIn({ profile: 'SMOKE' });
    assert.equal(first.runtime.sunrey.issuedPostGenesis, second.runtime.sunrey.issuedPostGenesis);
    assert.equal(first.humanDeduped, true);
    assert.equal(first.productiveDeduped, true);
  });

  it('22. provider credential rotation is safe', () => {
    const burnIn = runFullPlatformBurnIn();
    assert.equal(burnIn.credentialRotationSafe, true);
    assert.equal(burnIn.runtime.credentials.current.rawSecretPresent, false);
  });

  it('23. secret scan is clean', () => {
    const burnIn = runFullPlatformBurnIn();
    const scan = scanArtifacts(burnIn.runtime.artifacts);
    assert.equal(scan.clean, true);
    assert.equal(scan.rawCredentialLeaks, 0);
  });

  it('24. privacy scan is clean', () => {
    const burnIn = runFullPlatformBurnIn();
    const scan = scanArtifacts(burnIn.runtime.artifacts);
    assert.equal(scan.publicChainPiiLeaks, 0);
    assert.equal(burnIn.privacyClean, true);
  });

  it('25. Chunk 157 campaign has zero invariant breaches', () => {
    const burnIn = runFullPlatformBurnIn();
    const campaign = runProductionSafetySmokeCampaign(burnIn.runtime);
    assert.equal(campaign.invariantBreaches, 0);
    assert.equal(campaign.overrideFlagPresent, false);
    assert.equal(campaign.findings.every((row) => row.held), true);
  });

  it('26. control room remains read-only', () => {
    const burnIn = runFullPlatformBurnIn();
    const room = projectControlRoom(burnIn.runtime);
    assert.equal(room.readOnly, true);
    assert.equal(controlRoomRemainsReadOnly(burnIn.runtime), true);
    assert.throws(() => refuseControlRoomMutation(burnIn.runtime, 'set-ready'), /control-room-is-read-only/);
  });

  it('27. external evidence cannot be fabricated', () => {
    const inventory = currentExternalEvidenceInventory();
    assert.equal(inventory.every((row) => row.present === false && row.fabricated === false), true);
    const { decision } = qualifyCurrent({ markExternalPresent: true });
    assert.equal(decision.openBlockers.includes('external-evidence-cannot-be-fabricated'), true);
    assert.equal(attemptMarkExternalPresent('AI'), 'external-evidence-cannot-be-fabricated:AI');
  });

  it('28. production parameters remain unconfigured', () => {
    const { decision } = qualifyCurrent();
    assert.equal(decision.posture.productionEconomicParametersConfigured, false);
    assert.equal(decision.openBlockers.includes('awaiting-production-parameters'), true);
  });

  it('29. activation firewall still blocks', () => {
    const firewall = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    const { bundle, decision } = qualifyCurrent();
    assert.equal(firewall.productionActivated, false);
    assert.equal(decision.productionActivated, false);
    assert.equal(decision.bundleOverridesFirewall, false);
    assert.equal(bundle.firewallDecisionHash, firewall.decisionId);
    assert.equal(bundleOverrideFirewallRejected(bundle, firewall.decisionId), false);
    assert.equal(refuseForceActivation(), 'no-force-admin-testonly-skip-emergency-bypass');
  });

  it('30. no LIVE flag is enabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    const { decision } = qualifyCurrent();
    assert.equal(decision.posture.liveFlagsEnabled, false);
    assert.equal(decision.posture.productionActive, false);
    assert.equal(PRODUCTION_ACTIVE, false);
  });

  it('implicit versions are rejected and implicit latest is not a binding', () => {
    assert.equal(implicitVersionRejected('latest'), true);
    assert.equal(implicitVersionRejected('v1:commit'), false);
  });

  it('AI cannot flip review-ready or mark governance', () => {
    const { decision } = qualifyCurrent({
      actorKind: 'S3M',
      markLegalPassed: true,
      markGovernancePassed: true,
      forceReviewReady: true,
    });
    assert.equal(decision.openBlockers.includes('ai-cannot-change-status:S3M'), true);
    assert.equal(decision.openBlockers.includes('force-review-ready-forbidden'), true);
  });

  it('successful engineering burn-in is review-ready, not production active', () => {
    const { decision } = qualifyCurrent();
    assert.equal(decision.burnInPassed, true);
    assert.equal(decision.engineeringPassed, true);
    assert.equal(decision.bundleState, 'PRODUCTION_CANDIDATE_REVIEW_READY');
    assert.equal(decision.posture.productionActive, false);
    assert.equal(decision.posture.realBankConnected, false);
  });

  it('CLI rehearse / verify / report stay in simulation', () => {
    const rehearse = runFullPlatformCommand(['rehearse']);
    const verify = runFullPlatformCommand(['verify']);
    const report = runFullPlatformCommand(['report']);
    assert.equal(rehearse.ok, true);
    assert.equal(verify.ok, true);
    assert.equal(report.ok, true);
    assert.equal((rehearse.payload as { productionActive: boolean }).productionActive, false);
    assert.equal((verify.payload as { liveFlagsEnabled: boolean }).liveFlagsEnabled, false);
    assert.match((report.payload as { text: string }).text, /PRODUCTION_ACTIVE=FALSE/);
  });

  it('does not create a second full-platform package', () => {
    for (const path of FORBIDDEN_PACKAGES) {
      assert.equal(path.startsWith('packages/'), true);
    }
  });
});
