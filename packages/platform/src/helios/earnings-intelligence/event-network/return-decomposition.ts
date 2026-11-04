/**
 * Expected-return decomposition and orthogonalized research features (association / causal research).
 */

import type {
  ExpectedReturnDecomposition,
  FactorReturnObservation,
  OrthogonalizedResearchFeatureSet,
} from './types.ts';

export type ReturnDecompositionInput = {
  readonly horizonDays: number;
  readonly rawReturnBps: number | null;
  readonly marketReturnBps?: number | null;
  readonly sectorReturnBps?: number | null;
  readonly factorReturns?: readonly FactorReturnObservation[];
  readonly factorLoadings?: Readonly<Record<string, number>>;
};

function subtractNullable(a: number | null, b: number | null | undefined): number | null {
  if (a === null || b === null || b === undefined) return null;
  return a - b;
}

function dotFactorContribution(
  loadings: Readonly<Record<string, number>> | undefined,
  factorReturns: readonly FactorReturnObservation[] | undefined,
): { readonly bps: number | null; readonly used: readonly string[] } {
  if (!loadings || !factorReturns || factorReturns.length === 0) {
    return { bps: null, used: Object.freeze([]) };
  }
  const byId = new Map(factorReturns.map((f) => [f.factorId, f.returnBps]));
  let sum = 0;
  let any = false;
  const used: string[] = [];
  for (const [factorId, loading] of Object.entries(loadings)) {
    const fr = byId.get(factorId);
    if (fr === undefined) continue;
    sum += loading * fr;
    any = true;
    used.push(factorId);
  }
  return { bps: any ? Math.round(sum) : null, used: Object.freeze(used) };
}

export function decomposeExpectedReturn(input: ReturnDecompositionInput): ExpectedReturnDecomposition {
  const marketAdjusted = subtractNullable(input.rawReturnBps, input.marketReturnBps);
  const sectorAdjusted = subtractNullable(marketAdjusted, input.sectorReturnBps);
  const factor = dotFactorContribution(input.factorLoadings, input.factorReturns);
  const factorAdjusted =
    sectorAdjusted !== null && factor.bps !== null ? sectorAdjusted - factor.bps : sectorAdjusted;
  const residual =
    factorAdjusted !== null && factor.bps !== null
      ? factorAdjusted
      : subtractNullable(sectorAdjusted, factor.bps ?? undefined);

  return Object.freeze({
    horizonDays: input.horizonDays,
    rawReturnBps: input.rawReturnBps,
    marketAdjustedReturnBps: marketAdjusted,
    sectorAdjustedReturnBps: sectorAdjusted,
    factorAdjustedReturnBps: factor.bps !== null ? factorAdjusted : null,
    residualReturnBps: residual,
    factorLoadingsUsed: factor.used,
    grantsExecutionAuthority: false,
  });
}

export type OrthogonalizeResearchFeaturesInput = {
  readonly decomposition: ExpectedReturnDecomposition;
  readonly covariates: Readonly<Record<string, number | null>>;
};

/**
 * Partial out available linear factor structure from covariates for double-ML style diagnostics.
 * Simulation-safe: uses supplied covariates only; does not fetch live factor data.
 */
export function buildOrthogonalizedResearchFeatures(
  input: OrthogonalizeResearchFeaturesInput,
): OrthogonalizedResearchFeatureSet {
  const nuisancePartialledOut: string[] = [];
  const orthogonalized: Record<string, number | null> = {};

  const residualTarget = input.decomposition.residualReturnBps ?? input.decomposition.sectorAdjustedReturnBps;

  for (const [name, value] of Object.entries(input.covariates)) {
    if (value === null) {
      orthogonalized[name] = null;
      continue;
    }
    if (input.decomposition.factorLoadingsUsed.includes(name)) {
      nuisancePartialledOut.push(name);
      orthogonalized[name] = null;
      continue;
    }
    orthogonalized[name] = value;
  }

  return Object.freeze({
    targetResidualReturnBps: residualTarget,
    orthogonalizedCovariates: Object.freeze({ ...orthogonalized }),
    nuisancePartialledOut: Object.freeze(nuisancePartialledOut),
    method: 'residualize_on_available_factors',
    grantsExecutionAuthority: false,
  });
}
