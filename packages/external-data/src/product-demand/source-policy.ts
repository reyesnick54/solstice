/**
 * ALT06 source rule — only licensed/public provider APIs or otherwise permitted sources.
 */

import {
  FORBIDDEN_PRODUCT_DEMAND_SOURCE_CLASSES,
  PRODUCT_DEMAND_SOURCE_PERMIT_CLASSES,
  type ProductDemandSourcePermitClass,
} from './taxonomy.ts';
import type { ProductDemandProviderRef } from './types.ts';

export type SourcePolicyVerdict =
  | { readonly permitted: true }
  | { readonly permitted: false; readonly reason: string };

export function assertPermittedProductDemandSource(provider: ProductDemandProviderRef): SourcePolicyVerdict {
  if ((FORBIDDEN_PRODUCT_DEMAND_SOURCE_CLASSES as readonly string[]).includes(provider.sourcePermitClass)) {
    return Object.freeze({
      permitted: false,
      reason: 'unauthorized_retail_scraping_forbidden',
    });
  }
  if (!(PRODUCT_DEMAND_SOURCE_PERMIT_CLASSES as readonly string[]).includes(provider.sourcePermitClass)) {
    return Object.freeze({
      permitted: false,
      reason: 'unknown_source_permit_class',
    });
  }
  return Object.freeze({ permitted: true });
}

export function isPermittedSourcePermitClass(value: string): value is ProductDemandSourcePermitClass {
  return (PRODUCT_DEMAND_SOURCE_PERMIT_CLASSES as readonly string[]).includes(value);
}
