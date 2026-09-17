import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type { StrategyCapsuleId, StrategyCapsuleVersion } from '../evaluation/ids.ts';
export { asStrategyCapsuleId, asStrategyCapsuleVersion } from '../evaluation/ids.ts';

export type StrategyFamilyId = Brand<string, 'StrategyFamilyId'>;

export function asStrategyFamilyId(value: string): StrategyFamilyId {
  if (!value.startsWith('sfam_') || value.length <= 'sfam_'.length) {
    throw new TypeError('StrategyFamilyId must start with sfam_');
  }
  return brandAs<string, 'StrategyFamilyId'>(value);
}
