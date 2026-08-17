/**
 * Environment layers, signed configuration bundles, and validation.
 * PRODUCTION_CANDIDATE does not imply active mainnet.
 */

import {
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import { digestJson, infraSha256 } from './hash.ts';
import type { ContainerImageReference } from './services.ts';
import { requireImmutableDigest } from './services.ts';
import {
  infraErr,
  infraOk,
  type HsmReadinessState,
  type InfraEnvironment,
  type InfraResult,
} from './types.ts';

export const PRODUCTION_CANDIDATE_DOES_NOT_ACTIVATE_MAINNET = true as const;

export type InfrastructureModule = {
  readonly moduleId: string;
  readonly kind: 'OPENTOFU' | 'HELM';
  readonly path: string;
  readonly providerNeutral: true;
};

export const IAC_MODULES: readonly InfrastructureModule[] = Object.freeze([
  { moduleId: 'network', kind: 'OPENTOFU', path: 'infra/sunrey-production/modules/network', providerNeutral: true },
  { moduleId: 'identity', kind: 'OPENTOFU', path: 'infra/sunrey-production/modules/identity', providerNeutral: true },
  { moduleId: 'secrets', kind: 'OPENTOFU', path: 'infra/sunrey-production/modules/secrets', providerNeutral: true },
  { moduleId: 'storage', kind: 'OPENTOFU', path: 'infra/sunrey-production/modules/storage', providerNeutral: true },
  { moduleId: 'compute', kind: 'OPENTOFU', path: 'infra/sunrey-production/modules/compute', providerNeutral: true },
  { moduleId: 'helm-candidate', kind: 'HELM', path: 'infra/sunrey-production/helm/sunrey-production-candidate', providerNeutral: true },
]);

export type SignedInfrastructureBundle = {
  readonly bundleId: string;
  readonly environment: InfraEnvironment;
  readonly protocolVersion: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly releaseArtifactDigest: string;
  readonly providerConfigurationHash: string;
  readonly configurationHash: string;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
};

export type ConfigurationValidationInput = {
  readonly environment: InfraEnvironment;
  readonly networkId: string;
  readonly chainId: string;
  readonly releaseArtifactDigest: string;
  readonly floatingRelease: boolean;
  readonly secretEnvironment: InfraEnvironment;
  readonly fixtureSecret: boolean;
  readonly publicSignerExposure: boolean;
  readonly publicValidatorAdminExposure: boolean;
  readonly hsmReadiness: HsmReadinessState;
  readonly hsmMarkedVerified: boolean;
  readonly container: ContainerImageReference;
};

export function hashConfigurationBundle(input: Omit<SignedInfrastructureBundle, 'configurationHash' | 'mainnetEnabled' | 'productionActivated'>): SignedInfrastructureBundle {
  const configurationHash = digestJson({
    bundleId: input.bundleId,
    environment: input.environment,
    protocolVersion: input.protocolVersion,
    networkId: input.networkId,
    chainId: input.chainId,
    releaseArtifactDigest: input.releaseArtifactDigest,
    providerConfigurationHash: input.providerConfigurationHash,
  });
  return Object.freeze({
    ...input,
    configurationHash,
    mainnetEnabled: false,
    productionActivated: false,
  });
}

export function validateProductionCandidateConfig(input: ConfigurationValidationInput): InfraResult<true> {
  if (input.environment === 'PRODUCTION_CANDIDATE') {
    if (input.secretEnvironment === 'TESTNET') {
      return infraErr('TESTNET_KEY_REJECTED', 'testnet key reference in production candidate');
    }
    if (input.secretEnvironment === 'LOCAL' || input.fixtureSecret) {
      return infraErr('FIXTURE_REJECTED', 'local fixture secret rejected in production candidate');
    }
    if (input.networkId !== PRODUCTION_CANDIDATE_NETWORK_ID) {
      return infraErr('WRONG_NETWORK_ID', `wrong network ID ${input.networkId}`);
    }
    if (input.chainId !== PRODUCTION_CANDIDATE_CHAIN_ID) {
      return infraErr('WRONG_CHAIN_ID', `wrong chain ID ${input.chainId}`);
    }
  }
  if (input.floatingRelease || !/^[0-9a-f]{64}$/.test(input.releaseArtifactDigest)) {
    return infraErr('FLOATING_RELEASE', 'floating release artifact cannot satisfy production verification');
  }
  const image = requireImmutableDigest(input.container);
  if (!image.ok) {
    return image;
  }
  if (input.publicSignerExposure) {
    return infraErr('PUBLIC_SIGNER_EXPOSURE', 'public signer exposure is forbidden');
  }
  if (input.publicValidatorAdminExposure) {
    return infraErr('PUBLIC_VALIDATOR_ADMIN', 'public validator admin exposure is forbidden');
  }
  if (input.hsmMarkedVerified && input.hsmReadiness !== 'EXTERNAL_HSM_VERIFIED') {
    return infraErr('HSM_UNVERIFIED', 'unverified HSM cannot be marked verified');
  }
  return infraOk(true);
}

export function iacModuleDigest(): string {
  return infraSha256(IAC_MODULES.map((row) => `${row.moduleId}:${row.kind}:${row.path}`).join('|'));
}
