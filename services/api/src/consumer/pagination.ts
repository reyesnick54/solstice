import { createHash } from 'node:crypto';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type CursorPage<T> = {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export function encodeCursor(input: {
  readonly namespace: string;
  readonly offset: number;
}): string {
  const raw = `${input.namespace}|${input.offset}`;
  const digest = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return Buffer.from(`${raw}|${digest}`, 'utf8').toString('base64url');
}

export function decodeCursor(
  cursor: string,
  expectedNamespace: string,
): { readonly offset: number } | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 3) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    const [namespace, offsetRaw, digest] = parts;
    if (namespace !== expectedNamespace) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    const offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    const expected = createHash('sha256').update(`${namespace}|${offset}`).digest('hex').slice(0, 16);
    if (digest !== expected) {
      return { error: 'INVALID_PAGINATION_CURSOR' };
    }
    return { offset };
  } catch {
    return { error: 'INVALID_PAGINATION_CURSOR' };
  }
}

export function paginate<T>(
  items: readonly T[],
  namespace: string,
  cursor: string | undefined,
  pageSize: number,
): CursorPage<T> | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
  const size = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const start =
    cursor === undefined || cursor === '' ? { offset: 0 } : decodeCursor(cursor, namespace);
  if ('error' in start) {
    return start;
  }
  const slice = items.slice(start.offset, start.offset + size);
  const nextOffset = start.offset + slice.length;
  const hasMore = nextOffset < items.length;
  return Object.freeze({
    items: slice,
    nextCursor: hasMore ? encodeCursor({ namespace, offset: nextOffset }) : null,
    hasMore,
  });
}

export function pageSizeOf(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, MAX_PAGE_SIZE);
}
