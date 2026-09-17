import { type Brand, brandAs } from '../../../../domain/src/brand.ts';

export type GrowSandboxAllocationId = Brand<string, 'GrowSandboxAllocationId'>;

export function asGrowSandboxAllocationId(value: string): GrowSandboxAllocationId {
  if (!value.startsWith('gsa_')) {
    throw new TypeError('GrowSandboxAllocationId must use gsa_ prefix');
  }
  return brandAs<string, 'GrowSandboxAllocationId'>(value);
}

export function growSandboxAllocationIdFor(seed: string): GrowSandboxAllocationId {
  return asGrowSandboxAllocationId(`gsa_${seed}`);
}
