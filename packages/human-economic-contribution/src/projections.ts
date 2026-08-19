import type { ContributionFingerprint, ContributionId, EvidenceRef, SubjectRef } from './ids.ts';
import type { ContributionClass, ContributionLifecycleState, SourceClass } from './taxonomy.ts';
import type { ContributionQuery, HumanContributionRegistryRecord } from './types.ts';

/**
 * Rebuildable query indexes. Clearing these does not delete canonical
 * contribution records. Callers rebuild from the authoritative store.
 */
export class ContributionQueryIndex {
  private readonly bySubject = new Map<SubjectRef, ContributionId[]>();
  private readonly byClass = new Map<ContributionClass, ContributionId[]>();
  private readonly byPeriod = new Map<string, ContributionId[]>();
  private readonly byJurisdiction = new Map<string, ContributionId[]>();
  private readonly byStatus = new Map<ContributionLifecycleState, ContributionId[]>();
  private readonly bySourceClass = new Map<SourceClass, ContributionId[]>();
  private readonly byFingerprint = new Map<ContributionFingerprint, ContributionId[]>();
  private readonly byEvidence = new Map<EvidenceRef, ContributionId[]>();

  clear(): void {
    this.bySubject.clear();
    this.byClass.clear();
    this.byPeriod.clear();
    this.byJurisdiction.clear();
    this.byStatus.clear();
    this.bySourceClass.clear();
    this.byFingerprint.clear();
    this.byEvidence.clear();
  }

  rebuild(records: readonly HumanContributionRegistryRecord[]): void {
    this.clear();
    for (const record of records) {
      this.index(record);
    }
  }

  index(record: HumanContributionRegistryRecord): void {
    push(this.bySubject, record.subjectRef, record.contributionId);
    push(this.byClass, record.contributionClass, record.contributionId);
    push(this.byPeriod, periodKey(record.measurementPeriod.start, record.measurementPeriod.end), record.contributionId);
    push(this.byJurisdiction, record.jurisdiction, record.contributionId);
    push(this.byStatus, record.status, record.contributionId);
    push(this.bySourceClass, record.sourceClass, record.contributionId);
    push(this.byFingerprint, record.fingerprint, record.contributionId);
    for (const evidence of record.evidenceReferences) {
      push(this.byEvidence, evidence, record.contributionId);
    }
  }

  matchingIds(criteria: ContributionQuery): readonly ContributionId[] | null {
    const sets: ContributionId[][] = [];
    if (criteria.subjectRef) {
      sets.push(this.bySubject.get(criteria.subjectRef) ?? []);
    }
    if (criteria.contributionClass) {
      sets.push(this.byClass.get(criteria.contributionClass) ?? []);
    }
    if (criteria.jurisdiction) {
      sets.push(this.byJurisdiction.get(criteria.jurisdiction) ?? []);
    }
    if (criteria.status) {
      sets.push(this.byStatus.get(criteria.status) ?? []);
    }
    if (criteria.sourceClass) {
      sets.push(this.bySourceClass.get(criteria.sourceClass) ?? []);
    }
    if (criteria.fingerprint) {
      sets.push(this.byFingerprint.get(criteria.fingerprint) ?? []);
    }
    if (criteria.evidenceRef) {
      sets.push(this.byEvidence.get(criteria.evidenceRef) ?? []);
    }
    if (sets.length === 0) {
      return null;
    }
    return intersect(sets);
  }
}

export function periodOverlaps(
  start: string,
  end: string | null,
  periodStart?: string,
  periodEnd?: string,
): boolean {
  if (!periodStart && !periodEnd) {
    return true;
  }
  const rangeStart = periodStart ?? start;
  const rangeEnd = periodEnd ?? end ?? periodStart ?? start;
  const recordEnd = end ?? start;
  return start <= rangeEnd && recordEnd >= rangeStart;
}

export function periodKey(start: string, end: string | null): string {
  return `${start}/${end ?? 'open'}`;
}

function push<K>(map: Map<K, ContributionId[]>, key: K, id: ContributionId): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(id);
    return;
  }
  map.set(key, [id]);
}

function intersect(sets: readonly ContributionId[][]): ContributionId[] {
  if (sets.length === 0) {
    return [];
  }
  const [first, ...rest] = sets;
  if (!first) {
    return [];
  }
  return first.filter((id) => rest.every((group) => group.includes(id)));
}
