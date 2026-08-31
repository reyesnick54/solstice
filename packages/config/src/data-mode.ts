/**
 * Product data mode — distinct from ENVIRONMENT / LIVE_* monetary flags.
 *
 * Controls whether reference-data surfaces prefer live provider-backed
 * observations or explicit simulation fixtures. Production monetary execution
 * remains gated by LIVE_* regardless of data mode.
 */

import { ENVIRONMENT } from './flags.ts';

export const DATA_MODES = ['live', 'simulation', 'preview'] as const;
export type DataMode = (typeof DATA_MODES)[number];

/**
 * Resolve SUNREY_DATA_MODE with safe defaults.
 * ENVIRONMENT=simulation never implies silent fake live data — mode stays explicit.
 */
export function resolveDataMode(env: NodeJS.ProcessEnv = process.env): DataMode {
  const raw = env.SUNREY_DATA_MODE?.trim().toLowerCase();
  if (raw === 'live' || raw === 'simulation' || raw === 'preview') {
    return raw;
  }
  if (ENVIRONMENT === 'simulation') {
    return 'simulation';
  }
  return 'live';
}

export const DATA_MODE: DataMode = resolveDataMode();
