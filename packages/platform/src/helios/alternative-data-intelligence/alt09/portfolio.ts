import type { UtcInstant } from '@solstice/domain';

import { buildPatentEmbeddings } from './embeddings.ts';
import { buildCommercializationState } from './commercialization.ts';
import {
  buildPatentFamilies,
  computeInnovationCommercializationGap,
  computeInnovationFeatures,
  computeInnovationMomentum,
  computeTechnologyConvergence,
  computeTechnologyExpansion,
} from './features.ts';
import { filterKnowablePatents, assertNoPatentLeakage } from './knowable-at.ts';
import type {
  CommercializationEvidenceRef,
  InnovationState,
  PatentProductUtilizationState,
  TechnologyPortfolio,
} from './types.ts';

export function buildTechnologyPortfolio(input: {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly patents: readonly import('./types.ts').PatentObservation[];
}): TechnologyPortfolio {
  const visible = filterKnowablePatents(input.asOf, input.patents).filter(
    (p) => p.companyId === input.companyId,
  );
  assertNoPatentLeakage(input.asOf, visible);
  const families = buildPatentFamilies(input.companyId, visible);
  const embeddings = buildPatentEmbeddings(visible, input.asOf);
  const knowableAt = visible
    .map((p) => p.knowableAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] as UtcInstant;
  return Object.freeze({
    companyId: input.companyId,
    asOf: input.asOf,
    knowableAt,
    patents: Object.freeze(visible),
    families,
    embeddings,
  });
}

export function buildInnovationState(input: {
  readonly companyId: string;
  readonly companyLabel: string;
  readonly asOf: UtcInstant;
  readonly patents: readonly import('./types.ts').PatentObservation[];
  readonly evidenceByPatentId?: Readonly<Record<string, readonly CommercializationEvidenceRef[]>>;
  readonly preclassifiedUtilization?: readonly PatentProductUtilizationState[];
  readonly allPatentsForCitations?: readonly import('./types.ts').PatentObservation[];
}): InnovationState {
  const portfolio = buildTechnologyPortfolio({
    companyId: input.companyId,
    asOf: input.asOf,
    patents: input.patents,
  });
  const families = portfolio.families;
  const features = computeInnovationFeatures({
    companyId: input.companyId,
    patents: portfolio.patents,
    families,
    embeddings: portfolio.embeddings,
    allPatentsForCitations: input.allPatentsForCitations ?? input.patents,
  });
  const commercialization = buildCommercializationState({
    companyId: input.companyId,
    asOf: input.asOf,
    patents: input.patents,
    evidenceByPatentId: input.evidenceByPatentId ?? {},
    preclassified: input.preclassifiedUtilization,
  });
  const utilMap = new Map(
    commercialization.patentUtilization.map((row) => [row.patentId, row.utilizationClass] as const),
  );
  return Object.freeze({
    companyId: input.companyId,
    asOf: input.asOf,
    knowableAt: portfolio.knowableAt,
    portfolio,
    quality: Object.freeze({
      companyId: input.companyId,
      asOf: input.asOf,
      knowableAt: portfolio.knowableAt,
      features,
      citationQualityScore: Math.min(1, features.forwardCitation + features.technologyCentrality),
      grantsLegalConclusion: false as const,
    }),
    commercialization,
    momentum: computeInnovationMomentum(portfolio.patents),
    expansion: computeTechnologyExpansion(portfolio.patents),
    convergence: computeTechnologyConvergence(portfolio.patents),
    commercializationGap: computeInnovationCommercializationGap({
      patents: portfolio.patents,
      utilizationClasses: utilMap,
    }),
    grantsInvestmentAlpha: false as const,
  });
}
