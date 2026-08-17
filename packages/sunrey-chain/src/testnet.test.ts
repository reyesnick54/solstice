import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parseAddress } from './wallet/address.ts';
import { encodeFromPublicKey, publicDescriptorFromSeed, seedFromLabel } from './wallet/index.ts';
import { buildCeremonyArtifact, ceremonyContainsPrivateMaterial } from './testnet/ceremony.ts';
import { launchLocalClusterSimulation } from './testnet/cluster.ts';
import { runTestnetCommand } from './testnet/cli.ts';
import { TestnetExplorer } from './testnet/explorer.ts';
import { TestnetFaucet } from './testnet/faucet.ts';
import {
  buildGenesis,
  encodeGenesisInput,
  fixtureGenesisHash,
  genesisHashOf,
  jsonPresentationIsNotConsensus,
  testnet1GenesisInput,
} from './testnet/genesis.ts';
import {
  SUNREY_TESTNET_1_CHAIN_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  TESTNET_ADDRESS_HRP,
  isForbiddenReusedNetworkId,
} from './testnet/identity.ts';
import { TestnetNetwork, runFullTestnetE2e } from './testnet/network.ts';
import {
  explorerProfile,
  faucetProfile,
  publicBindsAdministrative,
  publicRpcProfile,
  seedProfile,
  validatorProfile,
} from './testnet/profiles.ts';
import { buildCycloneDxSbom, buildReleaseManifest, localTestSigningProvider } from './testnet/release.ts';
import { planNetworkReset, refuseSilentGenesisReplace } from './testnet/reset.ts';
import { sunreyTestnet1SdkConfig } from './testnet/sdk-config.ts';
import {
  assertNoPrivateKeyInConfig,
  explorerMayMutate,
  faucetMayGovern,
  faucetMayValidate,
  fixtureEnvironmentAllowed,
  hostMayHold,
  relayerMayGovern,
  rpcMayAccessValidatorSigner,
  testnetMayEnableProductionBankingRails,
} from './testnet/security.ts';
import { healthOmitsConfidentialTopology } from './testnet/status.ts';
import {
  bftQuorumSatisfied,
  fixtureSecretsRejectedOutsideFixtureEnv,
  sevenValidatorFixture,
  TESTNET_VALIDATOR_COUNT,
} from './testnet/validators.ts';
import { verifyTestnet } from './testnet/verify.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('SunRey public testnet package', () => {
  it('uses a distinct testnet identity and srtst addresses', () => {
    assert.equal(SUNREY_TESTNET_1_NETWORK_ID, 'net_sunrey_testnet_1');
    assert.equal(SUNREY_TESTNET_1_CHAIN_ID, 'chn_sunrey_testnet_1');
    assert.equal(isForbiddenReusedNetworkId('net_sunrey_local_dev'), true);
    assert.equal(isForbiddenReusedNetworkId(SUNREY_TESTNET_1_NETWORK_ID), false);
    const descriptor = publicDescriptorFromSeed('alice', seedFromLabel('alice-testnet'));
    const testnet = encodeFromPublicKey(SUNREY_TESTNET_1_NETWORK_ID, 'SINGLE_KEY_ACCOUNT', descriptor);
    const development = encodeFromPublicKey('net_sunrey_simulation', 'SINGLE_KEY_ACCOUNT', descriptor);
    assert.equal(testnet.text.startsWith(`${TESTNET_ADDRESS_HRP}1`), true);
    assert.equal(development.text.startsWith('srdev1'), true);
    assert.notEqual(testnet.text, development.text);
    const parsed = parseAddress(testnet.text, SUNREY_TESTNET_1_NETWORK_ID);
    assert.equal(parsed.ok, true);
    const wrong = parseAddress(development.text, SUNREY_TESTNET_1_NETWORK_ID);
    assert.equal(wrong.ok, false);
  });

  it('builds a deterministic seven-validator genesis hash', () => {
    const first = buildGenesis();
    const second = buildGenesis(testnet1GenesisInput(sevenValidatorFixture()));
    assert.equal(first.genesisHash, second.genesisHash);
    assert.equal(first.validatorSetHash, second.validatorSetHash);
    assert.equal(first.manifest.validatorCount, TESTNET_VALIDATOR_COUNT);
    assert.equal(first.manifest.tickerStatus, 'NOT_ASSIGNED');
    assert.equal(first.manifest.productionNetworkEnabled, false);
    assert.equal(first.manifest.environment, 'simulation');
    assert.equal(first.manifest.presentation, 'JSON_NOT_CONSENSUS');
    assert.equal(first.manifest.monetaryValue, 'NONE');
    assert.equal(
      jsonPresentationIsNotConsensus(JSON.stringify(first.manifest), first.canonicalBytesHex),
      true,
    );
    const mutated = testnet1GenesisInput();
    const different = genesisHashOf({
      ...mutated,
      genesisTimeUnixMs: mutated.genesisTimeUnixMs + 1n,
    });
    assert.notEqual(different, first.genesisHash);
    assert.equal(fixtureGenesisHash(), first.genesisHash);
    assert.equal(
      first.genesisHash,
      readFileSync(join(ROOT, 'packages/sunrey-chain/fixtures/testnet/genesis-hash.txt'), 'utf8').trim(),
    );
    assert.equal(encodeGenesisInput(mutated).subarray(0, 4).length > 0, true);
  });

  it('records a ceremony of public descriptors only', () => {
    const artifact = buildCeremonyArtifact();
    assert.equal(artifact.contributions.length, 7);
    assert.equal(artifact.coordinatorCollectedPrivateKeys, false);
    assert.equal(ceremonyContainsPrivateMaterial(artifact), false);
    for (const row of artifact.contributions) {
      assert.equal(row.submissionHash.length, 64);
      assert.equal(row.approved, true);
    }
  });

  it('rejects fixture keys outside local/CI environments', () => {
    assert.equal(fixtureEnvironmentAllowed({ SUNREY_FIXTURE_ENV: 'local' }), true);
    assert.equal(fixtureSecretsRejectedOutsideFixtureEnv({ NODE_ENV: 'production', CI: '' }), true);
  });

  it('runs faucet limits, cooldown, and canonical transactions', () => {
    const faucet = new TestnetFaucet();
    const first = faucet.request({
      address: 'alice',
      asset: 'SUNREY_COIN',
      quantity: 100n,
      clientId: 'ip-1',
      nowMs: 1_000,
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.tx.actorId, 'testnet.faucet');
      assert.equal(first.tx.policy, 'sunrey.issuance.testnet_faucet.v1');
    }
    const cooldown = faucet.request({
      address: 'alice',
      asset: 'SUNREY_COIN',
      quantity: 100n,
      clientId: 'ip-1',
      nowMs: 1_100,
    });
    assert.equal(cooldown.ok, false);
    if (!cooldown.ok) {
      assert.equal(cooldown.code, 'COOLDOWN');
    }
    const limit = faucet.request({
      address: 'alice',
      asset: 'SUNREY_COIN',
      quantity: 1_000_000_000n,
      clientId: 'ip-1',
      nowMs: 20_000,
    });
    assert.equal(limit.ok, false);
    assert.equal(faucet.mayGovern, false);
    assert.equal(faucet.mayValidate, false);
    assert.equal(faucet.requestLog().length >= 2, true);
    assert.equal(faucet.balances().sunrey < 1_000_000_000_000n, true);
  });

  it('configures SDK SUNREY_TESTNET_1 without a hard-coded public domain', () => {
    const config = sunreyTestnet1SdkConfig();
    assert.equal(config.name, 'SUNREY_TESTNET_1');
    assert.equal(config.networkId, SUNREY_TESTNET_1_NETWORK_ID);
    assert.equal(config.addressHrp, 'srtst');
    assert.equal(config.rpcUrl, '');
    assert.equal(config.explorerUrl, '');
    assert.equal(config.faucetUrl, '');
    assert.equal(config.productionBankingRails, false);
  });

  it('shows SUNREY TESTNET in Explorer and never production circulation', () => {
    const explorer = new TestnetExplorer(sevenValidatorFixture());
    explorer.indexBlock(3, [
      {
        txId: 'tx1',
        height: 3,
        from: 'faucet',
        to: 'alice',
        asset: 'SUNREY_COIN',
        quantity: '10',
        finalized: true,
        kind: 'FAUCET',
      },
    ]);
    const view = explorer.view();
    assert.equal(view.banner, 'SUNREY TESTNET');
    assert.equal(view.validators.length, 7);
    assert.equal(view.assets.every((asset) => asset.productionCirculation === false), true);
    assert.equal(explorer.mayMutate, false);
  });

  it('continues finality after two validator faults and refuses conflicting partitions', () => {
    const net = new TestnetNetwork();
    net.launch();
    net.setValidatorOnline(net.validators[5]!.validatorId, false);
    net.setValidatorOnline(net.validators[6]!.validatorId, false);
    const fault = net.tryFinalizeEmpty();
    assert.equal(fault.finalized, true);
    assert.equal(bftQuorumSatisfied(5n, 7n), true);
    const left = net.validators.slice(0, 3).map((row) => row.validatorId);
    const right = net.validators.slice(3).map((row) => row.validatorId);
    const partition = net.partitionWithoutQuorum(left, right);
    assert.equal(partition.leftFinalized, false);
    assert.equal(partition.rightFinalized, false);
    assert.equal(partition.conflicting, false);
  });

  it('activates a governed upgrade and identifies an incompatible validator', () => {
    const net = new TestnetNetwork();
    net.launch();
    const upgrade = net.runGovernedUpgrade();
    assert.equal(upgrade.authorized, true);
    assert.equal(upgrade.activated, true);
    assert.equal(upgrade.incompatibleIdentified, true);
    assert.equal(upgrade.networkContinues, true);
    assert.equal(upgrade.caughtUp, true);
  });

  it('runs the full testnet E2E and verify', () => {
    const e2e = runFullTestnetE2e();
    assert.equal(e2e.ok, true);
    assert.equal(e2e.alice.startsWith('srtst1'), true);
    assert.equal(e2e.bob.startsWith('srtst1'), true);
    assert.equal(e2e.explorerHasTransfer, true);
    assert.equal(e2e.eventFinality, true);
    assert.equal(e2e.moonreyAttributed, true);
    assert.equal(e2e.replicasAgree, true);
    const net = new TestnetNetwork();
    net.launch();
    const report = verifyTestnet(net);
    assert.equal(report.ok, true, JSON.stringify(report.checks.filter((row) => !row.ok)));
    const cluster = launchLocalClusterSimulation();
    assert.equal(cluster.validators, 7);
    assert.equal(cluster.e2eOk, true);
    assert.equal(cluster.verifyOk, true);
  });

  it('enforces security boundaries and reset versioning', () => {
    assert.equal(faucetMayGovern(), false);
    assert.equal(faucetMayValidate(), false);
    assert.equal(explorerMayMutate(), false);
    assert.equal(rpcMayAccessValidatorSigner(), false);
    assert.equal(relayerMayGovern(), false);
    assert.equal(testnetMayEnableProductionBankingRails(), false);
    assert.equal(hostMayHold('PUBLIC_RPC', 'VALIDATOR_VOTING_KEY'), false);
    assert.equal(hostMayHold('VALIDATOR', 'VALIDATOR_VOTING_KEY'), true);
    assert.equal(publicRpcProfile().holdsValidatorKeys, false);
    assert.equal(seedProfile().votes, false);
    assert.equal(validatorProfile().votes, true);
    assert.equal(publicBindsAdministrative(validatorProfile()), false);
    assert.equal(faucetProfile().holdsGovernanceKeys, false);
    const reset = planNetworkReset(SUNREY_TESTNET_1_NETWORK_ID);
    assert.equal(reset.ok, true);
    if (reset.ok) {
      assert.equal(reset.nextNetworkId, 'net_sunrey_testnet_2');
    }
    assert.equal(refuseSilentGenesisReplace(SUNREY_TESTNET_1_NETWORK_ID, SUNREY_TESTNET_1_NETWORK_ID), true);
    assert.throws(() => assertNoPrivateKeyInConfig('"privateKey": "abc"'));
    const health = new TestnetNetwork();
    health.launch();
    assert.equal(healthOmitsConfidentialTopology(health.health()), true);
  });

  it('signs release artifacts and emits CycloneDX SBOM', () => {
    const manifest = buildReleaseManifest({
      sourceCommit: 'deadbeef',
      packageLock: 'lock-a',
      cargoLock: 'lock-b',
      schema: '{"schema":1}',
    });
    assert.equal(manifest.genesisToolVersion, 'sunrey-genesis/1');
    assert.equal(manifest.environment, 'simulation');
    const sbom = buildCycloneDxSbom([{ name: 'sunrey-node', version: '0.1.0', content: 'bin' }]);
    assert.equal(sbom.bomFormat, 'CycloneDX');
    const signer = localTestSigningProvider();
    const message = Buffer.from(JSON.stringify(manifest));
    const signed = signer.sign(message);
    assert.equal(signer.verify(message, signed.publicKeyHex, signed.signatureHex), true);
    const cli = runTestnetCommand(['genesis']);
    assert.equal(cli.ok, true);
  });

  it('ships deployment documentation and orchestration manifests', () => {
    const docs = [
      'docs/testnet/README.md',
      'docs/testnet/genesis-ceremony.md',
      'docs/testnet/network-configuration.md',
      'docs/testnet/faucet.md',
      'docs/testnet/deployment.md',
      'docs/testnet/network-reset.md',
      'docs/testnet/security-boundaries.md',
      'docs/architecture/chunk-53-public-testnet.md',
      'deploy/sunrey-testnet/k8s/namespace.yaml',
      'deploy/sunrey-testnet/helm/sunrey-testnet/Chart.yaml',
      'deploy/sunrey-testnet/docker/sunrey-node.Dockerfile',
    ];
    for (const rel of docs) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const ingress = readFileSync(join(ROOT, 'deploy/sunrey-testnet/k8s/ingress.yaml'), 'utf8');
    assert.equal(ingress.includes('privateKey'), false);
    assert.equal(ingress.includes('tls'), true);
  });
});
