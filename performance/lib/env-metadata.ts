/**
 * Environment metadata required for meaningful benchmark results.
 */

import { execSync } from 'node:child_process';
import { cpus, freemem, totalmem } from 'node:os';
import { existsSync } from 'node:fs';

import { ENVIRONMENT } from '../../packages/config/src/flags.ts';

export type QualificationEnvironment = {
  readonly resultClass: 'ENGINEERING_MEASUREMENT';
  readonly label: 'ENGINEERING_QUALIFICATION_TARGET';
  readonly sourceCommit: string;
  readonly recordedAtUtc: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly cpuCount: number;
  readonly cpuModel: string;
  readonly totalMemoryGiB: number;
  readonly freeMemoryGiB: number;
  readonly container: boolean;
  readonly environment: string;
  readonly databaseMode: 'in-process' | 'postgresql' | 'unavailable';
  readonly networkMode: 'localhost' | 'in-process';
  readonly cryptoMode: 'CLASSICAL_DEVELOPMENT_ED25519' | 'HYBRID_SIMULATION';
  readonly validatorCount: number | null;
  readonly benchmarkTool: string;
  readonly benchmarkToolVersion: string;
};

function gitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

export function captureEnvironment(input: {
  readonly databaseMode?: QualificationEnvironment['databaseMode'];
  readonly networkMode?: QualificationEnvironment['networkMode'];
  readonly validatorCount?: number | null;
  readonly benchmarkTool?: string;
  readonly benchmarkToolVersion?: string;
  readonly analysisMode?: string;
  readonly queueMode?: string;
  readonly deploymentMode?: string;
} = {}): QualificationEnvironment {
  const list = cpus();
  return {
    resultClass: 'ENGINEERING_MEASUREMENT',
    label: 'ENGINEERING_QUALIFICATION_TARGET',
    sourceCommit: gitCommit(),
    recordedAtUtc: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuCount: list.length,
    cpuModel: list[0]?.model ?? 'unknown',
    totalMemoryGiB: Math.round((totalmem() / 1024 ** 3) * 100) / 100,
    freeMemoryGiB: Math.round((freemem() / 1024 ** 3) * 100) / 100,
    container: existsSync('/.dockerenv') || existsSync('/run/.containerenv'),
    environment: ENVIRONMENT,
    databaseMode: input.databaseMode ?? 'in-process',
    networkMode: input.networkMode ?? 'in-process',
    cryptoMode: 'HYBRID_SIMULATION',
    validatorCount: input.validatorCount ?? null,
    benchmarkTool: input.benchmarkTool ?? 'sunrey-qualify-performance',
    benchmarkToolVersion: input.benchmarkToolVersion ?? 'wave6-prompt16',
  };
}
