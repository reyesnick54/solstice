import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FuzzArtifact } from './types.ts';

export function sourceCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function writeFuzzArtifact(dir: string, artifact: Omit<FuzzArtifact, 'sourceCommit' | 'toolVersion'>): string {
  mkdirSync(dir, { recursive: true });
  const record: FuzzArtifact = {
    ...artifact,
    sourceCommit: sourceCommit(),
    toolVersion: 'sunrey-assurance/1',
  };
  const path = join(dir, `${artifact.target}-${artifact.seed}.json`);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  return path;
}
