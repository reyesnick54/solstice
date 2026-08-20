/**
 * Product activation matrix keyed by jurisdiction, domain, legal entity,
 * and optional corridor / asset / customer class. There is no global
 * licensed=true flag.
 */

import type { ActivationDomain } from '../types.ts';
import { defaultProductRows } from './products.ts';
import type { OperatingScopeCatalog, OperatingScopeKey, ProductScopeRow } from './types.ts';
import { listJurisdictions } from './jurisdictions.ts';
import { listLegalEntities } from './products.ts';
import { SCOPE_REQUIREMENTS } from './requirements.ts';
import { listCorridors } from './corridors.ts';
import { listProviderBindings } from './provider-bindings.ts';

export function emptyEvidenceCatalog(evidence: OperatingScopeCatalog['evidence'] = []): OperatingScopeCatalog {
  return Object.freeze({
    schemaVersion: 1,
    jurisdictions: listJurisdictions(),
    legalEntities: listLegalEntities(),
    products: defaultProductRows(),
    requirements: SCOPE_REQUIREMENTS,
    corridors: listCorridors(),
    providers: listProviderBindings(),
    evidence: Object.freeze([...evidence]),
  });
}

export function findProductRow(
  catalog: OperatingScopeCatalog,
  key: OperatingScopeKey,
): ProductScopeRow | undefined {
  return catalog.products.find(
    (row) =>
      row.key.jurisdiction === key.jurisdiction &&
      row.key.activationDomain === key.activationDomain &&
      row.key.legalEntityRef === key.legalEntityRef &&
      (key.asset === undefined || row.key.asset === key.asset),
  );
}

export function matrixDoesNotInherit(
  catalog: OperatingScopeCatalog,
  sourceDomain: ActivationDomain,
  targetDomain: ActivationDomain,
): boolean {
  const source = catalog.products.filter((row) => row.key.activationDomain === sourceDomain);
  const target = catalog.products.filter((row) => row.key.activationDomain === targetDomain);
  if (sourceDomain === targetDomain) {
    return true;
  }
  return source.length > 0 && target.length > 0 && source.every((row) => row.independentOf.includes(targetDomain));
}
