/**
 * Access product Action Center BFF adapter.
 */

import type { HumanAccessEconomyProduct } from '../../../../packages/human-access-economy/src/service.ts';
import type { AccessActionCenterExternalEvent } from '../../../../packages/human-access-economy/src/product/action-center.ts';

export type AccessActionCenterBff = {
  readonly externalEvents: (customerId: string) => readonly AccessActionCenterExternalEvent[];
};

export function createAccessActionCenterBff(product: HumanAccessEconomyProduct): AccessActionCenterBff {
  return Object.freeze({
    externalEvents(customerId: string) {
      return product.actionCenterEvents(customerId);
    },
  });
}

export function mergeAccessExternalEvents(
  base: readonly { readonly type: string; readonly occurredAt: string; readonly providerId: string | null; readonly resourceId: string; readonly summary: string; readonly evidenceRef: string | null; readonly autoNotify: false }[],
  access: readonly AccessActionCenterExternalEvent[],
): readonly (typeof base)[number][] {
  return Object.freeze([...base, ...access]);
}
