/**
 * Deterministic branded identifiers for Access Economy simulation fixtures.
 *
 * The canonical id factories in packages/access-fabric derive ids from
 * wall-clock time, which a replayable simulation cannot use. These helpers
 * brand deterministic fixture strings without introducing a second id
 * authority: the prefixes come from the canonical owner.
 */

import { brandAs } from '../../../domain/src/brand.ts';
import {
  ACCESS_ENTITLEMENT_ID_PREFIX,
  ACCESS_RESERVATION_ID_PREFIX,
  type AccessEntitlementId,
  type AccessReservationId,
} from '../../../access-fabric/src/ids.ts';

function assertPrefixed(value: string, prefix: string): string {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`simulation id '${value}' must use the canonical prefix '${prefix}'`);
  }
  return value;
}

export function brandAccessEntitlementId(value: string): AccessEntitlementId {
  return brandAs<string, 'AccessEntitlementId'>(assertPrefixed(value, ACCESS_ENTITLEMENT_ID_PREFIX));
}

export function brandAccessReservationId(value: string): AccessReservationId {
  return brandAs<string, 'AccessReservationId'>(assertPrefixed(value, ACCESS_RESERVATION_ID_PREFIX));
}
