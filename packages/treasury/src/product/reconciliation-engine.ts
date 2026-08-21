import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';

export const RECONCILIATION_CONCLUSIONS = [
  'MATCHED',
  'UNMATCHED',
  'AMOUNT_MISMATCH',
  'CURRENCY_MISMATCH',
  'MISSING_INTERNAL_RECORD',
  'MISSING_EXTERNAL_RECORD',
  'DUPLICATE_EXTERNAL_RECORD',
  'TIMING_DIFFERENCE',
  'UNKNOWN',
] as const;
export type ReconciliationConclusion = (typeof RECONCILIATION_CONCLUSIONS)[number];

export type ExpectedFinancialRecord = {
  readonly recordId: string;
  readonly domain: string;
  readonly provider: string;
  readonly currency: string;
  readonly amountMinor: bigint;
  readonly externalRef: string | null;
  readonly occurredAt: UtcInstant;
};

export type ReportedFinancialRecord = {
  readonly recordId: string;
  readonly provider: string;
  readonly currency: string;
  readonly amountMinor: bigint;
  readonly externalRef: string;
  readonly statementRef: string | null;
  readonly occurredAt: UtcInstant;
};

export type ReconciliationPairing = {
  readonly conclusion: ReconciliationConclusion;
  readonly expectedId: string | null;
  readonly reportedId: string | null;
  readonly amountMinor: bigint | null;
  readonly currency: string | null;
  readonly provider: string;
  readonly notes: readonly string[];
};

export type ReconciliationEngineResult = {
  readonly inputHash: string;
  readonly pairings: readonly ReconciliationPairing[];
  readonly matchedCount: number;
  readonly breakCount: number;
};

const TIMING_WINDOW_MS = 86_400_000;

function pairingKey(provider: string, externalRef: string | null): string | null {
  if (!externalRef) {
    return null;
  }
  return `${provider}::${externalRef}`;
}

