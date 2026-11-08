import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { SealedDecisionRecord, ShadowLabCheckpoint } from '../types.ts';

export function contentHash(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function sealDecision(input: {
  readonly decisionId: string;
  readonly strategyId: string;
  readonly campaignId: string;
  readonly knowableAt: UtcInstant;
  readonly recordedAt: UtcInstant;
  readonly sequence: number;
  readonly previousHash: string;
  readonly action: string;
}): SealedDecisionRecord {
  const body = [
    input.decisionId,
    input.strategyId,
    input.campaignId,
    input.knowableAt,
    input.recordedAt,
    String(input.sequence),
    input.action,
    input.previousHash,
  ].join('|');
  return Object.freeze({
    decisionId: input.decisionId,
    strategyId: input.strategyId,
    campaignId: input.campaignId,
    knowableAt: input.knowableAt,
    recordedAt: input.recordedAt,
    sequence: input.sequence,
    contentHash: contentHash(body),
    previousHash: input.previousHash,
  });
}

export function verifyEvidenceChain(records: readonly SealedDecisionRecord[]): boolean {
  let expectedPrev = 'GENESIS';
  for (const record of records) {
    if (record.previousHash !== expectedPrev) {
      return false;
    }
    expectedPrev = record.contentHash;
  }
  return true;
}

export function checkpointFromChain(
  campaignId: string,
  records: readonly SealedDecisionRecord[],
  generation: number,
  sealedAt: UtcInstant,
): ShadowLabCheckpoint {
  const last = records[records.length - 1];
  return Object.freeze({
    checkpointId: `chk:${campaignId}@g${generation}`,
    sealedAt,
    decisionCount: records.length,
    lastContentHash: last?.contentHash ?? 'GENESIS',
    runtimeGeneration: generation,
  });
}

export function duplicateDecisionIds(records: readonly SealedDecisionRecord[]): readonly string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of records) {
    if (seen.has(r.decisionId)) {
      dupes.push(r.decisionId);
    }
    seen.add(r.decisionId);
  }
  return Object.freeze(dupes);
}
