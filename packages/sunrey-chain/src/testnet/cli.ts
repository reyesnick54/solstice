/**
 * Operator CLI: sunrey-genesis / sunrey-testnet verify / bootstrap.
 */

import { buildCeremonyArtifact } from './ceremony.ts';
import { launchLocalClusterSimulation } from './cluster.ts';
import { buildGenesis, fixtureGenesisHash, GENESIS_TOOL_VERSION } from './genesis.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from './identity.ts';
import { TestnetNetwork, runFullTestnetE2e } from './network.ts';
import { buildCycloneDxSbom, buildReleaseManifest, localTestSigningProvider } from './release.ts';
import { planNetworkReset } from './reset.ts';
import { verifyTestnet } from './verify.ts';

export type CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function runTestnetCommand(argv: readonly string[]): CliResult {
  const [command = 'help', sub = ''] = argv;
  if (command === 'genesis' || command === 'sunrey-genesis') {
    const bundle = buildGenesis();
    return {
      ok: true,
      command: 'genesis',
      payload: {
        tool: GENESIS_TOOL_VERSION,
        networkId: bundle.manifest.networkId,
        chainId: bundle.manifest.chainId,
        genesisHash: bundle.genesisHash,
        validatorSetHash: bundle.validatorSetHash,
        validatorCount: bundle.manifest.validatorCount,
        presentation: bundle.manifest.presentation,
      },
    };
  }
  if (command === 'ceremony') {
    const artifact = buildCeremonyArtifact();
    return {
      ok: !artifact.coordinatorCollectedPrivateKeys,
      command: 'ceremony',
      payload: {
        contributions: artifact.contributions.length,
        collectedPrivateKeys: artifact.coordinatorCollectedPrivateKeys,
      },
    };
  }
  if (command === 'verify' || (command === 'sunrey-testnet' && sub === 'verify')) {
    const net = new TestnetNetwork();
    net.launch();
    const report = verifyTestnet(net);
    return { ok: report.ok, command: 'verify', payload: report };
  }
  if (command === 'bootstrap') {
    const cluster = launchLocalClusterSimulation();
    return { ok: cluster.e2eOk && cluster.verifyOk, command: 'bootstrap', payload: cluster };
  }
  if (command === 'e2e') {
    const report = runFullTestnetE2e();
    return { ok: report.ok, command: 'e2e', payload: report };
  }
  if (command === 'reset') {
    const plan = planNetworkReset(SUNREY_TESTNET_1_NETWORK_ID);
    return { ok: plan.ok, command: 'reset', payload: plan };
  }
  if (command === 'release') {
    const manifest = buildReleaseManifest({
      sourceCommit: 'local',
      packageLock: 'lock',
      cargoLock: 'cargo',
      schema: 'schema',
    });
    const sbom = buildCycloneDxSbom([{ name: 'sunrey-testnet', version: '0.1.0', content: fixtureGenesisHash() }]);
    const signer = localTestSigningProvider();
    const signed = signer.sign(Buffer.from(JSON.stringify(manifest)));
    const verified = signer.verify(Buffer.from(JSON.stringify(manifest)), signed.publicKeyHex, signed.signatureHex);
    return { ok: verified, command: 'release', payload: { manifest, sbom, verified } };
  }
  return {
    ok: true,
    command: 'help',
    payload: {
      usage: 'sunrey-testnet <genesis|ceremony|verify|bootstrap|e2e|reset|release>',
      networkId: SUNREY_TESTNET_1_NETWORK_ID,
      chainId: SUNREY_TESTNET_1_CHAIN_ID,
    },
  };
}
