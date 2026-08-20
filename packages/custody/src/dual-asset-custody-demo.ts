import { LIVE_CRYPTO_ENABLED } from '../../config/src/flags.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../security/src/crypto-suite.ts';
import { createDevelopmentHsmSimulator } from '../../security/src/hsm-simulator.ts';
import { InMemoryCustomerAssetPort } from './asset-adapter.ts';
import {
  admitProviderDeposit,
  aiApproveWithdrawal,
  aiSignTransaction,
  asProviderOperationalBalance,
  assertNoRealCustodyCall,
  bindHumanApproval,
  createCandidateWallet,
  createWithdrawalSubmission,
  fixtureCustodyProviderProfile,
  fixtureHsmAttestation,
  FixtureCustodyTransport,
  FIXTURE_CUSTODY_HMAC_SECRET,
  generateNonExportableCustodyKey,
  hashCandidatePreview,
  rejectPrivateKeyExport,
  signFixtureCallback,
  submitWithdrawal,
  validateCustodyProviderCandidateProfile,
} from './provider-candidate/index.ts';

const SUNREY = 'SUNREY_COIN' as const;
const MOONREY = 'MOONREY_COIN' as const;

export function runDualAssetCustodyProviderCandidateDemo(): void {
  const assets = new InMemoryCustomerAssetPort();
  const owner = 'custody-owner-153';
  assets.seed(owner, AssetQuantity.fromScaledUnits(100n, SUNREY));
  assets.seed(owner, AssetQuantity.fromScaledUnits(200n, MOONREY));
  const sunrey = assets.position(owner, SUNREY);
  const moonrey = assets.position(owner, MOONREY);
  const sunreyHold = assets.placeHold(owner, AssetQuantity.fromScaledUnits(10n, SUNREY));
  const moonreyHold = assets.placeHold(owner, AssetQuantity.fromScaledUnits(20n, MOONREY));
  if (!sunreyHold.ok || !moonreyHold.ok) {
    throw new Error('demo holds failed');
  }
  const cross = assets.debitHeld(moonreyHold.value.holdId, AssetQuantity.fromScaledUnits(1n, SUNREY));

  const profile = validateCustodyProviderCandidateProfile(fixtureCustodyProviderProfile());
  if (!profile.ok) {
    throw new Error(profile.error.message);
  }
  const hsm = createDevelopmentHsmSimulator();
  const handle = generateNonExportableCustodyKey(hsm, SUITE_SUNREY_ED25519_V1);
  if (!handle.ok) {
    throw new Error(handle.error.message);
  }
  const wallet = createCandidateWallet({
    walletId: 'cwal_demo',
    vaultId: 'vault_demo',
    assetId: MOONREY,
    address: 'sr1_demo_moonrey',
    network: 'sunrey-devnet',
    chainId: 'sunrey-dev',
    signerHandle: handle.value.handleId,
    securityTier: 'WARM',
  });
  if (!wallet.ok) {
    throw new Error(wallet.error.message);
  }
  const previewDraft = {
    source: wallet.value.address,
    destination: 'sr1_demo_dest',
    assetId: MOONREY,
    quantity: 5n,
    feeAssetId: MOONREY,
    feeLimit: 0n,
    nonce: 1n,
    networkId: wallet.value.network,
    chainId: wallet.value.chainId,
    canonicalBytes: 'cafef00d',
  };
  const previewHash = hashCandidatePreview(previewDraft);
  const approval = bindHumanApproval(previewHash);
  const transport = new FixtureCustodyTransport();
  assertNoRealCustodyCall(transport);
  createWithdrawalSubmission({
    withdrawalId: 'wd_demo',
    assetId: MOONREY,
    quantity: 5n,
    destination: previewDraft.destination,
  });
  const submitted = submitWithdrawal('wd_demo', transport);
  if (!submitted.ok) {
    throw new Error(submitted.error.message);
  }
  const material = 'deposit:demo';
  admitProviderDeposit({
    callback: {
      callbackId: 'cb_demo',
      kind: 'DEPOSIT',
      assetId: SUNREY,
      quantity: 1n,
      destination: 'sr1_demo_sunrey',
      transactionRef: 'tx_demo',
      material,
      signatureHex: signFixtureCallback(material, FIXTURE_CUSTODY_HMAC_SECRET),
    },
    hmacSecret: FIXTURE_CUSTODY_HMAC_SECRET,
    mapping: { address: 'sr1_demo_sunrey', ownerId: owner, assetId: SUNREY },
    finalizedOnChain: true,
  });
  const providerBalance = asProviderOperationalBalance(SUNREY, 0n);

  console.log(`owner=${owner}`);
  console.log(`sunrey_available=${sunrey.available.scaledUnits}`);
  console.log(`moonrey_available=${moonrey.available.scaledUnits}`);
  console.log(`sunrey_held=${assets.position(owner, SUNREY).held.scaledUnits}`);
  console.log(`moonrey_held=${assets.position(owner, MOONREY).held.scaledUnits}`);
  console.log(`preview_hash=${previewHash}`);
  console.log(`human_approval_bound=${approval.boundPreviewHash === previewHash}`);
  console.log(`fixture_submission_state=${submitted.value.state}`);
  console.log(`SUNREY_POSITION_ISOLATED=${sunrey.available.assetId === SUNREY && sunrey.available.scaledUnits === 100n}`);
  console.log(`MOONREY_POSITION_ISOLATED=${moonrey.available.assetId === MOONREY && moonrey.available.scaledUnits === 200n}`);
  console.log(`CROSS_ASSET_DEBIT_ALLOWED=${cross.ok}`);
  console.log(`RAW_PRIVATE_KEY_EXPOSED=${rejectPrivateKeyExport(handle.value).ok}`);
  console.log(`HSM_KEY_EXPORTABLE=${handle.value.exportable}`);
  console.log(`AI_CAN_SIGN=${aiSignTransaction().ok}`);
  console.log(`AI_CAN_APPROVE_WITHDRAWAL=${aiApproveWithdrawal().ok}`);
  console.log(`CUSTODY_PROVIDER_BALANCE_IS_ASSETSUPPLYBOOK=${providerBalance.isAssetSupplyBook}`);
  console.log(`REAL_CUSTODY_PROVIDER_CONNECTED=${transport.realNetwork}`);
  console.log(`LIVE_CRYPTO_ENABLED=${LIVE_CRYPTO_ENABLED}`);
  console.log(`PRODUCTION_ACTIVE=${profile.value.productionAuthorized}`);
  console.log(`HSM_ATTESTATION_REAL=${fixtureHsmAttestation().realHardwareAttestation}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDualAssetCustodyProviderCandidateDemo();
}
