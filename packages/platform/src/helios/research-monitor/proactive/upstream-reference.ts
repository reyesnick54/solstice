/**
 * OpenChart proactive monitor assimilation reference (MIT).
 * Native implementation only — no upstream code imports.
 *
 * Reference SHA: 8109466bfb5d44c32e0e03e9337eaca48b837ab4
 */

export const OPENCHART_UPSTREAM = Object.freeze({
  repository: 'longsurf-ai/openchart',
  license: 'MIT',
  referenceSha: '8109466bfb5d44c32e0e03e9337eaca48b837ab4',
  assimilationPath: 'vendor/assimilation/openchart',
} as const);

export const OPENCHART_MODULE_INSPIRATION = Object.freeze({
  'server/alert/background.ts': 'background watcher fibers → proactive engine tick loop',
  'server/events/events.ts': 'id-only subscriptions → event-subscriptions.ts',
  'server/scheduler/scheduler.ts': 'schedule cursor → scheduler.ts',
  'server/trigger/trigger.ts': 'best-effort research routing → OS08 ResearchTriggerRouter',
  'server/agent/session/admit-prompt-target.ts': 'agent research admission → agentic-capital-mesh bridge',
  'server/monitoring/monitoring.ts': 'non-authoritative health (not economic truth)',
} as const satisfies Record<string, string>);
