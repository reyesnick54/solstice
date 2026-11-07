import type { UtcInstant } from '@solstice/domain';

import { embeddingCosineDissimilarity } from './embeddings.ts';
import type {
  InnovationCommercializationGap,
  InnovationFeatureBundle,
  InnovationMomentum,
  PatentFamily,
  PatentObservation,
  TechnologyConvergence,
  TechnologyEmbeddingRecord,
  TechnologyExpansion,
} from './types.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function unique<T>(values: readonly T[]): number {
  return new Set(values).size;
}

export function buildPatentFamilies(
  companyId: string,
  patents: readonly PatentObservation[],
): readonly PatentFamily[] {
  const byFamily = new Map<string, PatentObservation[]>();
  for (const patent of patents) {
    if (patent.companyId !== companyId) {
      continue;
    }
    const list = byFamily.get(patent.familyId) ?? [];
    list.push(patent);
    byFamily.set(patent.familyId, list);
  }
  return Object.freeze(
    [...byFamily.entries()].map(([familyId, members]) => {
      const sorted = [...members].sort(
        (a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt),
      );
      const rep = sorted[0]!;
      const filingDates = members
        .map((m) => m.filingDate)
        .filter((d): d is UtcInstant => d !== null)
        .map((d) => Date.parse(d));
      const earliestFiling =
        filingDates.length > 0
          ? (new Date(Math.min(...filingDates)).toISOString() as UtcInstant)
          : null;
      return Object.freeze({
        familyId,
        companyId,
        representativePatentId: rep.patentId,
        memberPatentIds: Object.freeze(members.map((m) => m.patentId)),
        jurisdictions: Object.freeze([...new Set(members.map((m) => m.jurisdiction))]),
        earliestFilingDate: earliestFiling,
        knowableAt: rep.knowableAt,
      });
    }),
  );
}

export function computeInnovationFeatures(input: {
  readonly companyId: string;
  readonly patents: readonly PatentObservation[];
  readonly families: readonly PatentFamily[];
  readonly embeddings: readonly TechnologyEmbeddingRecord[];
  readonly allPatentsForCitations?: readonly PatentObservation[];
}): InnovationFeatureBundle {
  const companyPatents = input.patents.filter((p) => p.companyId === input.companyId);
  const patentIndex = new Map(
    (input.allPatentsForCitations ?? input.patents).map((p) => [p.patentId, p] as const),
  );
  const inventorSet = new Set<string>();
  for (const patent of companyPatents) {
    for (const inventor of patent.inventors) {
      inventorSet.add(inventor);
    }
  }
  const classCounts = new Map<string, number>();
  for (const patent of companyPatents) {
    for (const code of patent.classificationCodes) {
      classCounts.set(code, (classCounts.get(code) ?? 0) + 1);
    }
  }
  const classTotal = [...classCounts.values()].reduce((sum, n) => sum + n, 0);
  const maxClassShare =
    classTotal > 0 ? Math.max(...classCounts.values()) / classTotal : 0;
  let forward = 0;
  let backward = 0;
  let self = 0;
  for (const patent of companyPatents) {
    forward += patent.forwardCitations.length;
    backward += patent.backwardCitations.length;
    for (const cited of patent.backwardCitations) {
      const citedPatent = patentIndex.get(cited);
      if (citedPatent?.companyId === input.companyId) {
        self += 1;
      }
    }
  }
  const years = companyPatents
    .map((p) => p.filingDate)
    .filter((d): d is UtcInstant => d !== null)
    .map((d) => new Date(d).getUTCFullYear());
  const yearSpan = years.length > 0 ? Math.max(1, Math.max(...years) - Math.min(...years) + 1) : 1;
  const citationVelocity = clamp01((forward + backward) / Math.max(1, companyPatents.length * yearSpan));
  const assigneeChanges = companyPatents.filter((p) => p.assignmentDate !== null).length;
  const jurisdictions = new Set(
    input.families.filter((f) => f.companyId === input.companyId).flatMap((f) => f.jurisdictions),
  );
  const companyEmbeddings = input.embeddings.filter((e) =>
    companyPatents.some((p) => p.patentId === e.patentId),
  );
  let noveltySum = 0;
  let noveltyCount = 0;
  for (let i = 0; i < companyEmbeddings.length; i += 1) {
    for (let j = i + 1; j < companyEmbeddings.length; j += 1) {
      noveltySum += embeddingCosineDissimilarity(
        companyEmbeddings[i]!.vector,
        companyEmbeddings[j]!.vector,
      );
      noveltyCount += 1;
    }
  }
  const semanticNovelty = noveltyCount > 0 ? clamp01(noveltySum / noveltyCount) : 0;
  const technologyCentrality = clamp01(
    backward > 0 ? forward / (forward + backward + 1) : forward / Math.max(1, companyPatents.length),
  );
  return Object.freeze({
    patentCount: companyPatents.length,
    familyCount: input.families.filter((f) => f.companyId === input.companyId).length,
    citationVelocity,
    selfCitation: companyPatents.length > 0 ? self / companyPatents.length : 0,
    forwardCitation: companyPatents.length > 0 ? forward / companyPatents.length : 0,
    backwardCitation: companyPatents.length > 0 ? backward / companyPatents.length : 0,
    technologyBreadth: clamp01(unique(companyPatents.flatMap((p) => p.classificationCodes)) / 20),
    technologyConcentration: clamp01(maxClassShare),
    inventorBreadth: clamp01(inventorSet.size / Math.max(1, companyPatents.length * 2)),
    assigneeChange: companyPatents.length > 0 ? assigneeChanges / companyPatents.length : 0,
    assignmentFrequency: companyPatents.length > 0 ? assigneeChanges / companyPatents.length : 0,
    internationalFamilyBreadth: clamp01(jurisdictions.size / 5),
    semanticNovelty,
    technologyCentrality,
  });
}

