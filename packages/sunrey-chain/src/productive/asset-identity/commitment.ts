/**
 * Commitment helpers for productive asset identity.
 *
 * Raw coordinates, display names, and provider ids are committed — not used
 * as sole canonical identity without alias registration.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import { PRODUCTIVE_ASSET_IDENTITY_SCHEMA } from './types.ts';

const DOMAIN = `${PRODUCTIVE_ASSET_IDENTITY_SCHEMA}:commitment` as const;

export function commitValue(label: string, value: string): string {
  return sha256Hex(`${DOMAIN}:${label}:${value.trim().toLowerCase()}`);
}

export function commitCoordinates(latitude: number, longitude: number, precisionDecimals = 3): string {
  const lat = latitude.toFixed(precisionDecimals);
  const lon = longitude.toFixed(precisionDecimals);
  return commitValue('coordinates', `${lat},${lon}`);
}

export function commitDisplayName(name: string): string {
  return commitValue('display-name', name);
}

export function aliasKey(parts: readonly string[]): string {
  return parts.join('|');
}
