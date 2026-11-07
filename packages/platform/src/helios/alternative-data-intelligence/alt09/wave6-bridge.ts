/**
 * Upgrade Wave 6 patent search rows into company-level HELIOS patent observations.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import {
  PatentIntelligenceService,
  createDefaultWave6AdapterStates,
  type PatentObservation as Wave6PatentObservation,
} from '@solstice/external-data';

import { computePatentKnowableAt } from './knowable-at.ts';
import type { PatentObservation, PatentStatus } from './types.ts';

function toUtcInstantOrNull(isoDate: string | null): UtcInstant | null {
  if (!isoDate) {
    return null;
  }
  const ms = Date.parse(isoDate.length <= 10 ? `${isoDate}T00:00:00.000Z` : isoDate);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return asUtcInstant(new Date(ms).toISOString());
}

function familyIdFromPatent(patent: Wave6PatentObservation): string {
  const base = patent.applicationNumber ?? patent.publicationNumber ?? patent.patentId;
  return `fam:${base.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
}

function companyIdFromAssignee(assignee: string | null, patentId: string): string {
  if (!assignee) {
    return `co:unknown:${patentId}`;
  }
  const slug = assignee
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `co:${slug}`;
}

function mapStatus(status: Wave6PatentObservation['status']): PatentStatus {
  return status;
}

export function wave6PatentToObservation(
  row: Wave6PatentObservation,
  input: {
    readonly companyId?: string;
    readonly assignmentDate?: UtcInstant | null;
    readonly claimsExcerpt?: string | null;
  } = {},
): PatentObservation | null {
  const publicationDate = toUtcInstantOrNull(row.publicationDate);
  const knowableAt = computePatentKnowableAt({
    publicationDate,
    grantDate: toUtcInstantOrNull(row.grantDate),
    assignmentDate: input.assignmentDate ?? null,
  });
  if (!knowableAt) {
    return null;
  }
  const companyId = input.companyId ?? companyIdFromAssignee(row.assignee, row.patentId);
  const backward = Object.freeze([...row.citations]);
  return Object.freeze({
    observationId: `pat_obs:${row.patentId}`,
    patentId: row.patentId,
    familyId: familyIdFromPatent(row),
    companyId,
    applicationNumber: row.applicationNumber,
    publicationNumber: row.publicationNumber,
    title: row.title,
    abstract: row.abstract,
    claimsExcerpt: input.claimsExcerpt ?? null,
    inventors: Object.freeze([...row.inventors]),
    assignee: row.assignee,
    filingDate: toUtcInstantOrNull(row.filingDate),
    publicationDate,
    grantDate: toUtcInstantOrNull(row.grantDate),
    assignmentDate: input.assignmentDate ?? null,
    knowableAt,
    status: mapStatus(row.status),
    jurisdiction: row.jurisdiction,
    classificationCodes: Object.freeze([...row.classificationCodes]),
    forwardCitations: Object.freeze([] as string[]),
    backwardCitations: backward,
    providerId: row.providerId,
    provenance: row.provenance,
    grantsInfringementConclusion: false as const,
  });
}

export function ingestPatentsFromWave6(input: {
  readonly evaluationTimeUtc: UtcInstant;
  readonly nowUtc?: string;
  readonly assignmentOverrides?: Readonly<Record<string, UtcInstant | null>>;
  readonly claimsByPatentId?: Readonly<Record<string, string>>;
}): readonly PatentObservation[] {
  const nowUtc = input.nowUtc ?? new Date().toISOString();
  const service = new PatentIntelligenceService({
    nowUtc,
    states: createDefaultWave6AdapterStates(),
  });
  const result = service.searchPatents();
  const observations: PatentObservation[] = [];
  for (const envelope of result.observations) {
    const mapped = wave6PatentToObservation(envelope.data, {
      assignmentDate: input.assignmentOverrides?.[envelope.data.patentId] ?? null,
      claimsExcerpt: input.claimsByPatentId?.[envelope.data.patentId] ?? null,
    });
    if (!mapped) {
      continue;
    }
    if (Date.parse(input.evaluationTimeUtc) < Date.parse(mapped.knowableAt)) {
      continue;
    }
    observations.push(mapped);
  }
  return Object.freeze(observations);
}
