import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FORMAL_MODEL_IDS, type FormalModelRegistry } from './types.ts';

export function formalRegistryPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'formal', 'registry', 'formal-model-registry.json');
}

export function loadFormalModelRegistry(): FormalModelRegistry {
  const registry = JSON.parse(readFileSync(formalRegistryPath(), 'utf8')) as FormalModelRegistry;
  if (registry.schemaVersion !== 1) {
    throw new Error('FormalModelRegistry schemaVersion must be 1');
  }
  if (registry.owner !== 'packages/sunrey-chain') {
    throw new Error('FormalModelRegistry owner must remain packages/sunrey-chain');
  }
  if (registry.claimLanguage !== 'model checked within stated bounds') {
    throw new Error('FormalModelRegistry must use precise claim language');
  }
  if (registry.notWholeSystemVerification !== true) {
    throw new Error('FormalModelRegistry must not claim whole-system verification');
  }
  const ids = registry.models.map((row) => row.modelId);
  for (const required of FORMAL_MODEL_IDS) {
    if (!ids.includes(required)) {
      throw new Error(`FormalModelRegistry missing ${required}`);
    }
  }
  return registry;
}
