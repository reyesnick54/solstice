import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_CRYPTO_ENABLED } from '../../config/src/flags.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../security/src/crypto-suite.ts';
import { createDevelopmentHsmSimulator } from '../../security/src/hsm-simulator.ts';
import { emptyBook } from '../../sunrey-chain/src/economics/supply.ts';
import { InMemoryCustomerAssetPort } from './asset-adapter.ts';
import { parseInstitutionalVaultRecord } from './institutional/schema.ts';
import {
  createInstitutionalHarness,
  provisionInstitutionalActor,
} from './institutional/harness.ts';
import {
  admitProviderDeposit,
  admitWithdrawalCallback,
  aiApproveWithdrawal,
  aiSignTransaction,
  applyProviderCompromise,
  asProviderOperationalBalance,
  assertCustodyCannotUseGovernanceKms,
  assertNoRealCustodyCall,
  assertOracleCannotUseCustodyHsm,
  bindCustodyCredential,
  bindFixtureCustodyCredential,
  bindHumanApproval,
  createCandidateWallet,
  createWithdrawalSubmission,
  exposeMpcShare,
  finalizeLocallyWithoutEvidence,
  fixtureCustodyProviderProfile,
  fixtureCustodySecretRef,
  fixtureHsmAttestation,
  FixtureCustodyTransport,
  FixtureMpcCandidatePort,
  FIXTURE_CUSTODY_HMAC_SECRET,
  generateNonExportableCustodyKey,
  hashCandidatePreview,
  historicalVersions,
  markKmsCompromised,
  previewChangedInvalidatesApproval,
  queryBeforeRetry,
  reconcileCustodyCandidate,
  rebindCandidateWalletAsset,
  registerKmsKey,
  rejectPrivateKeyExport,
  resetDepositCallbacks,
  resetKmsKeys,
  resetWithdrawals,
  ScriptedCustodySandboxTransport,
  signFixtureCallback,
  submitWithdrawal,
  validateCustodyProviderCandidateProfile,
  validateHsmKeyProfile,
} from './provider-candidate/index.ts';

const SUNREY = 'SUNREY_COIN' as const;
const MOONREY = 'MOONREY_COIN' as const;

