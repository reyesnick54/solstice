import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import type { PatentObservation, TechnologyEmbeddingRecord } from './types.ts';

export const ALT09_EMBEDDING_MODEL_ID = 'helios-alt09-txt-hash-v1' as const;
export const ALT09_EMBEDDING_MODEL_VERSION = '2024-05-01' as const;
export const ALT09_EMBEDDING_MODEL_EFFECTIVE_AT = asUtcInstant('2024-05-01T00:00:00.000Z');

const DIM = 16;

function hashToken(token: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

function normalize(vector: number[]): readonly number[] {
  let norm = 0;
  for (const v of vector) {
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return Object.freeze(vector.map((v) => v / norm));
}

function embedText(text: string): readonly number[] {
  const vec = new Array<number>(DIM).fill(0);
  for (const token of text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)) {
    const bucket = hashToken(token) % DIM;
    vec[bucket] = (vec[bucket] ?? 0) + 1;
  }
  return normalize(vec);
}

export function buildPatentEmbeddingRecord(
  patent: PatentObservation,
  computedAt: UtcInstant,
): TechnologyEmbeddingRecord {
  const fields: ('title' | 'abstract' | 'claims' | 'classification')[] = ['title'];
  const parts = [patent.title];
  if (patent.abstract) {
    fields.push('abstract');
    parts.push(patent.abstract);
  }
  if (patent.claimsExcerpt) {
    fields.push('claims');
    parts.push(patent.claimsExcerpt);
  }
  if (patent.classificationCodes.length > 0) {
    fields.push('classification');
    parts.push(patent.classificationCodes.join(' '));
  }
  const text = parts.join('\n');
  const vector = embedText(text);
  const modelKnowable = Date.parse(ALT09_EMBEDDING_MODEL_EFFECTIVE_AT);
  const patentKnowable = Date.parse(patent.knowableAt);
  const computedMs = Date.parse(computedAt);
  const knowableAt = asUtcInstant(
    new Date(Math.max(modelKnowable, patentKnowable, computedMs)).toISOString(),
  );
  return Object.freeze({
    embeddingId: `emb:${patent.patentId}:${ALT09_EMBEDDING_MODEL_VERSION}`,
    patentId: patent.patentId,
    modelId: ALT09_EMBEDDING_MODEL_ID,
    modelVersion: ALT09_EMBEDDING_MODEL_VERSION,
    modelEffectiveAt: ALT09_EMBEDDING_MODEL_EFFECTIVE_AT,
    vector,
    sourceFields: Object.freeze(fields),
    computedAt,
    knowableAt,
  });
}

export function buildPatentEmbeddings(
  patents: readonly PatentObservation[],
  computedAt: UtcInstant,
): readonly TechnologyEmbeddingRecord[] {
  return Object.freeze(patents.map((patent) => buildPatentEmbeddingRecord(patent, computedAt)));
}

export function embeddingCosineDissimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 1;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) * (a[i] ?? 0);
    normB += (b[i] ?? 0) * (b[i] ?? 0);
  }
  if (normA === 0 || normB === 0) {
    return 1;
  }
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, 1 - similarity));
}
