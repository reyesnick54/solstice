import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { sha256CanonicalJson } from '../release-evidence/hash.ts';
import { asResearchMonitorManifestId } from './ids.ts';
import { validateResearchMonitorExpression } from './expression.ts';
import { RESEARCH_MONITOR_SCHEMA_VERSION, RESEARCH_MONITOR_TRIGGER_ACTIONS } from './taxonomy.ts';
import type { CompileResearchMonitorResult, ResearchMonitorDefinition, ResearchMonitorManifest } from './types.ts';

function definitionBody(definition: ResearchMonitorDefinition): Record<string, unknown> {
  return {
    monitorId: definition.monitorId,
    name: definition.name,
    version: definition.version,
    watch: definition.watch,
    condition: definition.condition,
    trigger: definition.trigger,
    startAt: definition.startAt,
    expiresAt: definition.expiresAt,
    cooldownMs: definition.cooldownMs,
    maxTriggers: definition.maxTriggers,
    researchBudgetMinor: definition.researchBudgetMinor,
    priority: definition.priority,
    allowedAgentClasses: definition.allowedAgentClasses,
    requiredEvidence: definition.requiredEvidence,
    pointInTimeFeatureRequirements: definition.pointInTimeFeatureRequirements,
    staleDataPolicy: definition.staleDataPolicy,
  };
}

export function compileResearchMonitorDefinition(
  definition: ResearchMonitorDefinition,
  compiledAt: UtcInstant,
): CompileResearchMonitorResult {
  if (definition.version.schemaVersion !== RESEARCH_MONITOR_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'SCHEMA_MISMATCH',
      message: `expected schema ${RESEARCH_MONITOR_SCHEMA_VERSION}`,
    };
  }
  if (definition.trigger.action !== 'REQUEST_RESEARCH') {
    return { ok: false, code: 'TRADING_ACTION_FORBIDDEN', message: 'monitors may only REQUEST_RESEARCH' };
  }
  if (!(RESEARCH_MONITOR_TRIGGER_ACTIONS as readonly string[]).includes(definition.trigger.action)) {
    return { ok: false, code: 'INVALID_TRIGGER', message: 'unsupported trigger action' };
  }
  if (definition.watch.length === 0) {
    return { ok: false, code: 'WATCH_REQUIRED', message: 'watch list must not be empty' };
  }
  if (definition.maxTriggers < 1) {
    return { ok: false, code: 'INVALID_MAX_TRIGGERS', message: 'maxTriggers must be at least 1' };
  }
  if (definition.cooldownMs < 0) {
    return { ok: false, code: 'INVALID_COOLDOWN', message: 'cooldownMs must be non-negative' };
  }
  if (!/^\d+$/.test(definition.researchBudgetMinor) || BigInt(definition.researchBudgetMinor) <= 0n) {
    return { ok: false, code: 'INVALID_BUDGET', message: 'researchBudgetMinor must be a positive integer string' };
  }

  const validated = validateResearchMonitorExpression(definition.condition.expression);
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message };
  }

  const definitionHash = sha256CanonicalJson(definitionBody(definition));
  const expressionHash = sha256CanonicalJson(definition.condition.expression);
  const manifestId = asResearchMonitorManifestId(
    `hrm_mf_${createHash('sha256').update(`${definition.monitorId}:${definitionHash}`, 'utf8').digest('hex').slice(0, 24)}`,
  );

  const manifest: ResearchMonitorManifest = Object.freeze({
    manifestId,
    monitorId: definition.monitorId,
    name: definition.name,
    version: definition.version,
    watch: Object.freeze([...definition.watch]),
    featureRefs: validated.featureRefs,
    trigger: Object.freeze({ ...definition.trigger }),
    definitionHash,
    expressionHash,
    compiledAt,
    grantsTradingAction: false,
  });

  return { ok: true, manifest };
}
