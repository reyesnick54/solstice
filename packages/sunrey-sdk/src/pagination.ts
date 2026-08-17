import { createHash } from 'node:crypto';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type Page<T> = {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
  readonly page_size: number;
};

export function encodeCursor(input: {
  readonly namespace: string;
  readonly offset: number;
  readonly height: number;
}): string {
  const raw = `${input.namespace}|${input.offset}|${input.height}`;
  const digest = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return Buffer.from(`${raw}|${digest}`, 'utf8').toString('base64url');
}

export function decodeCursor(
  cursor: string,
  expectedNamespace: string,
): { readonly offset: number; readonly height: number } | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 4) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    const [namespace, offsetRaw, heightRaw, digest] = parts;
    if (namespace !== expectedNamespace) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    const offset = Number(offsetRaw);
    const height = Number(heightRaw);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(height) || height < 0) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    const expected = createHash('sha256').update(`${namespace}|${offset}|${height}`).digest('hex').slice(0, 16);
    if (digest !== expected) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    return { offset, height };
  } catch {
    return { error: 'INVALID_PAGINATION_CURSOR' };
  }
}

export function paginate<T>(
  items: readonly T[],
  namespace: string,
  height: number,
  cursor: string | undefined,
  pageSize: number,
): Page<T> | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
  const start = cursor === undefined || cursor === ''
    ? { offset: 0, height }
    : decodeCursor(cursor, namespace);
  if ('error' in start) {
    return start;
  }
  const slice = items.slice(start.offset, start.offset + pageSize);
  const nextOffset = start.offset + slice.length;
  return {
    items: slice,
    next_cursor: nextOffset < items.length
      ? encodeCursor({ namespace, offset: nextOffset, height })
      : null,
    page_size: pageSize,
  };
}
