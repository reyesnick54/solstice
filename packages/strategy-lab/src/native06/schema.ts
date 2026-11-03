import { err, ok, type Result } from '@solstice/domain';
import { FORBIDDEN_STRATEGY_CODE } from '../dsl.ts';
import { BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION } from './ids.ts';
import type { BytexStrategyDocument, Native06GenomeFailure } from './types.ts';

const ALLOWED_PARAM_TYPES = new Set(['int', 'decimal', 'string', 'bool']);

function scanForbidden(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    for (const token of FORBIDDEN_STRATEGY_CODE) {
      if (lower.includes(token.toLowerCase())) {
        out.push(token);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      scanForbidden(item, out);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      scanForbidden(key, out);
      scanForbidden(item, out);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBytexStrategyDocument(raw: unknown): Result<BytexStrategyDocument, Native06GenomeFailure> {
  const forbidden: string[] = [];
  scanForbidden(raw, forbidden);
  if (forbidden.length > 0) {
    return err({
      code: 'ARBITRARY_CODE_FORBIDDEN',
      message: `BYTEX strategy document forbids executable tokens: ${forbidden.join(', ')}`,
    });
  }
  if (!isRecord(raw)) {
    return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'document must be an object' });
  }
  if (raw.schemaVersion !== BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION) {
    return err({
      code: 'INVALID_BYTEX_DOCUMENT',
      message: `schemaVersion must be ${BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION}`,
    });
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'document id is required' });
  }
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'document name is required' });
  }
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'document nodes must be a non-empty array' });
  }
  if (!Array.isArray(raw.edges)) {
    return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'document edges must be an array' });
  }
  const nodeIds = new Set<string>();
  for (const node of raw.nodes) {
    if (!isRecord(node) || typeof node.id !== 'string' || typeof node.type !== 'string') {
      return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'each node requires id and type' });
    }
    if (nodeIds.has(node.id)) {
      return err({ code: 'INVALID_BYTEX_DOCUMENT', message: `duplicate node id ${node.id}` });
    }
    nodeIds.add(node.id);
  }
  for (const edge of raw.edges) {
    if (!isRecord(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
      return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'each edge requires from and to' });
    }
  }
  if (Array.isArray(raw.parameters)) {
    for (const param of raw.parameters) {
      if (!isRecord(param) || typeof param.name !== 'string' || typeof param.value !== 'string') {
        return err({ code: 'INVALID_BYTEX_DOCUMENT', message: 'parameters require name and value' });
      }
      if (typeof param.type === 'string' && !ALLOWED_PARAM_TYPES.has(param.type)) {
        return err({
          code: 'INVALID_BYTEX_DOCUMENT',
          message: `parameter ${param.name} has unsupported type ${param.type}`,
        });
      }
    }
  }
  const nodes = Object.freeze(
    raw.nodes.map((node) => {
      const record = node as Record<string, unknown>;
      const base = Object.freeze({
        id: String(record.id),
        type: String(record.type),
      });
      const paramsRaw = record.params;
      if (isRecord(paramsRaw)) {
        return Object.freeze({
          ...base,
          params: Object.freeze({ ...paramsRaw }),
        });
      }
      return base;
    }),
  );
  const edges = Object.freeze(
    raw.edges.map((edge) =>
      Object.freeze({
        from: String((edge as Record<string, unknown>).from),
        to: String((edge as Record<string, unknown>).to),
      }),
    ),
  );
  const parameters = Array.isArray(raw.parameters)
    ? Object.freeze(
        raw.parameters.map((param) =>
          Object.freeze({
            name: String((param as Record<string, unknown>).name),
            type: String((param as Record<string, unknown>).type),
            value: String((param as Record<string, unknown>).value),
          }),
        ),
      )
    : undefined;

  const documentBase = Object.freeze({
    schemaVersion: BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION,
    id: String(raw.id),
    name: String(raw.name),
    nodes,
    edges,
    ...(parameters ? { parameters } : {}),
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
  }) satisfies BytexStrategyDocument;

  return ok(documentBase);
}
