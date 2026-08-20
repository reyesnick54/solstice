import {
  aiApproveWithdrawal,
  aiSignTransaction,
  createCandidateWallet,
  createWithdrawalSubmission,
  fixtureHsmAttestation,
  hashCandidatePreview,
  previewChangedInvalidatesApproval,
  queryBeforeRetry,
  reconcileCustodyCandidate,
  rejectPrivateKeyExport,
  resetCandidateWallets,
  resetWithdrawals,
  rebindCandidateWalletAsset,
  submitWithdrawal,
  validateHsmKeyProfile,
} from '../../../custody/src/provider-candidate/index.ts';
import { FixtureCustodyTransport } from '../../../custody/src/provider-candidate/transport.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../../security/src/crypto-suite.ts';
import { decideRetry } from '../../../payments/src/rail-retry.ts';
import { emptyBook, supplyReconciles } from '../../../sunrey-chain/src/economics/supply.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'CROSS_ASSET_CUSTODY_ISOLATED',
  'PRIVATE_KEY_EXPORT_FORBIDDEN',
  'UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED',
  'AI_CANNOT_EXECUTE',
  'ASSET_SUPPLYBOOK_CANONICAL',
] as const;

export const custodyAttackScenarios: readonly AttackScenario[] = [
  'CUSTADV-MOONREY-AS-SUNREY',
  'CUSTADV-SUNREY-AS-MOONREY',
  'CUSTADV-WRONG-ASSET-CALLBACK',
  'CUSTADV-CHANGED-PREVIEW',
  'CUSTADV-AI-APPROVAL',
  'CUSTADV-AI-SIGNING',
  'CUSTADV-PRIVATE-KEY-EXPORT',
  'CUSTADV-FAKE-HSM-ATTESTATION',
  'CUSTADV-HSM-OUTAGE',
  'CUSTADV-KEY-COMPROMISE',
  'CUSTADV-DUPLICATE-WITHDRAWAL',
  'CUSTADV-PROVIDER-BALANCE-AS-SUPPLY',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15860 + index,
    category: 'CUSTODY_ABUSE',
    subsystem: 'custody-candidate',
    attack: scenarioId.toLowerCase().replace('custadv-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'CUSTODY_ATTACK_BLOCKED',
    recovery: 'CUSTODY_SECURITY_HOLD',
  }),
);

export function runCustodyAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    resetCandidateWallets();
    resetWithdrawals();
    const sunrey = createCandidateWallet({
      walletId: 'wal_sunrey',
      assetId: 'SUNREY_COIN',
      address: 'sr1_range_sunrey',
      vaultId: 'vault_1',
      network: 'net_sunrey_range_dev',
      chainId: 'chn_sunrey_range_dev',
      signerHandle: 'hsm_sunrey',
      securityTier: 'HOT',
    });
    const moonrey = createCandidateWallet({
      walletId: 'wal_moonrey',
      assetId: 'MOONREY_COIN',
      address: 'sr1_range_moonrey',
      vaultId: 'vault_1',
      network: 'net_sunrey_range_dev',
      chainId: 'chn_sunrey_range_dev',
      signerHandle: 'hsm_moonrey',
      securityTier: 'HOT',
    });
    const rebound = sunrey.ok ? rebindCandidateWalletAsset(sunrey.value.walletId, 'MOONREY_COIN') : sunrey;
    const previewA = {
      previewId: 'prev_1',
      source: 'sr1_range_sunrey',
      destination: 'sr1_clear_a',
      assetId: 'SUNREY_COIN' as const,
      quantity: 10n,
      feeAssetId: 'SUNREY_COIN' as const,
      feeLimit: 1n,
      nonce: 1n,
      networkId: 'net_sunrey_range_dev',
      chainId: 'chn_sunrey_range_dev',
      canonicalBytes: 'bytes-a',
      previewHash: '',
    };
    const hash = hashCandidatePreview(previewA);
    const previewBound = { ...previewA, previewHash: hash };
    const changed = previewChangedInvalidatesApproval(previewBound, { ...previewBound, destination: 'sr1_evil', previewHash: 'changed' });
    const exportDenied = rejectPrivateKeyExport({
      handleId: 'hsm_1',
      keyId: 'key_1',
      keyVersion: 1,
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
      exportable: false,
      disabled: false,
      compromised: false,
      providerId: 'simulation-hsm',
      kind: 'HSM',
    });
    const fakeAttest = validateHsmKeyProfile({
      origin: 'GENERATE_IN_HSM',
      exportable: false,
      attestationClass: 'SOFTWARE_FIXTURE',
      hardwareAttestationAccepted: true,
    });
    const attestation = fixtureHsmAttestation();
    const withdrawal = createWithdrawalSubmission({
      withdrawalId: 'wd_range_dup',
      assetId: 'SUNREY_COIN',
      quantity: 5n,
      destination: 'sr1_clear_a',
    });
    const transport = new FixtureCustodyTransport();
    const first = submitWithdrawal(withdrawal.withdrawalId, transport, { timeoutAfterPossibleBroadcast: true });
    const second = submitWithdrawal(withdrawal.withdrawalId, transport);
    const query = queryBeforeRetry({
      withdrawalId: withdrawal.withdrawalId,
      transport,
      providerFound: true,
      chainFound: false,
    });
    const unknown = decideRetry('SUBMIT', null, { executionUnknown: true });
    const recon = reconcileCustodyCandidate([
      {
        assetId: 'SUNREY_COIN',
        chainQuantity: 10n,
        providerQuantity: 99n,
        internalAttribution: 10n,
        exchangeReserved: 0n,
        pendingWithdrawals: 0n,
      },
    ]);
    const book = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
    const blocked =
      sunrey.ok &&
      moonrey.ok &&
      !rebound.ok &&
      changed &&
      !aiApproveWithdrawal().ok &&
      !aiSignTransaction().ok &&
      !exportDenied.ok &&
      !fakeAttest.ok &&
      attestation.realHardwareAttestation === false &&
      first.ok &&
      first.value.state === 'SUBMISSION_UNKNOWN' &&
      !second.ok &&
      query.ok &&
      unknown.allowed === false &&
      recon.providerBalanceIsAssetSupplyBook === false &&
      supplyReconciles(book);
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: scenario.scenarioId === 'CUSTADV-HSM-OUTAGE',
      detail: `${scenario.scenarioId} rebound=${rebound.ok} export=${exportDenied.ok} second=${second.ok} providerIsSupply=${String(recon.providerBalanceIsAssetSupplyBook)}`,
    };
  });
}
