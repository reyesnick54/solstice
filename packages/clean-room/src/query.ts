import { err, ok, type Result } from '../../domain/src/result.ts';
import type { DataCategory } from '../../personal-data-vault/src/taxonomy.ts';
import { asQueryTemplateVersion, queryTemplateIdFor, queryTemplateVersionFor } from './ids.ts';
import { FORBIDDEN_QUERY_NEEDLES, isQueryOperation, type QueryOperation } from './taxonomy.ts';
import type { CleanRoomFailure, QueryAst, QueryTemplate } from './types.ts';

const GROCERY_FIELDS = Object.freeze(['transactions', 'category', 'amountMinor', 'bookedAt', 'currency']);

export const QUERY_TEMPLATES: readonly QueryTemplate[] = Object.freeze([
  Object.freeze({
    templateId: queryTemplateIdFor('grocery_average'),
    version: queryTemplateVersionFor('grocery_average', 1),
    versionNumber: 1,
    code: 'grocery_average',
    description: 'Average grocery spending over authorized transaction rows.',
    ast: Object.freeze({
      operation: 'AVERAGE' as const,
      field: 'amountMinor',
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('grocery_count'),
    version: queryTemplateVersionFor('grocery_count', 1),
    versionNumber: 1,
    code: 'grocery_count',
    description: 'Count authorized grocery transaction rows.',
    ast: Object.freeze({
      operation: 'COUNT' as const,
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('grocery_sum'),
    version: queryTemplateVersionFor('grocery_sum', 1),
    versionNumber: 1,
    code: 'grocery_sum',
    description: 'Sum grocery spending over authorized transaction rows.',
    ast: Object.freeze({
      operation: 'SUM' as const,
      field: 'amountMinor',
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('grocery_minmax'),
    version: queryTemplateVersionFor('grocery_minmax', 1),
    versionNumber: 1,
    code: 'grocery_minmax',
    description: 'Bounded min/max grocery amounts.',
    ast: Object.freeze({
      operation: 'MIN_MAX_BOUNDED' as const,
      field: 'amountMinor',
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('grocery_histogram'),
    version: queryTemplateVersionFor('grocery_histogram', 1),
    versionNumber: 1,
    code: 'grocery_histogram',
    description: 'Histogram of grocery amounts.',
    ast: Object.freeze({
      operation: 'HISTOGRAM' as const,
      field: 'amountMinor',
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
      buckets: Object.freeze([
        { startMinor: '0', endMinor: '2000' },
        { startMinor: '2000', endMinor: '5000' },
        { startMinor: '5000', endMinor: '20000' },
      ]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('category_aggregation'),
    version: queryTemplateVersionFor('category_aggregation', 1),
    versionNumber: 1,
    code: 'category_aggregation',
    description: 'Category aggregation of authorized transaction amounts.',
    ast: Object.freeze({
      operation: 'CATEGORY_AGGREGATION' as const,
      field: 'amountMinor',
      categoryField: 'category',
      groupBy: Object.freeze(['category']),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('cohort_metric'),
    version: queryTemplateVersionFor('cohort_metric', 1),
    versionNumber: 1,
    code: 'cohort_metric',
    description: 'Cohort-level grocery participation metric.',
    ast: Object.freeze({
      operation: 'COHORT_METRIC' as const,
      field: 'amountMinor',
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('grocery_distribution'),
    version: queryTemplateVersionFor('grocery_distribution', 1),
    versionNumber: 1,
    code: 'grocery_distribution',
    description: 'Distribution buckets of grocery amounts.',
    ast: Object.freeze({
      operation: 'DISTRIBUTION_BUCKETS' as const,
      field: 'amountMinor',
      filters: Object.freeze([{ field: 'category', eq: 'grocery' }]),
      buckets: Object.freeze([
        { startMinor: '0', endMinor: '2000' },
        { startMinor: '2000', endMinor: '5000' },
        { startMinor: '5000', endMinor: '20000' },
      ]),
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
  Object.freeze({
    templateId: queryTemplateIdFor('raw_row_export'),
    version: queryTemplateVersionFor('raw_row_export', 1),
    versionNumber: 1,
    code: 'raw_row_export',
    description: 'Raw row export. Default DENY at the egress firewall.',
    ast: Object.freeze({
      operation: 'COUNT' as const,
      rawRowExport: true,
    }),
    allowedCategories: Object.freeze(['TRANSACTION_DATA'] as const satisfies readonly DataCategory[]),
    allowedFields: GROCERY_FIELDS,
    status: 'ACTIVE' as const,
  }),
]);

export class QueryTemplateRegistry {
  private readonly byVersion = new Map<string, QueryTemplate>();
  private readonly byId = new Map<string, QueryTemplate>();

  constructor(seed: readonly QueryTemplate[] = QUERY_TEMPLATES) {
    for (const template of seed) {
      this.byVersion.set(template.version, template);
      this.byId.set(template.templateId, template);
    }
  }

  get(ref: string): QueryTemplate | undefined {
    if (this.byId.has(ref)) {
      return this.byId.get(ref);
    }
    if (this.byVersion.has(ref)) {
      return this.byVersion.get(ref);
    }
    if (ref.startsWith('crt_')) {
      return this.byId.get(ref);
    }
    return this.byId.get(queryTemplateIdFor(ref));
  }

  getByCode(code: string): QueryTemplate | undefined {
    return this.byId.get(queryTemplateIdFor(code));
  }

  getVersion(version: string): QueryTemplate | undefined {
    return this.byVersion.get(asQueryTemplateVersion(version));
  }

  list(): readonly QueryTemplate[] {
    return Object.freeze([...this.byId.values()]);
  }
}

export function rejectArbitraryQuery(input: unknown): Result<QueryAst, CleanRoomFailure> {
  if (typeof input === 'string') {
    return rejectNeedles(input);
  }
  if (input === null || typeof input !== 'object') {
    return err({ code: 'UNSUPPORTED_OPERATION', message: 'query must be a constrained AST or template reference' });
  }
  const record = input as Record<string, unknown>;
  for (const key of ['sql', 'code', 'python', 'javascript', 'shell', 'procedure', 'script']) {
    if (key in record) {
      return err({
        code: key === 'sql' ? 'ARBITRARY_SQL_FORBIDDEN' : 'ARBITRARY_CODE_FORBIDDEN',
        message: `requester-supplied ${key} is forbidden; only approved query templates may run`,
      });
    }
  }
  const serialized = JSON.stringify(record);
  const needles = rejectNeedles(serialized);
  if (!needles.ok) {
    return needles;
  }
  if (typeof record.operation === 'string' && !isQueryOperation(record.operation)) {
    return err({ code: 'UNSUPPORTED_OPERATION', message: `${record.operation} is not an approved Clean Room operation` });
  }
  return ok(record as QueryAst);
}

function rejectNeedles(value: string): Result<QueryAst, CleanRoomFailure> {
  for (const needle of FORBIDDEN_QUERY_NEEDLES) {
    if (value.includes(needle) && (needle === 'SELECT' || needle === 'select' || needle === 'JOIN' || needle === 'UNION')) {
      return err({ code: 'ARBITRARY_SQL_FORBIDDEN', message: 'arbitrary SQL is forbidden' });
    }
    if (value.includes(needle) && (needle === 'eval(' || needle === 'Function(' || needle === 'child_process' || needle === '#!/')) {
      return err({ code: 'ARBITRARY_CODE_FORBIDDEN', message: 'arbitrary code is forbidden' });
    }
  }
  if (/^\s*SELECT\b/i.test(value) || /\bFROM\s+\w+/i.test(value)) {
    return err({ code: 'ARBITRARY_SQL_FORBIDDEN', message: 'arbitrary SQL is forbidden' });
  }
  return err({ code: 'UNSUPPORTED_OPERATION', message: 'string queries are not accepted; use a versioned template' });
}

export function queryFingerprint(template: QueryTemplate, ast: QueryAst): string {
  return JSON.stringify({
    templateId: template.templateId,
    version: template.version,
    operation: ast.operation,
    field: ast.field ?? null,
    filters: ast.filters ?? [],
    groupBy: ast.groupBy ?? [],
    rawRowExport: ast.rawRowExport === true,
  });
}

export function groupingDimensions(ast: QueryAst): number {
  return ast.groupBy?.length ?? 0;
}

export function queryComplexity(ast: QueryAst): number {
  let cost = 1;
  if (ast.operation === 'HISTOGRAM' || ast.operation === 'DISTRIBUTION_BUCKETS' || ast.operation === 'CATEGORY_AGGREGATION') {
    cost += 1;
  }
  cost += groupingDimensions(ast);
  return cost;
}

export function assertApprovedOperation(operation: QueryOperation): Result<QueryOperation, CleanRoomFailure> {
  if (!isQueryOperation(operation)) {
    return err({ code: 'UNSUPPORTED_OPERATION', message: 'operation is not on the approved template list' });
  }
  return ok(operation);
}
