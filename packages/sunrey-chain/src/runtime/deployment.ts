export const NODE_TYPES = ['VALIDATOR', 'SENTRY', 'RPC', 'EXPLORER_BACKEND', 'MONITORING'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export type DeploymentProfile = {
  readonly nodeType: NodeType;
  readonly networkEnvironment: 'TESTNET';
  readonly mainnetDeployed: false;
  readonly configPath: string;
};

export const TESTNET_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = [
  {
    nodeType: 'VALIDATOR',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/validators.yaml',
  },
  {
    nodeType: 'SENTRY',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/sentry.yaml',
  },
  {
    nodeType: 'RPC',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/seed-rpc.yaml',
  },
  {
    nodeType: 'EXPLORER_BACKEND',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/faucet-explorer.yaml',
  },
  {
    nodeType: 'MONITORING',
    networkEnvironment: 'TESTNET',
    mainnetDeployed: false,
    configPath: 'deploy/sunrey-testnet/k8s/monitoring.yaml',
  },
];

export const INFRA_PRODUCTION_CANDIDATE_ROOT = 'infra/sunrey-production';
export const TESTNET_DEPLOY_ROOT = 'deploy/sunrey-testnet';
