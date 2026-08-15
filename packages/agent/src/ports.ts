import type { UtcInstant } from '../../domain/src/time.ts';

/**
 * The only dependencies the Personal Economy Agent may receive.
 * There is no ledger, kernel, authority issuer, or write path.
 */
export type AgentEconomicContext = {
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly writePath: false;
  readonly liquidMinorUnitsByCurrency: Readonly<Record<string, string>>;
  readonly incomeLabels: readonly string[];
  readonly obligationLabels: readonly string[];
  readonly debtLabels: readonly string[];
  readonly goalLabels: readonly string[];
  readonly opportunityLabels: readonly string[];
  readonly economicValueDimensionLabels?: readonly string[];
  readonly attributionLabels?: readonly string[];
};

export type AgentCapabilityClaims = {
  readonly actorId: string;
  readonly subjectId: string;
  readonly authorizedCapabilities: readonly string[];
  readonly mayProposeOnly: true;
  readonly mayExecute: false;
};

export type AgentMandateView = {
  readonly mandateId: string;
  readonly version: number;
  readonly status: string;
  readonly hardConstraintSummaries: readonly string[];
  readonly goalSummaries: readonly string[];
  readonly softPreferenceSummaries: readonly string[];
};

export type AgentRuntimePorts = {
  readonly context: AgentEconomicContext;
  readonly claims: AgentCapabilityClaims;
  readonly mandates: readonly AgentMandateView[];
};

export function freezeAgentPorts(ports: AgentRuntimePorts): AgentRuntimePorts {
  if (ports.context.writePath !== false) {
    throw new Error('agent context must declare writePath: false');
  }
  if (ports.claims.mayExecute !== false || ports.claims.mayProposeOnly !== true) {
    throw new Error('agent claims must be proposal-only');
  }
  return Object.freeze({
    context: Object.freeze({ ...ports.context }),
    claims: Object.freeze({
      ...ports.claims,
      authorizedCapabilities: Object.freeze([...ports.claims.authorizedCapabilities]),
    }),
    mandates: Object.freeze(ports.mandates.map((item) => Object.freeze({ ...item }))),
  });
}