export function hashReconciliationInputs(
  expected: readonly ExpectedFinancialRecord[],
  reported: readonly ReportedFinancialRecord[],
): string {
  const canonical = JSON.stringify({
    expected: expected.map((row) => ({
      recordId: row.recordId,
      domain: row.domain,
      provider: row.provider,
      currency: row.currency,
      amountMinor: row.amountMinor.toString(),
      externalRef: row.externalRef,
      occurredAt: row.occurredAt,
    })),
    reported: reported.map((row) => ({
      recordId: row.recordId,
      provider: row.provider,
      currency: row.currency,
      amountMinor: row.amountMinor.toString(),
      externalRef: row.externalRef,
      statementRef: row.statementRef,
      occurredAt: row.occurredAt,
    })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compare SunRey expected state to provider-reported state.
 * Never mutates the Ledger. Same immutable inputs yield the same pairings.
 */
export function reconcileExpectedToReported(
  expected: readonly ExpectedFinancialRecord[],
  reported: readonly ReportedFinancialRecord[],
): ReconciliationEngineResult {
  const inputHash = hashReconciliationInputs(expected, reported);
  const pairings: ReconciliationPairing[] = [];
  const usedReported = new Set<string>();
  const reportedByRef = new Map<string, ReportedFinancialRecord[]>();
  for (const row of reported) {
    const key = pairingKey(row.provider, row.externalRef);
    if (!key) {
      continue;
    }
    const list = reportedByRef.get(key) ?? [];
    list.push(row);
    reportedByRef.set(key, list);
  }

  for (const [key, rows] of reportedByRef) {
    if (rows.length > 1) {
      for (const row of rows) {
        usedReported.add(row.recordId);
        pairings.push({
          conclusion: 'DUPLICATE_EXTERNAL_RECORD',
          expectedId: null,
          reportedId: row.recordId,
          amountMinor: row.amountMinor,
          currency: row.currency,
          provider: row.provider,
          notes: Object.freeze([`duplicate_external_ref:${key}`]),
        });
      }
    }
  }

  const remainingExpected: ExpectedFinancialRecord[] = [];
  for (const row of expected) {
    const key = pairingKey(row.provider, row.externalRef);
    const candidates = key ? reportedByRef.get(key) : undefined;
    if (candidates && candidates.length === 1) {
      const reportedRow = candidates[0]!;
      usedReported.add(reportedRow.recordId);
      pairings.push(comparePair(row, reportedRow));
    } else if (candidates && candidates.length > 1) {
      remainingExpected.push(row);
    } else {
      remainingExpected.push(row);
    }
  }

  const unusedReported = reported.filter((row) => !usedReported.has(row.recordId));
  const stillExpected: ExpectedFinancialRecord[] = [];
  const stillReported = [...unusedReported];

  for (const row of remainingExpected) {
    const index = stillReported.findIndex(
      (candidate) =>
        candidate.provider === row.provider &&
        candidate.currency === row.currency &&
        candidate.amountMinor === row.amountMinor,
    );
    if (index >= 0) {
      const reportedRow = stillReported.splice(index, 1)[0]!;
      usedReported.add(reportedRow.recordId);
      pairings.push(comparePair(row, reportedRow));
    } else {
      stillExpected.push(row);
    }
  }

  for (const row of stillExpected) {
    const near = stillReported.find(
      (candidate) =>
        candidate.provider === row.provider &&
        candidate.currency === row.currency &&
        Math.abs(Date.parse(candidate.occurredAt) - Date.parse(row.occurredAt)) <= TIMING_WINDOW_MS,
    );
    if (near) {
      const idx = stillReported.indexOf(near);
      stillReported.splice(idx, 1);
      pairings.push(comparePair(row, near));
    } else {
      pairings.push({
        conclusion: 'MISSING_EXTERNAL_RECORD',
        expectedId: row.recordId,
        reportedId: null,
        amountMinor: row.amountMinor,
        currency: row.currency,
        provider: row.provider,
        notes: Object.freeze(['provider_did_not_report_expected_record']),
      });
    }
  }

  for (const row of stillReported) {
    pairings.push({
      conclusion: 'MISSING_INTERNAL_RECORD',
      expectedId: null,
      reportedId: row.recordId,
      amountMinor: row.amountMinor,
      currency: row.currency,
      provider: row.provider,
      notes: Object.freeze(['no_internal_record_for_provider_item']),
    });
  }

  const frozen = Object.freeze(pairings.map((row) => Object.freeze({ ...row, notes: Object.freeze([...row.notes]) })));
  const matchedCount = frozen.filter((row) => row.conclusion === 'MATCHED').length;
  const breakCount = frozen.length - matchedCount;
  return Object.freeze({
    inputHash,
    pairings: frozen,
    matchedCount,
    breakCount,
  });
}

function comparePair(expected: ExpectedFinancialRecord, reported: ReportedFinancialRecord): ReconciliationPairing {
  const notes: string[] = [];
  let conclusion: ReconciliationConclusion = 'MATCHED';
  if (expected.currency !== reported.currency) {
    conclusion = 'CURRENCY_MISMATCH';
    notes.push(`expected_currency:${expected.currency}`);
    notes.push(`reported_currency:${reported.currency}`);
  } else if (expected.amountMinor !== reported.amountMinor) {
    const deltaMs = Math.abs(Date.parse(expected.occurredAt) - Date.parse(reported.occurredAt));
    if (deltaMs > 0 && deltaMs <= TIMING_WINDOW_MS && expected.externalRef === reported.externalRef) {
      conclusion = 'AMOUNT_MISMATCH';
    } else if (deltaMs > TIMING_WINDOW_MS) {
      conclusion = 'TIMING_DIFFERENCE';
      notes.push('occurred_outside_same_day_window');
    } else {
      conclusion = 'AMOUNT_MISMATCH';
    }
    notes.push(`expected_minor:${expected.amountMinor.toString()}`);
    notes.push(`reported_minor:${reported.amountMinor.toString()}`);
  } else {
    const deltaMs = Math.abs(Date.parse(expected.occurredAt) - Date.parse(reported.occurredAt));
    if (deltaMs > TIMING_WINDOW_MS) {
      conclusion = 'TIMING_DIFFERENCE';
      notes.push('same_amount_outside_window');
    }
  }
  if (conclusion === 'MATCHED' && !expected.externalRef) {
    notes.push('matched_by_provider_currency_amount');
  }
  return Object.freeze({
    conclusion,
    expectedId: expected.recordId,
    reportedId: reported.recordId,
    amountMinor: expected.amountMinor,
    currency: expected.currency,
    provider: expected.provider,
    notes: Object.freeze(notes),
  });
}
