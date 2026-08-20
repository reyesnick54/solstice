/**
 * Consumption ports for Chunk 160 external evidence and Chunk 161
 * operating scope. Binding does not own a second registry or
 * evaluator. Callers inject the current owners.
 */

import { profileFor } from '../profiles.ts';
import type { EvidenceClass, ProviderDataClass, ProviderDomain } from '../types.ts';
import {
  bindingErr,
  bindingOk,
  type BindingBlocker,
  type BindingResult,
  type ExternalEvidencePort,
  type ExternalEvidenceView,
  type OperatingScopePort,
  type OperatingScopeQuery,
  type ProductionProviderBinding,
} from './types.ts';

export function requiredEvidenceClassesFor(domain: ProviderDomain): readonly EvidenceClass[] {
  return profileFor(domain).requiredEvidenceClasses;
}

export function consumeExternalEvidence(input: {
  readonly binding: ProductionProviderBinding;
  readonly evidence: ExternalEvidencePort;
  readonly nowUtc: string;
}): BindingResult<readonly ExternalEvidenceView[]> {
  if (input.binding.externalEvidenceRefs.length === 0) {
    return bindingErr('EXPIRED_EXTERNAL_EVIDENCE', 'external evidence references are required');
  }
  const views: ExternalEvidenceView[] = [];
  for (const ref of input.binding.externalEvidenceRefs) {
    const view = input.evidence.lookup(ref, input.nowUtc);
    if (!view) {
      return bindingErr('EXPIRED_EXTERNAL_EVIDENCE', `external evidence ${ref} is missing`);
    }
    if (view.providerId !== input.binding.providerId) {
      return bindingErr(
        'FAILOVER_EVIDENCE_INHERITED',
        `evidence ${ref} belongs to ${view.providerId}, not ${input.binding.providerId}`,
      );
    }
    if (view.status === 'EXPIRED') {
      return bindingErr('EXPIRED_EXTERNAL_EVIDENCE', `external evidence ${ref} is expired`);
    }
    if (view.status === 'REVOKED') {
      return bindingErr('REVOKED_EXTERNAL_EVIDENCE', `external evidence ${ref} is revoked`);
    }
    if (view.status !== 'CURRENT') {
      return bindingErr('EXPIRED_EXTERNAL_EVIDENCE', `external evidence ${ref} is ${view.status}`);
    }
    views.push(view);
  }
  return bindingOk(Object.freeze(views));
}

export function consumeOperatingScope(input: {
  readonly binding: ProductionProviderBinding;
  readonly operatingScope: OperatingScopePort;
  readonly jurisdictions: readonly string[];
  readonly dataClasses: readonly ProviderDataClass[];
  readonly operations: readonly string[];
  readonly productDomain: string;
}): BindingResult<true> {
  if (input.binding.operatingScopeRefs.length === 0) {
    return bindingErr('OPERATING_SCOPE_MISMATCH', 'operating scope references are required');
  }
  const blockers: BindingBlocker[] = [];
  for (const scopeRef of input.binding.operatingScopeRefs) {
    for (const jurisdiction of input.jurisdictions) {
      for (const dataClass of input.dataClasses) {
        for (const operation of input.operations) {
          const query: OperatingScopeQuery = {
            scopeRef,
            providerId: input.binding.providerId,
            providerDomain: input.binding.providerDomain,
            jurisdiction,
            productDomain: input.productDomain,
            dataClass,
            operation,
          };
          const decision = input.operatingScope.evaluate(query);
          if (decision.duplicatedEvaluator) {
            return bindingErr('OPERATING_SCOPE_MISMATCH', 'binding must consume Chunk 161, not duplicate it');
          }
          if (!decision.covered) {
            blockers.push({
              code: dataClass && !input.binding.dataClasses.includes(dataClass)
                ? 'UNSUPPORTED_DATA_CLASS'
                : 'OPERATING_SCOPE_MISMATCH',
              detail: decision.reasons.join('; ') || `${scopeRef} does not cover ${jurisdiction}/${dataClass}/${operation}`,
            });
          }
        }
      }
    }
  }
  const unsupported = input.dataClasses.filter((cls) => !input.binding.dataClasses.includes(cls));
  if (unsupported.length > 0) {
    return bindingErr('UNSUPPORTED_DATA_CLASS', `unsupported data class ${unsupported.join(',')}`);
  }
  if (blockers.length > 0) {
    const first = blockers[0] ?? { code: 'OPERATING_SCOPE_MISMATCH', detail: 'operating scope mismatch' };
    return bindingErr(first.code, first.detail);
  }
  return bindingOk(true);
}

export function inMemoryEvidencePort(records: readonly ExternalEvidenceView[]): ExternalEvidencePort {
  const byId = new Map(records.map((row) => [row.evidenceId, row]));
  return {
    lookup(evidenceId: string, nowUtc: string): ExternalEvidenceView | null {
      const row = byId.get(evidenceId);
      if (!row) {
        return null;
      }
      if (row.status === 'REVOKED') {
        return row;
      }
      if (row.expiresAtUtc && row.expiresAtUtc <= nowUtc) {
        return Object.freeze({ ...row, status: 'EXPIRED' });
      }
      return row;
    },
  };
}

export function inMemoryOperatingScopePort(
  allowed: readonly {
    readonly scopeRef: string;
    readonly providerId: string;
    readonly providerDomain: ProviderDomain;
    readonly jurisdictions: readonly string[];
    readonly productDomains: readonly string[];
    readonly dataClasses: readonly ProviderDataClass[];
    readonly operations: readonly string[];
  }[],
): OperatingScopePort {
  return {
    evaluate(query) {
      const match = allowed.find(
        (row) =>
          row.scopeRef === query.scopeRef &&
          row.providerId === query.providerId &&
          row.providerDomain === query.providerDomain &&
          row.jurisdictions.includes(query.jurisdiction) &&
          row.productDomains.includes(query.productDomain) &&
          row.dataClasses.includes(query.dataClass) &&
          row.operations.includes(query.operation),
      );
      return Object.freeze({
        covered: Boolean(match),
        reasons: match ? Object.freeze([]) : Object.freeze([`scope ${query.scopeRef} does not cover the requested combination`]),
        duplicatedEvaluator: false,
      });
    },
  };
}
