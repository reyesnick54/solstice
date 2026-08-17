import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decode } from '../protocol/index.ts';

export type CorpusEntry = {
  readonly subsystem: string;
  readonly name: string;
  readonly bytes: Uint8Array;
};

export function loadHexCorpus(root: string): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  for (const subsystem of readdirSync(root, { withFileTypes: true })) {
    if (!subsystem.isDirectory()) {
      continue;
    }
    const dir = join(root, subsystem.name);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.hex')) {
        continue;
      }
      const hex = readFileSync(join(dir, file), 'utf8').trim();
      entries.push({
        subsystem: subsystem.name,
        name: file,
        bytes: Buffer.from(hex, 'hex'),
      });
    }
  }
  return entries;
}

export function replayProtocolCorpus(entries: readonly CorpusEntry[]): number {
  let rejected = 0;
  for (const entry of entries) {
    if (entry.subsystem !== 'protocol' && entry.subsystem !== 'security') {
      continue;
    }
    const result = decode(entry.bytes);
    if (!result.ok) {
      rejected += 1;
    }
  }
  return rejected;
}
