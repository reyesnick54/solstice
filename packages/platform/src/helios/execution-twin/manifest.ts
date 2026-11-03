import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { buildExecutionTwinEnvironment } from './environment.ts';
import type { ExecutionTwinEnvironmentKind } from './taxonomy.ts';
import type {
  ExecutionTwinFeatureManifest,
  ExecutionTwinRunManifest,
} from './types.ts';
import type { StrategyCapsuleRef } from '../strategy-capsule/types.ts';

export function executionConfigDigest(material: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

export function buildExecutionTwinRunManifest(input: {
  readonly runId: string;
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly strategyCapsule: StrategyCapsuleRef;
  readonly featureManifest: ExecutionTwinFeatureManifest;
  readonly executionConfigDigest: string;
  readonly randomSeed: string;
  readonly startedAt: UtcInstant;
  readonly completedAt?: UtcInstant | null;
  readonly outcomeFingerprint?: string | null;
}): ExecutionTwinRunManifest {
  const twinEnv = buildExecutionTwinEnvironment({ environment: input.environment });
  return Object.freeze({
    runId: input.runId,
    environment: input.environment,
    providerKind: twinEnv.providerKind,
    strategyCapsule: input.strategyCapsule,
    featureManifest: input.featureManifest,
    executionConfigDigest: input.executionConfigDigest,
    randomSeed: input.randomSeed,
    assumptions: twinEnv.assumptions,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    outcomeFingerprint: input.outcomeFingerprint ?? null,
    grantsExecutionAuthority: false as const,
    liveFlagsActive: false as const,
  });
}

export function strategyCapsuleUnchangedAcrossManifests(
  a: ExecutionTwinRunManifest,
  b: ExecutionTwinRunManifest,
): boolean {
  return (
    a.strategyCapsule.capsuleId === b.strategyCapsule.capsuleId &&
    a.strategyCapsule.version === b.strategyCapsule.version &&
    a.strategyCapsule.contentHash === b.strategyCapsule.contentHash &&
    a.featureManifest.contentHash === b.featureManifest.contentHash
  );
}
