import type { NetworkEnvironment } from './identity.ts';

export const NODE_TYPES = [
  'VALIDATOR',
  'SENTRY',
  'RPC',
  'FULL_NODE',
  'EXPLORER_BACKEND',
  'MONITORING',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export type DeploymentProfile = {
  readonly nodeType: NodeType;
  readonly networkEnvironment: NetworkEnvironment;
  readonly mainnetDeployed: false;
  readonly configPath: string;
  readonly containerImage?: string;
  readonly replicaCount?: number;
};

export const LOCAL_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = Object.freeze([
  {
    nodeType: 'VALIDATOR',
    networkEnvironment: 'LOCAL',
    mainnetDeployed: false,
    configPath: 'scripts/sunrey-validator-devnet.sh',
    replicaCount: 4,
  },
  {
    nodeType: 'FULL_NODE',
    networkEnvironment: 'LOCAL',
    mainnetDeployed: false,
    configPath: 'scripts/sunrey-devnet.sh',
    replicaCount: 3,
  },
]);

export const DEVNET_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = Object.freeze([
  {
    nodeType: 'VALIDATOR',
    networkEnvironment: 'DEVNET',
    mainnetDeployed: false,
    configPath: 'packages/sunrey-chain/node/src/bin/sunrey-validator-devnet.rs',
    replicaCount: 4,
  },
  {
    nodeType: 'FULL_NODE',
    networkEnvironment: 'DEVNET',
    mainnetDeployed: false,
    configPath: 'packages/sunrey-chain/node/src/bin/sunrey-devnet.rs',
    replicaCount: 3,
  },
]);

export const TESTNET_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = Object.freeze([
  {
    nodeType: 'VALIDATOR',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/validators.yaml',
    containerImage: 'sunrey-node:testnet-1',
    replicaCount: 7,
  },
  {
    nodeType: 'SENTRY',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/sentry.yaml',
    containerImage: 'sunrey-node:testnet-1',
  },
  {
    nodeType: 'RPC',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/seed-rpc.yaml',
    containerImage: 'sunrey-rpc:testnet-1',
  },
  {
    nodeType: 'EXPLORER_BACKEND',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/faucet-explorer.yaml',
    containerImage: 'sunrey-explorer:testnet-1',
  },
  {
    nodeType: 'MONITORING',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/monitoring.yaml',
  },
]);

export const STAGING_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = Object.freeze([
  {
    nodeType: 'VALIDATOR',
    networkEnvironment: 'PREPRODUCTION',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-preproduction/README.md',
  },
]);

export const MAINNET_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = Object.freeze([]);

export const DEPLOYMENT_PROFILES_BY_ENVIRONMENT: Readonly<
  Record<NetworkEnvironment, readonly DeploymentProfile[]>
> = Object.freeze({
  LOCAL: LOCAL_DEPLOYMENT_PROFILES,
  DEVNET: DEVNET_DEPLOYMENT_PROFILES,
  TESTNET: TESTNET_DEPLOYMENT_PROFILES,
  PREPRODUCTION: STAGING_DEPLOYMENT_PROFILES,
  MAINNET: MAINNET_DEPLOYMENT_PROFILES,
});

export const INFRA_PRODUCTION_CANDIDATE_ROOT = 'infra/sunrey-production';
export const TESTNET_DEPLOY_ROOT = 'deploy/sunrey-testnet';

export type MultiValidatorDevnetSpec = {
  readonly environment: 'LOCAL' | 'DEVNET';
  readonly validatorCount: number;
  readonly scriptPath: string;
  readonly dataDirEnvVar: string;
  readonly readinessProbePath: string;
};

export const MULTI_VALIDATOR_DEVNET: readonly MultiValidatorDevnetSpec[] = Object.freeze([
  {
    environment: 'LOCAL',
    validatorCount: 3,
    scriptPath: 'scripts/sunrey-devnet.sh',
    dataDirEnvVar: 'SUNREY_DEVNET_DIR',
    readinessProbePath: '/ready',
  },
  {
    environment: 'DEVNET',
    validatorCount: 4,
    scriptPath: 'scripts/sunrey-validator-devnet.sh',
    dataDirEnvVar: 'SUNREY_VALIDATOR_DEVNET_DIR',
    readinessProbePath: '/ready',
  },
]);