export function computeInnovationMomentum(
  patents: readonly PatentObservation[],
  windowYears = 3,
): InnovationMomentum {
  const nowYear = new Date().getUTCFullYear();
  const recent = patents.filter((p) => {
    if (!p.filingDate) {
      return false;
    }
    const y = new Date(p.filingDate).getUTCFullYear();
    return y >= nowYear - windowYears;
  });
  const older = patents.filter((p) => {
    if (!p.filingDate) {
      return false;
    }
    const y = new Date(p.filingDate).getUTCFullYear();
    return y < nowYear - windowYears;
  });
  const filingAcceleration =
    older.length > 0 ? (recent.length - older.length) / Math.max(1, older.length) : recent.length;
  const recentCites = recent.reduce((s, p) => s + p.forwardCitations.length, 0);
  const olderCites = older.reduce((s, p) => s + p.forwardCitations.length, 0);
  const citationAcceleration =
    olderCites > 0 ? (recentCites - olderCites) / olderCites : recentCites > 0 ? 1 : 0;
  return Object.freeze({
    score: clamp01((filingAcceleration + citationAcceleration + 2) / 4),
    filingAcceleration: clamp01(filingAcceleration),
    citationAcceleration: clamp01(citationAcceleration),
  });
}

export function computeTechnologyExpansion(patents: readonly PatentObservation[]): TechnologyExpansion {
  const classes = new Set(patents.flatMap((p) => p.classificationCodes));
  const families = new Set(patents.map((p) => p.familyId));
  return Object.freeze({
    score: clamp01((classes.size + families.size) / 20),
    newClassificationCount: classes.size,
    newFamilyCount: families.size,
  });
}

export function computeTechnologyConvergence(patents: readonly PatentObservation[]): TechnologyConvergence {
  const domainPrefixes = patents.flatMap((p) =>
    p.classificationCodes.map((c) => c.slice(0, 4)),
  );
  const prefixCounts = new Map<string, number>();
  for (const prefix of domainPrefixes) {
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }
  const total = domainPrefixes.length || 1;
  const sorted = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topShare = sorted.length > 0 ? (sorted[0]![1] ?? 0) / total : 0;
  const crossDomainCitationShare = clamp01(1 - topShare);
  return Object.freeze({
    score: crossDomainCitationShare,
    crossDomainCitationShare,
  });
}

export function computeInnovationCommercializationGap(input: {
  readonly patents: readonly PatentObservation[];
  readonly utilizationClasses: ReadonlyMap<string, string>;
}): InnovationCommercializationGap {
  const granted = input.patents.filter((p) => p.status === 'GRANTED' || p.grantDate !== null);
  const grantedWithoutEvidence = granted.filter((p) => {
    const util = input.utilizationClasses.get(p.patentId);
    return util === 'NO_EVIDENCE' || util === 'UNKNOWN' || util === undefined;
  }).length;
  const publishedWithoutProduct = input.patents.filter((p) => {
    const util = input.utilizationClasses.get(p.patentId);
    return (util === 'NO_EVIDENCE' || util === undefined) && p.publicationDate !== null;
  }).length;
  return Object.freeze({
    score: clamp01((grantedWithoutEvidence + publishedWithoutProduct) / Math.max(1, input.patents.length * 2)),
    grantedWithoutUtilizationEvidence: grantedWithoutEvidence,
    publicationWithoutProductLink: publishedWithoutProduct,
  });
}
