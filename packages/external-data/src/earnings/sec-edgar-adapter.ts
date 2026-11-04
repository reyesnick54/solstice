/**
 * SEC EDGAR earnings adapter — maps as-filed submissions to EARN02 observations.
 * Simulation fixtures only; no live EDGAR network calls.
 */

import { createHash } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { SecEdgarSubmissionRecord } from '../sec-fundamentals/edgar-dataflow.ts';
import { earningsEventKey, parseFiscalPeriodLabel } from './identity.ts';
import { classifyEarningsSessionTiming } from './session-timing.ts';
import type { EarningsExternalObservation, EarningsFiscalIdentity } from './types.ts';

function payloadHash(material: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

function fiscalFromSubmission(record: SecEdgarSubmissionRecord): EarningsFiscalIdentity {
  try {
    return parseFiscalPeriodLabel(record.fiscalPeriod);
  } catch {
    const year = Number(record.reportPeriod.slice(0, 4));
    return Object.freeze({
      fiscalYear: year,
      fiscalQuarter: null,
      reportPeriod: record.reportPeriod,
      fiscalPeriodLabel: record.fiscalPeriod,
    });
  }
}

function baseTimes(record: SecEdgarSubmissionRecord, sunreyArrivalTime: UtcInstant) {
  const knowableAt =
    record.publishedAtUtc > record.acceptedAtUtc ? record.publishedAtUtc : record.acceptedAtUtc;
  return Object.freeze({
    scheduledEventTime: null,
    confirmedEventTime: null,
    actualReleaseTime: knowableAt,
    secAcceptedTime: record.acceptedAtUtc,
    callStartTime: null,
    providerAvailabilityTime: knowableAt,
    sunreyArrivalTime,
    knowableAt,
  });
}

function observationFromSubmission(
  record: SecEdgarSubmissionRecord,
  artifactKind: EarningsExternalObservation['artifactKind'],
  sunreyArrivalTime: UtcInstant,
  extras: Partial<EarningsExternalObservation> = {},
): EarningsExternalObservation {
  const fiscal = fiscalFromSubmission(record);
  const eventKey = earningsEventKey({ canonicalEntityId: record.canonicalEntityId, fiscal });
  const knowableAt = baseTimes(record, sunreyArrivalTime).knowableAt;
  const releaseTime = knowableAt;
  const observationId = `sec:${record.filingId}:${artifactKind}`;
  return Object.freeze({
    schema: 'sunrey.external.earnings-observation.v1',
    observationId,
    canonicalEntityId: record.canonicalEntityId,
    earningsEventKey: eventKey,
    artifactKind,
    fiscal,
    times: baseTimes(record, sunreyArrivalTime),
    sessionTiming: classifyEarningsSessionTiming(releaseTime),
    provenance: Object.freeze({
      providerId: 'sec-edgar',
      providerKind: 'SEC_EDGAR',
      sourceId: record.accessionNumber,
      evidenceRef: `sec-edgar:${record.accessionNumber}`,
      rawPayloadHash: payloadHash([record.filingId, record.form, artifactKind]),
      dedupeKey: `${record.accessionNumber}:${artifactKind}`,
    }),
    lineageRootId: record.amendsFilingId ?? record.filingId,
    supersedesObservationId: record.amendsFilingId ? `sec:${record.amendsFilingId}:${artifactKind}` : null,
    rescheduledFromEventKey: null,
    secForm: record.form as EarningsExternalObservation['secForm'],
    sec8kItem: artifactKind === 'SEC_8K_2_02' ? '2.02' : artifactKind === 'SEC_8K_7_01' ? '7.01' : null,
    accessionNumber: record.accessionNumber,
    filingId: record.filingId,
    payload: Object.freeze({
      documentUrl: record.documentUrl,
      companyName: record.companyName,
    }),
    grantsExecutionAuthority: false,
    ...extras,
  });
}

export function mapSecSubmissionToEarningsObservations(
  record: SecEdgarSubmissionRecord,
  sunreyArrivalTime: UtcInstant = asUtcInstant(record.acceptedAtUtc),
): readonly EarningsExternalObservation[] {
  const form = record.form as string;
  const out: EarningsExternalObservation[] = [];

  if (form === '8-K' || form === '8-K/A') {
    out.push(observationFromSubmission(record, 'SEC_8K_2_02', sunreyArrivalTime));
    out.push(
      observationFromSubmission(record, 'SEC_EX99', sunreyArrivalTime, {
        observationId: `sec:${record.filingId}:ex99`,
        provenance: Object.freeze({
          providerId: 'sec-edgar',
          providerKind: 'SEC_EDGAR',
          sourceId: `${record.accessionNumber}:EX-99`,
          evidenceRef: `sec-edgar:${record.accessionNumber}:EX-99`,
          rawPayloadHash: payloadHash([record.filingId, 'EX-99']),
          dedupeKey: `${record.accessionNumber}:EX-99`,
        }),
      }),
    );
  } else if (form === '6-K' || form === '6-K/A') {
    out.push(observationFromSubmission(record, 'SEC_6K', sunreyArrivalTime));
  } else if (form === '10-Q' || form === '10-Q/A') {
    out.push(observationFromSubmission(record, 'SEC_10Q', sunreyArrivalTime));
  } else if (form === '10-K' || form === '10-K/A') {
    out.push(observationFromSubmission(record, 'SEC_10K', sunreyArrivalTime));
  }

  return Object.freeze(out);
}

export function createSecEdgarEarningsPortFromFixtures(
  submissions: readonly SecEdgarSubmissionRecord[],
): import('./ports.ts').SecEdgarEarningsPort {
  return Object.freeze({
    providerId: 'sec-edgar',
    async fetchEarningsFilings(input) {
      const cutoffMs = Date.parse(input.asOfKnowableCutoff);
      const rows = submissions.filter((row) => {
        if (row.canonicalEntityId !== input.canonicalEntityId) {
          return false;
        }
        const knowableMs = Date.parse(
          row.publishedAtUtc > row.acceptedAtUtc ? row.publishedAtUtc : row.acceptedAtUtc,
        );
        return Number.isFinite(knowableMs) && knowableMs <= cutoffMs;
      });
      return Object.freeze(rows.flatMap((row) => [...mapSecSubmissionToEarningsObservations(row)]));
    },
  });
}
