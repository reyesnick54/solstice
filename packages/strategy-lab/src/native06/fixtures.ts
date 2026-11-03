import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '@solstice/domain';
import {
  asNative06GenomeIdFromBytexDocument,
  translateBytexDocumentJson,
} from './bytex-document.ts';
import { asNative06StrategyGenomeVersion } from './ids.ts';
import type { Native06StrategyGenome } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function loadBytexEmaCrossDocumentJson(): unknown {
  const path = join(ROOT, 'vendor/assimilation/bytex/documents/ema-cross.json');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function buildNative06EmaCrossGenomeFromVendorFixture(): Native06StrategyGenome {
  const raw = loadBytexEmaCrossDocumentJson();
  const translated = translateBytexDocumentJson(raw, {
    genomeId: asNative06GenomeIdFromBytexDocument('example-ema-cross'),
    version: asNative06StrategyGenomeVersion('v1'),
    createdBy: 'helios_native06_fixture',
    createdAt: asUtcInstant('2026-11-03T06:00:00.000Z'),
  });
  if (!translated.ok) {
    throw new Error(translated.error.message);
  }
  return translated.value;
}
