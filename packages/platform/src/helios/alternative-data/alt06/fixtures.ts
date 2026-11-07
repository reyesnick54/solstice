import { asUtcInstant } from '@solstice/domain';
import {
  ALT06_DEMO_SKU_CLASSIC,
  ALT06_DEMO_SKU_COMPETITOR,
  ALT06_FIXTURE_BRAND_NODE,
  ALT06_FIXTURE_ISSUER_ENTITY,
  ALT06_FIXTURE_SUBSIDIARY_NODE,
  alt06DemoObservationBundle,
} from '@solstice/external-data';

import type { Alt06ProductGraphEdge, Alt06ProductGraphNode } from './entity-graph.ts';

export { alt06DemoObservationBundle, ALT06_DEMO_SKU_CLASSIC, ALT06_DEMO_SKU_COMPETITOR };

export const ALT06_DEMO_PRODUCT_NODE = 'product:classic_crisps';

export function alt06DemoEntityGraphNodes(): readonly Alt06ProductGraphNode[] {
  return Object.freeze([
    Object.freeze({
      nodeId: ALT06_DEMO_PRODUCT_NODE,
      kind: 'PRODUCT',
      displayName: 'Famous Brand Classic Crisps',
      canonicalEntityId: null,
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      nodeId: ALT06_FIXTURE_BRAND_NODE,
      kind: 'BRAND',
      displayName: 'Famous Brand',
      canonicalEntityId: null,
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      nodeId: ALT06_FIXTURE_SUBSIDIARY_NODE,
      kind: 'SUBSIDIARY',
      displayName: 'Famous Snacks NA',
      canonicalEntityId: null,
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      nodeId: 'issuer:famous_snacks_inc',
      kind: 'PUBLIC_COMPANY',
      displayName: 'Famous Snacks Inc',
      canonicalEntityId: ALT06_FIXTURE_ISSUER_ENTITY,
      grantsExecutionAuthority: false,
    }),
  ]);
}

export function alt06DemoEntityGraphEdges(): readonly Alt06ProductGraphEdge[] {
  const t0 = asUtcInstant('2000-01-01T00:00:00.000Z');
  return Object.freeze([
    Object.freeze({
      edgeId: 'edge.product_brand',
      relationshipType: 'PRODUCT_OF_BRAND',
      fromNodeId: ALT06_DEMO_PRODUCT_NODE,
      toNodeId: ALT06_FIXTURE_BRAND_NODE,
      effectiveFrom: t0,
      effectiveTo: null,
      knowableAt: t0,
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      edgeId: 'edge.brand_sub',
      relationshipType: 'BRAND_OF_SUBSIDIARY',
      fromNodeId: ALT06_FIXTURE_BRAND_NODE,
      toNodeId: ALT06_FIXTURE_SUBSIDIARY_NODE,
      effectiveFrom: t0,
      effectiveTo: null,
      knowableAt: t0,
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      edgeId: 'edge.sub_issuer',
      relationshipType: 'SUBSIDIARY_OF',
      fromNodeId: ALT06_FIXTURE_SUBSIDIARY_NODE,
      toNodeId: 'issuer:famous_snacks_inc',
      effectiveFrom: t0,
      effectiveTo: null,
      knowableAt: t0,
      grantsExecutionAuthority: false,
    }),
  ]);
}
