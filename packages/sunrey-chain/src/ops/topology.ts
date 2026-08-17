import { createHash } from 'node:crypto';

import {
  DEVELOPMENT_CHAIN_ID,
  DEVELOPMENT_NETWORK_ID,
  type FailureDomain,
  type SovereignDeploymentCell,
  type ValidatorPlacement,
} from './types.ts';

export const SEVEN_VALIDATOR_PROFILE_ID = 'sunrey.dev.seven_validator.multi_domain.v1' as const;

const TWO_THIRDS_PLUS_DENOMINATOR = 3n;

export function twoThirdsPlus(total: bigint): bigint {
  return (total * 2n) / TWO_THIRDS_PLUS_DENOMINATOR + 1n;
}

export function developmentFailureDomains(): readonly FailureDomain[] {
  return Object.freeze([
    { domainId: 'fd_alpha', kind: 'REGION', displayName: 'Simulated region Alpha' },
    { domainId: 'fd_bravo', kind: 'AVAILABILITY_ZONE', displayName: 'Simulated zone Bravo' },
    { domainId: 'fd_charlie', kind: 'DATA_CENTER', displayName: 'Simulated data center Charlie' },
  ]);
}

export function sevenValidatorPlacements(): readonly ValidatorPlacement[] {
  return Object.freeze([
    { validatorId: 'val_dev_1', domainId: 'fd_alpha', votingPower: 1n, signerTrustZone: 'zone_alpha_signer' },
    { validatorId: 'val_dev_2', domainId: 'fd_alpha', votingPower: 1n, signerTrustZone: 'zone_alpha_signer' },
    { validatorId: 'val_dev_3', domainId: 'fd_alpha', votingPower: 1n, signerTrustZone: 'zone_alpha_signer' },
    { validatorId: 'val_dev_4', domainId: 'fd_bravo', votingPower: 1n, signerTrustZone: 'zone_bravo_signer' },
    { validatorId: 'val_dev_5', domainId: 'fd_bravo', votingPower: 1n, signerTrustZone: 'zone_bravo_signer' },
    { validatorId: 'val_dev_6', domainId: 'fd_charlie', votingPower: 1n, signerTrustZone: 'zone_charlie_signer' },
    { validatorId: 'val_dev_7', domainId: 'fd_charlie', votingPower: 1n, signerTrustZone: 'zone_charlie_signer' },
  ]);
}

export function sovereignCells(): readonly SovereignDeploymentCell[] {
  return Object.freeze([
    {
      cellId: 'cell_alpha',
      domainId: 'fd_alpha',
      roles: ['RPC', 'INDEXER', 'EXPLORER', 'MONITORING_AGENT', 'SERVICE_DATABASE', 'FAUCET'],
      rpcInstances: ['rpc_alpha_a', 'rpc_alpha_b'],
      indexerInstances: ['idx_alpha'],
      explorerInstances: ['exp_alpha'],
      relayInstances: [],
      monitoringAgents: ['mon_alpha'],
      serviceDatabases: ['pg_alpha'],
    },
    {
      cellId: 'cell_bravo',
      domainId: 'fd_bravo',
      roles: ['RPC', 'INDEXER', 'EXPLORER', 'RELAY', 'MONITORING_AGENT', 'SERVICE_DATABASE'],
      rpcInstances: ['rpc_bravo_a'],
      indexerInstances: ['idx_bravo'],
      explorerInstances: ['exp_bravo'],
      relayInstances: ['relayer_bravo', 'relayer_bravo_b'],
      monitoringAgents: ['mon_bravo'],
      serviceDatabases: ['pg_bravo'],
    },
    {
      cellId: 'cell_charlie',
      domainId: 'fd_charlie',
      roles: ['RPC', 'RELAY', 'MONITORING_AGENT'],
      rpcInstances: ['rpc_charlie_a'],
      indexerInstances: [],
      explorerInstances: [],
      relayInstances: ['relayer_charlie'],
      monitoringAgents: ['mon_charlie'],
      serviceDatabases: [],
    },
  ]);
}

export type VotingPowerConcentration = {
  readonly totalPower: bigint;
  readonly finalizeThreshold: bigint;
  readonly byDomain: Readonly<Record<string, bigint>>;
  readonly independentFinalityDomains: readonly string[];
  readonly valid: boolean;
};

export function analyzeVotingPower(
  placements: readonly ValidatorPlacement[] = sevenValidatorPlacements(),
): VotingPowerConcentration {
  const byDomain: Record<string, bigint> = {};
  let total = 0n;
  for (const row of placements) {
    total += row.votingPower;
    byDomain[row.domainId] = (byDomain[row.domainId] ?? 0n) + row.votingPower;
  }
  const threshold = twoThirdsPlus(total);
  const independent = Object.entries(byDomain)
    .filter(([, power]) => power >= threshold)
    .map(([domainId]) => domainId);
  return Object.freeze({
    totalPower: total,
    finalizeThreshold: threshold,
    byDomain: Object.freeze({ ...byDomain }),
    independentFinalityDomains: Object.freeze(independent),
    valid: independent.length === 0 && Object.keys(byDomain).length >= 3,
  });
}

export function assertNoIndependentFinality(placements?: readonly ValidatorPlacement[]): void {
  const analysis = analyzeVotingPower(placements);
  if (!analysis.valid) {
    throw new Error('voting-power concentration allows a single failure domain to finalize');
  }
}

export type DevelopmentMultiDomainProfile = {
  readonly profileId: typeof SEVEN_VALIDATOR_PROFILE_ID;
  readonly chainId: typeof DEVELOPMENT_CHAIN_ID;
  readonly networkId: typeof DEVELOPMENT_NETWORK_ID;
  readonly domains: readonly FailureDomain[];
  readonly validators: readonly ValidatorPlacement[];
  readonly cells: readonly SovereignDeploymentCell[];
  readonly votingPower: VotingPowerConcentration;
  readonly topologyHash: string;
};

export function developmentMultiDomainProfile(): DevelopmentMultiDomainProfile {
  const validators = sevenValidatorPlacements();
  assertNoIndependentFinality(validators);
  const domains = developmentFailureDomains();
  const cells = sovereignCells();
  const votingPower = analyzeVotingPower(validators);
  const topologyHash = createHash('sha256')
    .update(
      JSON.stringify({
        profileId: SEVEN_VALIDATOR_PROFILE_ID,
        chainId: DEVELOPMENT_CHAIN_ID,
        validators: validators.map((row) => ({
          ...row,
          votingPower: row.votingPower.toString(),
        })),
        cells,
      }),
    )
    .digest('hex');
  return Object.freeze({
    profileId: SEVEN_VALIDATOR_PROFILE_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    networkId: DEVELOPMENT_NETWORK_ID,
    domains,
    validators,
    cells,
    votingPower,
    topologyHash,
  });
}
