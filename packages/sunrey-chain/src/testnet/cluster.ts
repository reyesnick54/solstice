/**
 * Local multi-process / Kubernetes testnet profile.
 *
 * kind/k3d manifests live under deploy/sunrey-testnet. This module
 * simulates a realistic multi-process profile when a cluster runtime
 * is not available.
 */

import { TestnetNetwork, runFullTestnetE2e } from './network.ts';
import { explorerProfile, faucetProfile, publicRpcProfile, seedProfile, validatorProfile } from './profiles.ts';
import { verifyTestnet } from './verify.ts';

export type LocalClusterReport = {
  readonly mode: 'IN_PROCESS_SIMULATION' | 'KIND';
  readonly validators: number;
  readonly seeds: number;
  readonly rpc: number;
  readonly faucet: number;
  readonly explorer: number;
  readonly e2eOk: boolean;
  readonly verifyOk: boolean;
  readonly genesisHash: string;
};

export function launchLocalClusterSimulation(): LocalClusterReport {
  const net = new TestnetNetwork();
  net.launch();
  const e2e = runFullTestnetE2e();
  const verify = verifyTestnet(net);
  const profiles = [
    validatorProfile(),
    seedProfile(),
    publicRpcProfile(),
    faucetProfile(),
    explorerProfile(),
  ];
  if (profiles.some((row) => row.role === 'VALIDATOR' && !row.votes)) {
    throw new Error('validator profile must vote');
  }
  return {
    mode: 'IN_PROCESS_SIMULATION',
    validators: 7,
    seeds: 2,
    rpc: 1,
    faucet: 1,
    explorer: 1,
    e2eOk: e2e.ok,
    verifyOk: verify.ok,
    genesisHash: e2e.genesisHash,
  };
}

export const KIND_CLUSTER_NAME = 'sunrey-testnet-1';
export const HELM_CHART_PATH = 'deploy/sunrey-testnet/helm/sunrey-testnet';
export const K8S_MANIFEST_DIR = 'deploy/sunrey-testnet/k8s';
