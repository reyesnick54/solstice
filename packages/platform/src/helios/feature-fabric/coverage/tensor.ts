import { createHash } from 'node:crypto';

import type { CoverageTensor } from './types.ts';
import { buildCoverageTensor as buildCoverageTensorFromEngine } from './engine.ts';

export { buildCoverageManifest, sealCoverageSnapshot } from './engine.ts';

export function buildCoverageTensor(
  input: Parameters<typeof buildCoverageTensorFromEngine>[0],
): CoverageTensor {
  return buildCoverageTensorFromEngine(input);
}

function canonicalTensorJson(tensor: CoverageTensor): string {
  return JSON.stringify(tensor, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function coverageTensorContentDigest(tensor: CoverageTensor): string {
  return createHash('sha256').update(canonicalTensorJson(tensor)).digest('hex');
}
