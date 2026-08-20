import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { ExternalSourceRecord } from '../schema.ts';
import { candidateRejection, type PaginationMode, type ProviderCandidateRejection } from './types.ts';

export type PaginationCursor = {
  readonly mode: PaginationMode;
  readonly resumeToken: string | null;
  readonly pageNumber: number;
  readonly seenTokens: readonly string[];
  readonly seenObservationIds: readonly string[];
};

export type PaginationBounds = {
  readonly maxPages: number;
  readonly maxRecordsPerPage: number;
};

export type PartialCollectionOutcome = {
  readonly retained: readonly ExternalSourceRecord[];
  readonly pagesCollected: number;
  readonly failedPage: number | null;
  readonly partial: boolean;
  readonly fabricatedMissingPage: false;
  readonly quorumCreated: false;
};

export function initialCursor(mode: PaginationMode): PaginationCursor {
  return Object.freeze({
    mode,
    resumeToken: null,
    pageNumber: 0,
    seenTokens: Object.freeze([]),
    seenObservationIds: Object.freeze([]),
  });
}

export function advanceCursor(input: {
  readonly cursor: PaginationCursor;
  readonly nextToken: string | null;
  readonly bounds: PaginationBounds;
  readonly pageRecords: readonly ExternalSourceRecord[];
}): Result<PaginationCursor, ProviderCandidateRejection> {
  if (input.cursor.pageNumber + 1 > input.bounds.maxPages) {
    return err(candidateRejection('PAGINATION_BOUND_EXCEEDED', `page bound ${input.bounds.maxPages} exceeded`));
  }
  if (input.pageRecords.length > input.bounds.maxRecordsPerPage) {
    return err(
      candidateRejection('PAGINATION_BOUND_EXCEEDED', `page exceeded ${input.bounds.maxRecordsPerPage} records`),
    );
  }
  if (input.nextToken !== null && input.cursor.seenTokens.includes(input.nextToken)) {
    return err(candidateRejection('CURSOR_LOOP_DETECTED', `resume token ${input.nextToken} already observed`));
  }
  const seenIds = [...input.cursor.seenObservationIds];
  for (const record of input.pageRecords) {
    const observationId = typeof record.extras?.sourceObservationId === 'string' ? record.extras.sourceObservationId : record.identifier;
    if (seenIds.includes(observationId)) {
      return err(candidateRejection('DUPLICATE_OBSERVATION', observationId));
    }
    seenIds.push(observationId);
  }
  return ok(
    Object.freeze({
      mode: input.cursor.mode,
      resumeToken: input.nextToken,
      pageNumber: input.cursor.pageNumber + 1,
      seenTokens: Object.freeze(input.nextToken ? [...input.cursor.seenTokens, input.nextToken] : input.cursor.seenTokens),
      seenObservationIds: Object.freeze(seenIds),
    }),
  );
}

export function retainPartialPage(input: {
  readonly retained: readonly ExternalSourceRecord[];
  readonly pagesCollected: number;
  readonly failedPage: number;
}): PartialCollectionOutcome {
  return Object.freeze({
    retained: Object.freeze([...input.retained]),
    pagesCollected: input.pagesCollected,
    failedPage: input.failedPage,
    partial: true,
    fabricatedMissingPage: false,
    quorumCreated: false,
  });
}

export function rejectInfinitePagination(pagesRequested: number, maxPages: number): Result<true, ProviderCandidateRejection> {
  if (pagesRequested > maxPages) {
    return err(candidateRejection('PAGINATION_BOUND_EXCEEDED', 'infinite pagination attempt rejected'));
  }
  return ok(true);
}
