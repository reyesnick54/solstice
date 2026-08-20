import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { createEndpointProfile } from './endpoints.ts';
import { createCandidateProfile } from './profiles.ts';
import { createRequestBlueprint } from './requests.ts';
import {
  candidateRejection,
  type ExternalEconomicOracleProviderCandidateProfile,
  type ExternalProviderCredentialBinding,
  type ExternalProviderEndpointProfile,
  type ExternalProviderRequestBlueprint,
  type ProviderCandidateRejection,
} from './types.ts';

export class ExternalProviderCandidateRegistry {
  private readonly profiles = new Map<string, ExternalEconomicOracleProviderCandidateProfile>();
  private readonly endpoints = new Map<string, ExternalProviderEndpointProfile>();
  private readonly blueprints = new Map<string, ExternalProviderRequestBlueprint>();
  private readonly bindings = new Map<string, ExternalProviderCredentialBinding>();

  registerProfile(
    profile: ExternalEconomicOracleProviderCandidateProfile,
  ): Result<ExternalEconomicOracleProviderCandidateProfile, ProviderCandidateRejection> {
    const created = createCandidateProfile(profile);
    if (!created.ok) {
      return created;
    }
    this.profiles.set(created.value.profileId, created.value);
    return created;
  }

  registerEndpoint(
    endpoint: ExternalProviderEndpointProfile,
  ): Result<ExternalProviderEndpointProfile, ProviderCandidateRejection> {
    const created = createEndpointProfile(endpoint);
    if (!created.ok) {
      return created;
    }
    this.endpoints.set(created.value.endpointProfileId, created.value);
    return created;
  }

  registerBlueprint(
    blueprint: ExternalProviderRequestBlueprint,
  ): Result<ExternalProviderRequestBlueprint, ProviderCandidateRejection> {
    const created = createRequestBlueprint(blueprint);
    if (!created.ok) {
      return created;
    }
    this.blueprints.set(`${created.value.providerId}:${created.value.feedId}`, created.value);
    return created;
  }

  bindCredential(binding: ExternalProviderCredentialBinding): Result<ExternalProviderCredentialBinding, ProviderCandidateRejection> {
    if (binding.resolvedMaterial !== null || binding.plaintextPresent !== false) {
      return err(candidateRejection('SECRET_RESOLUTION_FORBIDDEN', 'registry cannot store resolved credentials'));
    }
    this.bindings.set(binding.descriptorRef, binding);
    return ok(binding);
  }

  getProfile(profileId: string): ExternalEconomicOracleProviderCandidateProfile | undefined {
    return this.profiles.get(profileId);
  }

  getEndpoint(endpointProfileId: string): ExternalProviderEndpointProfile | undefined {
    return this.endpoints.get(endpointProfileId);
  }

  listProfiles(): readonly ExternalEconomicOracleProviderCandidateProfile[] {
    return [...this.profiles.values()];
  }
}
