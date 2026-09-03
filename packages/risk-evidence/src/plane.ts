/**
 * Wave 4 risk evidence plane — orchestrates KYB and digital-risk services.
 */

import { evaluateFromEvidence } from './policy.ts';
import { createRiskEvidenceServices, type DigitalRiskEvidenceService, type KYBEvidenceService } from './services.ts';
import { createDefaultRiskAdapterStates, type Wave4AdapterContext } from './adapters.ts';
import type { BusinessIdentityEvidence, DigitalRiskEvidence, RiskPolicyDecision } from './models.ts';

export class RiskEvidencePlane {
  readonly kyb: KYBEvidenceService;
  readonly digitalRisk: DigitalRiskEvidenceService;
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultRiskAdapterStates() };
    const services = createRiskEvidenceServices(this.#ctx);
    this.kyb = services.kyb;
    this.digitalRisk = services.digitalRisk;
  }

  adapterContext(): Wave4AdapterContext {
    return this.#ctx;
  }

  setProviderState(
    providerId: string,
    patch: Partial<{ enabled: boolean; down: boolean; rateLimited: boolean; malformed: boolean }>,
  ): void {
    const current = this.#ctx.states.get(providerId) ?? {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
    };
    this.#ctx.states.set(providerId, { ...current, ...patch });
  }

  evaluatePolicy(
    businessEvidence: readonly BusinessIdentityEvidence[],
    digitalRiskEvidence: readonly DigitalRiskEvidence[],
  ): RiskPolicyDecision {
    return evaluateFromEvidence(businessEvidence, digitalRiskEvidence, this.#ctx.nowUtc);
  }

  collectSessionRisk(input: {
    readonly sessionId: string;
    readonly deviceId?: string;
    readonly userId?: string;
    readonly subjectRef: string;
  }): readonly DigitalRiskEvidence[] {
    const context = {
      sessionId: input.sessionId,
      ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
    };
    const evidence: DigitalRiskEvidence[] = [];
    const ip = this.digitalRisk.assessIp(input.subjectRef, context);
    if (ip) evidence.push(ip);
    const vpn = this.digitalRisk.assessVpn(input.subjectRef, context);
    if (vpn) evidence.push(vpn);
    const tor = this.digitalRisk.assessTor(input.subjectRef, context);
    if (tor) evidence.push(tor);
    const proxy = this.digitalRisk.assessProxy(input.subjectRef, context);
    if (proxy) evidence.push(proxy);
    return Object.freeze(evidence);
  }
}

export function createRiskEvidencePlane(ctx?: Wave4AdapterContext): RiskEvidencePlane {
  return new RiskEvidencePlane(ctx);
}
