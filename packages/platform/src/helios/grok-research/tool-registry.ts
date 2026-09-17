import { createHash } from 'node:crypto';
import type { ResearchToolCategory } from './taxonomy.ts';

export type ResearchToolDefinition = {
  readonly toolId: string;
  readonly version: string;
  readonly category: ResearchToolCategory;
  readonly description: string;
  readonly readOnly: true;
  readonly mutatesFinancialState: false;
  readonly permittedOperations: readonly string[];
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly budgetCostUnits: string;
  readonly identityHash: string;
};

export type ResearchToolExecutor = (
  operation: string,
  input: Readonly<Record<string, unknown>>,
) => Promise<{
  readonly ok: true;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly evidenceRef: string;
} | {
  readonly ok: false;
  readonly error: string;
}>;

export type RegisteredResearchTool = ResearchToolDefinition & {
  readonly execute: ResearchToolExecutor;
};

function toolHash(toolId: string, version: string, description: string): string {
  return createHash('sha256').update(JSON.stringify({ toolId, version, description })).digest('hex');
}

export class HeliosResearchToolRegistry {
  private readonly byId = new Map<string, RegisteredResearchTool>();

  register(tool: RegisteredResearchTool): void {
    const existing = this.byId.get(tool.toolId);
    if (existing && existing.identityHash !== tool.identityHash) {
      throw new Error(`research tool ${tool.toolId} identity is not deterministic`);
    }
    this.byId.set(tool.toolId, Object.freeze(tool));
  }

  get(toolId: string): RegisteredResearchTool | undefined {
    return this.byId.get(toolId);
  }

  require(toolId: string): RegisteredResearchTool {
    const found = this.byId.get(toolId);
    if (!found) {
      throw new Error(`unknown research tool ${toolId}`);
    }
    return found;
  }

  list(): readonly RegisteredResearchTool[] {
    return Object.freeze([...this.byId.values()]);
  }

  isRegistered(toolId: string): boolean {
    return this.byId.has(toolId);
  }
}

function observationExecutor(
  operation: string,
  input: Readonly<Record<string, unknown>>,
): Promise<{ readonly ok: true; readonly payload: Readonly<Record<string, unknown>>; readonly evidenceRef: string }> {
  const symbol = typeof input.symbol === 'string' ? input.symbol : 'UNKNOWN';
  const evidenceRef = `hev_obs_${symbol.toLowerCase()}_${Date.now()}`;
  return Promise.resolve({
    ok: true,
    evidenceRef,
    payload: Object.freeze({
      operation,
      symbol,
      observationType: 'quote',
      priceMinorUnits: '10000',
      currency: 'USD',
      asOf: new Date().toISOString(),
      sourceId: 'sim_market_feed',
      provider: 'simulation',
    }),
  });
}

function economicSearchExecutor(
  operation: string,
  input: Readonly<Record<string, unknown>>,
): Promise<{ readonly ok: true; readonly payload: Readonly<Record<string, unknown>>; readonly evidenceRef: string }> {
  const query = typeof input.query === 'string' ? input.query : '';
  const evidenceRef = `hev_econ_${createHash('sha256').update(query).digest('hex').slice(0, 12)}`;
  return Promise.resolve({
    ok: true,
    evidenceRef,
    payload: Object.freeze({
      operation,
      query,
      hits: Object.freeze([
        Object.freeze({ title: 'Public macro release', sourceId: 'sim_economic_calendar', relevance: 0.82 }),
      ]),
      sourceId: 'sim_economic_search',
      provider: 'simulation',
    }),
  });
}

function documentSearchExecutor(
  operation: string,
  input: Readonly<Record<string, unknown>>,
): Promise<{ readonly ok: true; readonly payload: Readonly<Record<string, unknown>>; readonly evidenceRef: string }> {
  const query = typeof input.query === 'string' ? input.query : '';
  const evidenceRef = `hev_doc_${createHash('sha256').update(query).digest('hex').slice(0, 12)}`;
  return Promise.resolve({
    ok: true,
    evidenceRef,
    payload: Object.freeze({
      operation,
      query,
      documents: Object.freeze([
        Object.freeze({ docId: 'doc_sim_1', title: 'Public filing excerpt', sourceId: 'sim_edgar' }),
      ]),
      provider: 'simulation',
    }),
  });
}

export function createDefaultResearchToolRegistry(): HeliosResearchToolRegistry {
  const registry = new HeliosResearchToolRegistry();

  const tools: Array<Omit<RegisteredResearchTool, 'execute' | 'identityHash'> & { execute: ResearchToolExecutor }> = [
    {
      toolId: 'tool_market_observation',
      version: '1.0.0',
      category: 'MARKET_OBSERVATION',
      description: 'Normalized public market observation lookup',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['lookup_quote', 'lookup_daily']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ symbol: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '10',
      execute: observationExecutor,
    },
    {
      toolId: 'tool_economic_data_search',
      version: '1.0.0',
      category: 'ECONOMIC_DATA_SEARCH',
      description: 'Public economic data search',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['search']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ query: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '15',
      execute: economicSearchExecutor,
    },
    {
      toolId: 'tool_document_search',
      version: '1.0.0',
      category: 'DOCUMENT_SEARCH',
      description: 'Public document and news search',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['search']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ query: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '12',
      execute: documentSearchExecutor,
    },
    {
      toolId: 'tool_instrument_metadata',
      version: '1.0.0',
      category: 'INSTRUMENT_METADATA',
      description: 'Public instrument metadata lookup',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['lookup']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ symbol: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '5',
      execute: observationExecutor,
    },
    {
      toolId: 'tool_economic_calendar',
      version: '1.0.0',
      category: 'ECONOMIC_CALENDAR',
      description: 'Public economic calendar events',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['upcoming', 'search']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ region: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '8',
      execute: economicSearchExecutor,
    },
    {
      toolId: 'tool_quant_analytics',
      version: '1.0.0',
      category: 'QUANT_ANALYTICS',
      description: 'Read-only quantitative analytics calculator',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['calculate']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ expression: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '20',
      execute: async (operation, input) => ({
        ok: true,
        evidenceRef: `hev_quant_${operation}`,
        payload: Object.freeze({ operation, input, result: 'computed', provider: 'simulation' }),
      }),
    },
    {
      toolId: 'tool_research_corpus',
      version: '1.0.0',
      category: 'RESEARCH_CORPUS',
      description: 'Public research corpus query',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['query']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ topic: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '10',
      execute: documentSearchExecutor,
    },
    {
      toolId: 'tool_external_data_trust',
      version: '1.0.0',
      category: 'EXTERNAL_DATA_TRUST',
      description: 'External Data Trust Engine read-only query',
      readOnly: true,
      mutatesFinancialState: false,
      permittedOperations: Object.freeze(['query']),
      inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ trustQueryId: Object.freeze({ type: 'string' }) }) }),
      budgetCostUnits: '25',
      execute: economicSearchExecutor,
    },
  ];

  for (const tool of tools) {
    registry.register(Object.freeze({
      ...tool,
      identityHash: toolHash(tool.toolId, tool.version, tool.description),
    }));
  }

  return registry;
}
