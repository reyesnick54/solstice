import { FUZZ_PROFILES, type FuzzProfile, type FuzzProfileName } from './types.ts';

const SMOKE: FuzzProfile = Object.freeze({
  name: 'FUZZ_SMOKE',
  propertyCases: 48,
  campaignOps: 512,
  consensusEvents: 96,
  replicaCount: 3,
  maxFieldBytes: 4_096,
  maxRepeated: 32,
});

const EXTENDED: FuzzProfile = Object.freeze({
  name: 'FUZZ_EXTENDED',
  propertyCases: 256,
  campaignOps: 4_096,
  consensusEvents: 512,
  replicaCount: 4,
  maxFieldBytes: 16_384,
  maxRepeated: 128,
});

export function resolveFuzzProfile(name?: string): FuzzProfile {
  const requested = (name ?? process.env.FUZZ_PROFILE ?? 'FUZZ_SMOKE').toUpperCase();
  if (requested === 'FUZZ_EXTENDED') {
    return EXTENDED;
  }
  if (requested === 'FUZZ_SMOKE' || FUZZ_PROFILES.includes(requested as FuzzProfileName)) {
    return SMOKE;
  }
  return SMOKE;
}

export function isSmokeProfile(profile: FuzzProfile): boolean {
  return profile.name === 'FUZZ_SMOKE';
}
