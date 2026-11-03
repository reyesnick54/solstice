import type {
  AgentActionAudit,
  AgentCapabilityGrant,
  AgentResearchSession,
  ModelInferenceTelemetry,
  Os12StoreSnapshot,
  ResearchAutopilotStrategy,
} from './types.ts';
import type { AgentCapabilityGrantId, AgentResearchSessionId, ResearchAutopilotId } from './ids.ts';

export class InMemoryOs12AgentPermissionStore {
  readonly #grants = new Map<AgentCapabilityGrantId, AgentCapabilityGrant>();
  readonly #sessions = new Map<AgentResearchSessionId, AgentResearchSession>();
  readonly #audits: AgentActionAudit[] = [];
  readonly #telemetries: ModelInferenceTelemetry[] = [];
  readonly #autopilots = new Map<ResearchAutopilotId, ResearchAutopilotStrategy>();

  putGrant(grant: AgentCapabilityGrant): void {
    this.#grants.set(grant.grantId, grant);
  }

  getGrant(grantId: AgentCapabilityGrantId): AgentCapabilityGrant | undefined {
    return this.#grants.get(grantId);
  }

  putSession(session: AgentResearchSession): void {
    this.#sessions.set(session.sessionId, session);
  }

  getSession(sessionId: AgentResearchSessionId): AgentResearchSession | undefined {
    return this.#sessions.get(sessionId);
  }

  appendAudit(audit: AgentActionAudit): void {
    this.#audits.push(audit);
  }

  listAudits(): readonly AgentActionAudit[] {
    return Object.freeze([...this.#audits]);
  }

  appendTelemetry(telemetry: ModelInferenceTelemetry): void {
    this.#telemetries.push(telemetry);
  }

  listTelemetries(): readonly ModelInferenceTelemetry[] {
    return Object.freeze([...this.#telemetries]);
  }

  putAutopilot(strategy: ResearchAutopilotStrategy): void {
    this.#autopilots.set(strategy.autopilotId, strategy);
  }

  getAutopilot(autopilotId: ResearchAutopilotId): ResearchAutopilotStrategy | undefined {
    return this.#autopilots.get(autopilotId);
  }

  listAutopilots(): readonly ResearchAutopilotStrategy[] {
    return Object.freeze([...this.#autopilots.values()]);
  }

  snapshot(): Os12StoreSnapshot {
    return Object.freeze({
      grants: Object.freeze([...this.#grants.values()]),
      sessions: Object.freeze([...this.#sessions.values()]),
      audits: Object.freeze([...this.#audits]),
      telemetries: Object.freeze([...this.#telemetries]),
      autopilots: Object.freeze([...this.#autopilots.values()]),
    });
  }

  hydrate(snapshot: Os12StoreSnapshot): void {
    this.#grants.clear();
    this.#sessions.clear();
    this.#audits.length = 0;
    this.#telemetries.length = 0;
    this.#autopilots.clear();
    for (const grant of snapshot.grants) {
      this.#grants.set(grant.grantId, grant);
    }
    for (const session of snapshot.sessions) {
      this.#sessions.set(session.sessionId, session);
    }
    this.#audits.push(...snapshot.audits);
    this.#telemetries.push(...snapshot.telemetries);
    for (const autopilot of snapshot.autopilots) {
      this.#autopilots.set(autopilot.autopilotId, autopilot);
    }
  }
}
