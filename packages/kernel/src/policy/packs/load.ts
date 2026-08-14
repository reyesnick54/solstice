import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PolicyPack, PolicyPackId } from '../types.ts';
import { loadPackFile } from './schema.ts';

const PACK_FILES: { readonly [K in PolicyPackId]: string } = {
  US: 'us.json',
  GB: 'gb.json',
  EU: 'eu.json',
  SA: 'sa.json',
  AE: 'ae.json',
};

export function bundledPackDirectory(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function loadBundledPack(packId: PolicyPackId): PolicyPack {
  const path = join(bundledPackDirectory(), PACK_FILES[packId]);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return loadPackFile(raw);
}

export function loadBundledPacks(): readonly PolicyPack[] {
  return (Object.keys(PACK_FILES) as PolicyPackId[]).map(loadBundledPack);
}
