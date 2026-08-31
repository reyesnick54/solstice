/**
 * Unified provider-sdk type surface — re-exports split modules without duplication.
 */

export * from './observation-types.ts';
export * from './registry-types.ts';
export * from './http-transport-types.ts';
export * from './reliability-types.ts';

import { PROVIDER_AUTHORITY_CLASSES } from './registry-types.ts';

export const AUTHORITY_CLASSES = PROVIDER_AUTHORITY_CLASSES;
