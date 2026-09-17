import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { StrategyCapsuleId } from './ids.ts';
import type {
  StrategyCapsulePromotionState,
  StrategyCapsuleQualificationState,
} from './taxonomy.ts';

export type StrategyCapsuleRef = {
  readonly capsuleId: StrategyCapsuleId;
  readonly version: string;
  readonly contentHash: string;
  readonly promotionState: StrategyCapsulePromotionState;
  readonly qualificationState: StrategyCapsuleQualificationState;
  readonly validUntil: UtcInstant | null;
  readonly modelDependencies: readonly string[];
  readonly policyVersion: string;
  readonly grantsExecutionAuthority: false;
};

export type StrategyCapsuleRegistryPort = {
  resolve(capsuleId: StrategyCapsuleId, version: string): StrategyCapsuleRef | null;
};
