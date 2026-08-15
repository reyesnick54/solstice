import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { asCapitalContextId, asCapitalMeshId, type CapitalMeshId } from './ids.ts';
import type { CapitalContext } from './types.ts';

export type ContextFailure = {
  readonly code: 'SUBJECT_MISMATCH' | 'WRITE_PATH' | 'MISSING_SUBJECT';
  readonly message: string;
};

export type ContextSource = {
  readonly subjectId: string;
  readonly bind: (subjectId: string) => Omit<CapitalContext, 'contextId' | 'meshId' | 'writePath' | 'generatedAt'> | undefined;
};

export function assembleCapitalContext(input: {
  readonly meshId: CapitalMeshId | string;
  readonly subjectId: string;
  readonly now: UtcInstant;
  readonly source: ContextSource;
}): Result<CapitalContext, ContextFailure> {
  if (input.subjectId.length === 0) {
    return err({ code: 'MISSING_SUBJECT', message: 'CapitalContext requires a subject' });
  }
  if (input.source.subjectId !== input.subjectId) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'CapitalContext for Customer A cannot retrieve Customer B data',
    });
  }
  const bound = input.source.bind(input.subjectId);
  if (!bound || bound.subjectId !== input.subjectId) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'CapitalContext for Customer A cannot retrieve Customer B data',
    });
  }
  const meshId = typeof input.meshId === 'string' ? asCapitalMeshId(input.meshId) : input.meshId;
  const material = `${meshId}:${input.subjectId}:${input.now}`;
  const contextId = asCapitalContextId(`cmctx_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`);
  return ok(
    Object.freeze({
      ...bound,
      contextId,
      meshId,
      subjectId: input.subjectId,
      generatedAt: input.now,
      writePath: false,
    }),
  );
}

export function assertSubjectBound(context: CapitalContext, subjectId: string): Result<true, ContextFailure> {
  if (context.subjectId !== subjectId) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'CapitalContext for Customer A cannot retrieve Customer B data',
    });
  }
  if (context.writePath !== false) {
    return err({ code: 'WRITE_PATH', message: 'CapitalContext must declare writePath: false' });
  }
  return ok(true);
}
