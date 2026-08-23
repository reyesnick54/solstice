/**
 * Production-image hardening baseline. Inspects declared Dockerfile
 * properties. Does not bake secrets.
 */

export const CONTAINER_HARDENING_BASELINE = Object.freeze({
  preferMinimalBase: true,
  nonRoot: true,
  readOnlyFilesystemWhereFeasible: true,
  dropUnnecessaryCapabilities: true,
  pinDependenciesAndImages: true,
  healthChecks: true,
  noBakedSecrets: true,
  distrolessPreferred: true,
});

export type ContainerImageReview = {
  readonly imageId: string;
  readonly dockerfile: string;
  readonly nonRoot: boolean;
  readonly healthcheck: boolean;
  readonly simulationLabel: boolean;
  readonly bakedSecret: false;
  readonly digestPinnedInRelease: boolean;
};

export const REVIEWED_IMAGES: readonly ContainerImageReview[] = Object.freeze([
  {
    imageId: 'sunrey-node',
    dockerfile: 'deploy/sunrey-testnet/docker/sunrey-node.Dockerfile',
    nonRoot: true,
    healthcheck: true,
    simulationLabel: true,
    bakedSecret: false,
    digestPinnedInRelease: true,
  },
  {
    imageId: 'sunrey-rpc',
    dockerfile: 'deploy/sunrey-testnet/docker/sunrey-rpc.Dockerfile',
    nonRoot: true,
    healthcheck: true,
    simulationLabel: true,
    bakedSecret: false,
    digestPinnedInRelease: true,
  },
  {
    imageId: 'sunrey-explorer',
    dockerfile: 'deploy/sunrey-testnet/docker/sunrey-explorer.Dockerfile',
    nonRoot: true,
    healthcheck: true,
    simulationLabel: true,
    bakedSecret: false,
    digestPinnedInRelease: true,
  },
  {
    imageId: 'sunrey-relayer',
    dockerfile: 'deploy/sunrey-testnet/docker/sunrey-relayer.Dockerfile',
    nonRoot: true,
    healthcheck: true,
    simulationLabel: true,
    bakedSecret: false,
    digestPinnedInRelease: true,
  },
  {
    imageId: 'sunrey-faucet',
    dockerfile: 'deploy/sunrey-testnet/docker/sunrey-faucet.Dockerfile',
    nonRoot: true,
    healthcheck: true,
    simulationLabel: true,
    bakedSecret: false,
    digestPinnedInRelease: true,
  },
]);
