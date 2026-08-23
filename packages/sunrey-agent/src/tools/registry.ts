import { contentHash } from '../ids.ts';
import type { AgentToolDefinition } from './types.ts';

/**
 * Canonical Agent Tool Registry.
 * Domain agent-tool.ts files remain specialized adapters. This is the
 * one identity/version catalog the Financial Agent may call.
 */
export class AgentToolRegistry {
  private readonly byId = new Map<string, AgentToolDefinition>();

  register(definition: AgentToolDefinition): void {
    const existing = this.byId.get(definition.toolId);
    if (existing && existing.identityHash !== definition.identityHash) {
      throw new Error(`tool ${definition.toolId} identity is not deterministic`);
    }
    this.byId.set(definition.toolId, Object.freeze(definition));
  }

  get(toolId: string): AgentToolDefinition | undefined {
    return this.byId.get(toolId);
  }

  require(toolId: string): AgentToolDefinition {
    const found = this.byId.get(toolId);
    if (!found) {
      throw new Error(`unknown agent tool ${toolId}`);
    }
    return found;
  }

  list(): readonly AgentToolDefinition[] {
    return Object.freeze([...this.byId.values()]);
  }

  listByCategory(): Readonly<Record<string, readonly AgentToolDefinition[]>> {
    const grouped: Record<string, AgentToolDefinition[]> = {};
    for (const tool of this.byId.values()) {
      grouped[tool.category] ??= [];
      grouped[tool.category]!.push(tool);
    }
    return Object.freeze(grouped);
  }
}

export function toolIdentityHash(toolId: string, version: string, description: string): string {
  return contentHash({ toolId, version, description });
}

export function emptyOutputSchema(): AgentToolDefinition['outputSchema'] {
  return Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({}),
  });
}

export function objectSchema(
  properties: AgentToolDefinition['inputSchema']['properties'],
): AgentToolDefinition['inputSchema'] {
  return Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze(properties),
  });
}
