import type { UtcInstant } from '@solstice/domain';

import { isPatentVisibleAt } from './knowable-at.ts';
import type { PatentUtilizationClass } from './taxonomy.ts';
import type {
  CommercializationEvidenceRef,
  CommercializationState,
  PatentObservation,
  PatentProductUtilizationState,
} from './types.ts';

export function classifyPatentUtilization(input: {
  readonly patent: PatentObservation;
  readonly evidence: readonly CommercializationEvidenceRef[];
  readonly evaluationTimeUtc: UtcInstant;
}): PatentProductUtilizationState {
  const knowableEvidence = input.evidence.filter(
    (row) => Date.parse(input.evaluationTimeUtc) >= Date.parse(row.knowableAt),
  );
  let utilizationClass: PatentUtilizationClass = 'UNKNOWN';
  if (knowableEvidence.length === 0) {
    utilizationClass = 'NO_EVIDENCE';
  } else if (knowableEvidence.some((row) => row.kind === 'PRODUCT_SPEC' || row.kind === 'FILING_DISCLOSURE')) {
    utilizationClass = 'LIKELY_UTILIZED';
  } else {
    utilizationClass = 'POSSIBLY_UTILIZED';
  }
  const productId = knowableEvidence.find((row) => row.productId)?.productId ?? null;
  const knowableAt =
    knowableEvidence.length > 0
      ? (knowableEvidence
          .map((row) => row.knowableAt)
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] as UtcInstant)
      : input.patent.knowableAt;
  return Object.freeze({
    patentId: input.patent.patentId,
    companyId: input.patent.companyId,
    productId,
    utilizationClass,
    evidenceRefs: Object.freeze(knowableEvidence),
    knowableAt,
    inferredFromGrantOnly: false as const,
  });
}

export function buildCommercializationState(input: {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly patents: readonly PatentObservation[];
  readonly evidenceByPatentId: Readonly<Record<string, readonly CommercializationEvidenceRef[]>>;
  readonly preclassified?: readonly PatentProductUtilizationState[];
}): CommercializationState {
  const visible = input.patents.filter(
    (p) => p.companyId === input.companyId && isPatentVisibleAt(input.asOf, p),
  );
  const preByPatent = new Map(
    (input.preclassified ?? []).map((row) => [row.patentId, row] as const),
  );
  const utilization: PatentProductUtilizationState[] = [];
  for (const patent of visible) {
    if (preByPatent.has(patent.patentId)) {
      utilization.push(preByPatent.get(patent.patentId)!);
      continue;
    }
    utilization.push(
      classifyPatentUtilization({
        patent,
        evidence: input.evidenceByPatentId[patent.patentId] ?? [],
        evaluationTimeUtc: input.asOf,
      }),
    );
  }
  const knowableAt = utilization
    .map((row) => row.knowableAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] as UtcInstant;
  const utilizedPatentCount = utilization.filter(
    (row) => row.utilizationClass === 'LIKELY_UTILIZED' || row.utilizationClass === 'POSSIBLY_UTILIZED',
  ).length;
  return Object.freeze({
    companyId: input.companyId,
    asOf: input.asOf,
    knowableAt,
    patentUtilization: Object.freeze(utilization),
    utilizedPatentCount,
    grantsProductMarketFitConclusion: false as const,
  });
}
