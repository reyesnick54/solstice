import { execSync } from 'node:child_process';
import { cpus, freemem, totalmem } from 'node:os';
import { existsSync } from 'node:fs';

import { PROTOCOL_SCHEMA_VERSION } from '../protocol/constants.ts';
import type {
  BenchContext,
  BenchProfile,
  HardwareProfile,
  LatencyProfile,
  OsContainerProfile,
} from './types.ts';
import { PERF_SCHEMA_VERSION, RESULT_CLASS } from './types.ts';

function gitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

export function hardwareProfile(): HardwareProfile {
  const list = cpus();
  return {
    arch: process.arch,
    cpus: list.length,
    totalMemoryBytes: totalmem(),
    model: list[0]?.model ?? 'unknown',
  };
}

export function osContainerProfile(): OsContainerProfile {
  return {
    platform: process.platform,
    release: process.release.name,
    container: existsSync('/.dockerenv') || existsSync('/run/.containerenv'),
    nodeVersion: process.version,
  };
}

export function captureContext(input: {
  readonly profile: BenchProfile;
  readonly validatorCount: number;
  readonly latencyProfile: LatencyProfile;
  readonly datasetSize: number;
  readonly testDurationMs: number;
  readonly startedAtUtc?: string;
}): BenchContext {
  return {
    schemaVersion: PERF_SCHEMA_VERSION,
    resultClass: RESULT_CLASS,
    sourceCommit: gitCommit(),
    hardware: hardwareProfile(),
    os: osContainerProfile(),
    validatorCount: input.validatorCount,
    latencyProfile: input.latencyProfile,
    datasetSize: input.datasetSize,
    protocolVersion: `sunrey.protocol.v${PROTOCOL_SCHEMA_VERSION}`,
    testDurationMs: input.testDurationMs,
    profile: input.profile,
    startedAtUtc: input.startedAtUtc ?? new Date().toISOString(),
  };
}

export function freeMemoryBytes(): number {
  return freemem();
}