describe('chunk 153 dual-asset custody hardening', () => {
  it('preserves v1 institutional custody replay and rejects silent upgrade', () => {
    const parsed = parseInstitutionalVaultRecord({
      schemaVersion: 1,
      authorizedAssets: ['SUNREY_COIN'],
      vaultId: 'vault_hist',
      custodyType: 'INSTITUTIONAL',
      network: 'sunrey-devnet',
      walletIds: [],
      signingPolicy: { providerKind: 'HSM', requiredSuiteId: 'sunrey-ed25519-v1', purpose: 'WALLET_SIGNING' },
      approvalPolicy: { mode: 'SINGLE_OPERATOR', requiredApprovals: 1, authorizedApproverIds: ['a'], highValueThreshold: 1n },
      velocityPolicy: { maxPerWithdrawal: 1n, dailyLimit: 1n, epochLimit: 1n },
      destinationPolicy: { requireApproved: true, coolingPeriodHeights: 0n, allowNewWithoutReview: false },
      securityTier: 'HOT',
      status: 'ACTIVE',
      providerReference: 'HSM',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal('rejected' in parsed, false);
    if ('rejected' in parsed) {
      throw new Error(parsed.message);
    }
    assert.equal(parsed.schemaVersion, 1);
    assert.deepEqual(parsed.authorizedAssets, ['SUNREY_COIN']);
    const dualAsV1 = parseInstitutionalVaultRecord({
      schemaVersion: 1,
      authorizedAssets: ['SUNREY_COIN', 'MOONREY_COIN'],
    });
    assert.equal('rejected' in dualAsV1, true);
    if ('rejected' in dualAsV1) {
      assert.equal(dualAsV1.code, 'V1_SUNREY_ONLY');
    }
  });

  it('supports v2 SunRey, MoonRey, and concurrent owner holdings', () => {
    const h = createInstitutionalHarness();
    const ops = provisionInstitutionalActor(h, 'actor_dual', 'id_dual', 'cust_dual');
    const vault = h.custody.createVault({
      actorKind: 'HUMAN_OPERATOR',
      custodyType: 'INSTITUTIONAL',
      securityTier: 'HOT',
      approvalMode: 'SINGLE_OPERATOR',
      authorizedApproverIds: [ops.actor.actorId],
      classifications: ['SEGREGATED', 'HOT'],
      authorizedAssets: [SUNREY, MOONREY],
      schemaVersion: 2,
    });
    if (vault.outcome !== 'OK') {
      throw new Error(vault.outcome === 'REJECTED' ? vault.message : String(vault.outcome));
    }
    assert.equal(vault.value.schemaVersion, 2);
    const sunreyWallet = h.custody.createAddress({
      actorKind: 'HUMAN_OPERATOR',
      vaultId: vault.value.vaultId,
      classifications: ['SEGREGATED', 'HOT'],
      assetId: SUNREY,
    });
    const moonreyWallet = h.custody.createAddress({
      actorKind: 'HUMAN_OPERATOR',
      vaultId: vault.value.vaultId,
      classifications: ['SEGREGATED', 'HOT'],
      assetId: MOONREY,
    });
    assert.equal(sunreyWallet.outcome, 'OK');
    assert.equal(moonreyWallet.outcome, 'OK');
    if (sunreyWallet.outcome !== 'OK' || moonreyWallet.outcome !== 'OK') {
      throw new Error('wallets');
    }
    h.custody.fundDevelopment(sunreyWallet.value.address, 100n, SUNREY);
    h.custody.fundDevelopment(moonreyWallet.value.address, 200n, MOONREY);
    const sunreyPos = h.custody.derivedPosition(sunreyWallet.value.walletId);
    const moonreyPos = h.custody.derivedPosition(moonreyWallet.value.walletId);
    assert.equal(sunreyPos?.assetId, SUNREY);
    assert.equal(sunreyPos?.onChain, 100n);
    assert.equal(sunreyPos?.notALedgerBalance, true);
    assert.equal(moonreyPos?.assetId, MOONREY);
    assert.equal(moonreyPos?.onChain, 200n);
    const rebound = h.custody.rebindWalletAsset();
    assert.equal(rebound.outcome, 'REJECTED');
    assert.equal(rebound.code, 'ASSET_IMMUTABLE');
  });

  it('isolates consumer credits, holds, and rejects cross-asset debit without lastAssetId', () => {
    const assets = new InMemoryCustomerAssetPort();
    const owner = 'owner_dual';
    assets.seed(owner, AssetQuantity.fromScaledUnits(100n, SUNREY));
    assets.seed(owner, AssetQuantity.fromScaledUnits(200n, MOONREY));
    assert.equal(assets.position(owner, SUNREY).available.scaledUnits, 100n);
    assert.equal(assets.positionForAsset(owner, MOONREY).available.scaledUnits, 200n);
    assert.equal(assets.positionLegacy(owner).error, 'ASSET_IDENTITY_REQUIRED');
    const sunreyHold = assets.placeHold(owner, AssetQuantity.fromScaledUnits(40n, SUNREY));
    const moonreyHold = assets.placeHold(owner, AssetQuantity.fromScaledUnits(50n, MOONREY));
    assert.equal(sunreyHold.ok, true);
    assert.equal(moonreyHold.ok, true);
    if (!sunreyHold.ok || !moonreyHold.ok) {
      throw new Error('holds');
    }
    assert.equal(assets.position(owner, SUNREY).held.scaledUnits, 40n);
    assert.equal(assets.position(owner, MOONREY).held.scaledUnits, 50n);
    const released = assets.releaseHold(sunreyHold.value.holdId);
    assert.equal(released.ok, true);
    const cross = assets.debitHeld(moonreyHold.value.holdId, AssetQuantity.fromScaledUnits(10n, SUNREY));
    assert.equal(cross.ok, false);
    if (!cross.ok) {
      assert.equal(cross.error.code, 'CROSS_ASSET_DEBIT');
    }
    const debit = assets.debitHeld(moonreyHold.value.holdId, AssetQuantity.fromScaledUnits(50n, MOONREY));
    assert.equal(debit.ok, true);
    assert.equal(assets.position(owner, SUNREY).available.scaledUnits, 100n);
    assert.equal(assets.position(owner, MOONREY).available.scaledUnits, 150n);
    assert.equal(assets.position(owner, MOONREY).held.scaledUnits, 0n);
  });

  it('keeps Exchange reservations asset-specific and DVP debit exact', () => {
    const h = createInstitutionalHarness();
    const ops = provisionInstitutionalActor(h, 'actor_x', 'id_x', 'cust_x');
    const vault = h.custody.createVault({
      actorKind: 'HUMAN_OPERATOR',
      custodyType: 'EXCHANGE',
      securityTier: 'HOT',
      approvalMode: 'SINGLE_OPERATOR',
      authorizedApproverIds: [ops.actor.actorId],
      classifications: ['SETTLEMENT'],
      authorizedAssets: [SUNREY, MOONREY],
      schemaVersion: 2,
    });
    if (vault.outcome !== 'OK') {
      throw new Error(vault.outcome === 'REJECTED' ? vault.message : vault.outcome);
    }
    const sunreyWallet = h.custody.createAddress({
      actorKind: 'HUMAN_OPERATOR',
      vaultId: vault.value.vaultId,
      classifications: ['SETTLEMENT'],
      assetId: SUNREY,
    });
    const moonreyWallet = h.custody.createAddress({
      actorKind: 'HUMAN_OPERATOR',
      vaultId: vault.value.vaultId,
      classifications: ['SETTLEMENT'],
      assetId: MOONREY,
    });
    if (sunreyWallet.outcome !== 'OK' || moonreyWallet.outcome !== 'OK') {
      throw new Error('wallets');
    }
    h.custody.fundDevelopment(sunreyWallet.value.address, 80n, SUNREY);
    h.custody.fundDevelopment(moonreyWallet.value.address, 90n, MOONREY);
    const moonreyHold = h.custody.reserveForExchange(vault.value.vaultId, 20n, MOONREY);
    const sunreyHold = h.custody.reserveForExchange(vault.value.vaultId, 10n, SUNREY);
    assert.equal('rejected' in moonreyHold, false);
    assert.equal('rejected' in sunreyHold, false);
    if ('rejected' in moonreyHold || 'rejected' in sunreyHold) {
      throw new Error('reserve');
    }
    assert.equal(moonreyHold.assetId, MOONREY);
    assert.equal(sunreyHold.assetId, SUNREY);
    const crossDebit = h.custody.debitReservation(moonreyHold.reservationId, { assetId: SUNREY, quantity: 20n });
    assert.equal('rejected' in crossDebit, true);
    if ('rejected' in crossDebit) {
      assert.equal(crossDebit.code, 'CROSS_ASSET_DEBIT');
    }
    const dvp = h.custody.debitReservation(moonreyHold.reservationId, { assetId: MOONREY, quantity: 20n });
    assert.equal('rejected' in dvp, false);
    if ('rejected' in dvp) {
      throw new Error('dvp');
    }
    assert.equal(dvp.debited, true);
    assert.equal(dvp.assetId, MOONREY);
  });

  it('enforces provider-candidate, HSM, credential, approval, and reconciliation invariants', () => {
    resetDepositCallbacks();
    resetWithdrawals();
    resetKmsKeys();
    const profile = validateCustodyProviderCandidateProfile(fixtureCustodyProviderProfile());
    if (!profile.ok) {
      throw new Error('profile');
    }
    assert.equal(profile.value.productionAuthorized, false);
    const binding = bindCustodyCredential({
      bindingId: 'bind_1',
      credentialDescriptorRef: profile.value.credentialDescriptorRef,
      workload: 'custody_worker',
      secretRef: fixtureCustodySecretRef(),
    });
    if (!binding.ok) {
      throw new Error('binding');
    }
    assert.equal(binding.value.rawCredentialPresent, false);
    const plane = bindFixtureCustodyCredential({ bindingId: 'bind_plane' });
    if (!plane.ok) {
      throw new Error('plane');
    }
    assert.equal(plane.value.rawCredentialPresent, false);
    assert.equal(plane.value.grantsExecutionAuthority, false);
    assert.equal(plane.value.providerDomain, 'CUSTODY_PROVIDER');
    const governanceReuse = bindFixtureCustodyCredential({
      bindingId: 'bind_gov',
      workload: 'governance_kms',
    });
    assert.equal(governanceReuse.ok, false);
    if (governanceReuse.ok) {
      throw new Error('governance reuse');
    }
    assert.equal(governanceReuse.error.code, 'CREDENTIAL_WORKLOAD_MISMATCH');
    const oracleReuse = bindFixtureCustodyCredential({
      bindingId: 'bind_oracle',
      providerDomain: 'ORACLE_DATA_SOURCE',
    });
    assert.equal(oracleReuse.ok, false);
    if (oracleReuse.ok) {
      throw new Error('oracle reuse');
    }
    assert.equal(oracleReuse.error.code, 'CREDENTIAL_DOMAIN_MISMATCH');
    const hsm = createDevelopmentHsmSimulator();
    const handle = generateNonExportableCustodyKey(hsm, SUITE_SUNREY_ED25519_V1);
    if (!handle.ok) {
      throw new Error('handle');
    }
    assert.equal(handle.value.exportable, false);
    assert.equal(rejectPrivateKeyExport(handle.value).ok, false);
    assert.equal(typeof (hsm as { extractPrivateKey?: unknown }).extractPrivateKey, 'undefined');
    assert.equal(assertOracleCannotUseCustodyHsm().ok, false);
    assert.equal(assertCustodyCannotUseGovernanceKms().ok, false);
    const exportable = validateHsmKeyProfile({
      origin: 'GENERATE_IN_HSM',
      exportable: false,
      attestationClass: 'SOFTWARE_FIXTURE',
      hardwareAttestationAccepted: true,
    });
    assert.equal(exportable.ok, false);
    assert.equal(fixtureHsmAttestation().realHardwareAttestation, false);

    const previewBase = {
      source: 'sr1_src',
      destination: 'sr1_dst',
      assetId: SUNREY,
      quantity: 5n,
      feeAssetId: SUNREY,
      feeLimit: 1n,
      nonce: 1n,
      networkId: 'sunrey-devnet',
      chainId: 'sunrey-dev',
      canonicalBytes: '00ab',
    };
    const previewHash = hashCandidatePreview(previewBase);
    const preview = { ...previewBase, previewId: 'prv_1', previewHash };
    const approval = bindHumanApproval(previewHash);
    assert.equal(approval.boundPreviewHash, previewHash);
    const changed = { ...preview, quantity: 6n, previewHash: hashCandidatePreview({ ...previewBase, quantity: 6n }) };
    assert.equal(previewChangedInvalidatesApproval(preview, changed), true);
    assert.equal(aiApproveWithdrawal().ok, false);
    assert.equal(aiSignTransaction().ok, false);
    assert.equal(exposeMpcShare().ok, false);
    const mpc = new FixtureMpcCandidatePort();
    const signed = mpc.requestSignature({
      requestRef: 'mpc_1',
      previewHash,
      quorumRequired: 2,
      publicDescriptor: 'pk',
    });
    assert.equal(signed.ok, true);
    if (signed.ok) {
      assert.equal(signed.value.rawSharePresent, false);
    }

    registerKmsKey('key_1');
    const compromised = applyProviderCompromise({ keyId: 'key_1', binding: binding.value });
    assert.equal(compromised.ok, true);
    if (compromised.ok) {
      assert.equal(compromised.value.signingDisabled, true);
      assert.equal(compromised.value.historyRewritten, false);
      assert.equal(compromised.value.autoTransferredCustomerFunds, false);
    }
    assert.equal(historicalVersions('key_1').some((row) => row.lifecycle === 'COMPROMISED'), true);
    assert.equal(markKmsCompromised('key_1').ok, true);

    const wallet = createCandidateWallet({
      walletId: 'cwal_1',
      vaultId: 'vault_1',
      assetId: MOONREY,
      address: 'sr1_moon',
      network: 'sunrey-devnet',
      chainId: 'sunrey-dev',
      signerHandle: handle.value.handleId,
      securityTier: 'COLD',
    });
    assert.equal(wallet.ok, true);
    assert.equal(rebindCandidateWalletAsset('cwal_1', SUNREY).ok, false);

    const material = 'deposit:tx1';
    const callback = {
      callbackId: 'cb_1',
      kind: 'DEPOSIT' as const,
      assetId: SUNREY,
      quantity: 10n,
      destination: 'sr1_dest',
      transactionRef: 'tx1',
      signatureHex: signFixtureCallback(material, FIXTURE_CUSTODY_HMAC_SECRET),
      material,
    };
    const admitted = admitProviderDeposit({
      callback,
      hmacSecret: FIXTURE_CUSTODY_HMAC_SECRET,
      mapping: { address: 'sr1_dest', ownerId: 'owner', assetId: SUNREY },
      finalizedOnChain: true,
    });
    assert.equal(admitted.ok, true);
    if (admitted.ok) {
      assert.equal(admitted.value.creditedCustomerBalance, false);
    }
    const duplicate = admitProviderDeposit({
      callback,
      hmacSecret: FIXTURE_CUSTODY_HMAC_SECRET,
      mapping: { address: 'sr1_dest', ownerId: 'owner', assetId: SUNREY },
      finalizedOnChain: true,
    });
    assert.equal(duplicate.ok, false);
    const wrongAsset = admitProviderDeposit({
      callback: {
        ...callback,
        callbackId: 'cb_wrong',
        transactionRef: 'tx_wrong',
        assetId: MOONREY,
        material: 'deposit:wrong',
        signatureHex: signFixtureCallback('deposit:wrong', FIXTURE_CUSTODY_HMAC_SECRET),
      },
      hmacSecret: FIXTURE_CUSTODY_HMAC_SECRET,
      mapping: { address: 'sr1_dest', ownerId: 'owner', assetId: SUNREY },
      finalizedOnChain: true,
    });
    assert.equal(wrongAsset.ok, false);

    const transport = new FixtureCustodyTransport();
    assert.equal(assertNoRealCustodyCall(transport), true);
    createWithdrawalSubmission({
      withdrawalId: 'wd_1',
      assetId: MOONREY,
      quantity: 3n,
      destination: 'sr1_out',
    });
    const unknown = submitWithdrawal('wd_1', transport, { timeoutAfterPossibleBroadcast: true });
    assert.equal(unknown.ok, true);
    if (unknown.ok) {
      assert.equal(unknown.value.state, 'SUBMISSION_UNKNOWN');
    }
    const blindRetry = submitWithdrawal('wd_1', transport);
    assert.equal(blindRetry.ok, false);
    if (!blindRetry.ok) {
      assert.equal(blindRetry.error.code, 'QUERY_BEFORE_RETRY');
    }
    const queried = queryBeforeRetry({
      withdrawalId: 'wd_1',
      transport,
      providerFound: true,
      chainFound: false,
    });
    assert.equal(queried.ok, true);
    assert.equal(admitWithdrawalCallback('wd_cb_1').ok, true);
    assert.equal(admitWithdrawalCallback('wd_cb_1').ok, false);
    assert.equal(finalizeLocallyWithoutEvidence().ok, false);

    const outage = new ScriptedCustodySandboxTransport();
    outage.script('/outage', { ok: false, error: { code: 'PROVIDER_OUTAGE', message: 'sandbox outage' } });
    assert.equal(outage.exchange({ method: 'GET', path: '/outage', body: {} }).ok, false);

    const mismatch = reconcileCustodyCandidate([
      {
        assetId: SUNREY,
        chainQuantity: 100n,
        providerQuantity: 90n,
        internalAttribution: 100n,
        exchangeReserved: 0n,
        pendingWithdrawals: 0n,
      },
    ]);
    assert.equal(mismatch.outcome, 'MISMATCH');
    assert.equal(mismatch.autoCorrectedLedger, false);
    assert.equal(mismatch.autoChangedChainState, false);
    const providerBalance = asProviderOperationalBalance(SUNREY, 90n);
    assert.equal(providerBalance.isAssetSupplyBook, false);
    const supply = emptyBook('SUNREY_COIN', 'constitution.v1');
    assert.notEqual(providerBalance.quantity, supply.circulating);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(profile.value.productionAuthorized, false);
  });
});
