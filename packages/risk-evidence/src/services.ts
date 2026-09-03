/**
 * Canonical KYB and digital-risk evidence services.
 */

import type { BusinessIdentityEvidence, BusinessResolutionKey, BusinessSearchQuery, DigitalRiskEvidence, DigitalRiskType, RiskEvidenceSubjectRef } from './models.ts';
import {
  createDefaultRiskAdapterStates,
  fetchDigitalRiskEvidence,
  getBusinessEvidence,
  lookupBusinessEvidence,
  searchBusinessEvidence,
  type Wave4AdapterContext,
} from './adapters.ts';

export type BusinessIdentityProvider = {
  searchBusiness(query: BusinessSearchQuery): readonly BusinessIdentityEvidence[];
  lookupBusiness(key: BusinessResolutionKey): BusinessIdentityEvidence | null;
  getBusinessEvidence(entityId: string): BusinessIdentityEvidence | null;
  getRegistrationStatus(entityId: string): { readonly status: BusinessIdentityEvidence['status']; readonly providerNativeStatus: string | null } | null;
  getPublicOfficers(entityId: string): BusinessIdentityEvidence['officers'];
};

export type DigitalRiskProvider = {
  assessIp(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null;
  assessEmail(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null;
  assessNetwork(subjectRef: string, riskType: DigitalRiskType, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null;
};

export class KYBEvidenceService implements BusinessIdentityProvider {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultRiskAdapterStates() };
  }

  searchBusiness(query: BusinessSearchQuery): readonly BusinessIdentityEvidence[] {
    return searchBusinessEvidence(this.#ctx, query);
  }

  lookupBusiness(key: BusinessResolutionKey): BusinessIdentityEvidence | null {
    return lookupBusinessEvidence(this.#ctx, key);
  }

  getBusinessEvidence(entityId: string): BusinessIdentityEvidence | null {
    return getBusinessEvidence(this.#ctx, entityId);
  }

  getRegistrationStatus(entityId: string): { readonly status: BusinessIdentityEvidence['status']; readonly providerNativeStatus: string | null } | null {
    const evidence = this.getBusinessEvidence(entityId);
    if (!evidence) return null;
    return Object.freeze({
      status: evidence.status,
      providerNativeStatus: evidence.providerNativeStatus,
    });
  }

  getPublicOfficers(entityId: string): BusinessIdentityEvidence['officers'] {
    const evidence = this.getBusinessEvidence(entityId);
    return evidence?.officers ?? Object.freeze([]);
  }

  adapterContext(): Wave4AdapterContext {
    return this.#ctx;
  }
}

function digitalRiskQuery(
  subjectRef: string,
  riskType: DigitalRiskType,
  context: RiskEvidenceSubjectRef,
) {
  return {
    subjectRef,
    riskType,
    ...(context.sessionId !== undefined ? { sessionId: context.sessionId } : {}),
    ...(context.deviceId !== undefined ? { deviceId: context.deviceId } : {}),
    ...(context.userId !== undefined ? { userId: context.userId } : {}),
  };
}

export class DigitalRiskEvidenceService implements DigitalRiskProvider {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultRiskAdapterStates() };
  }

  assessIp(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null {
    return fetchDigitalRiskEvidence(this.#ctx, digitalRiskQuery(subjectRef, 'IP_REPUTATION', context));
  }

  assessEmail(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null {
    return fetchDigitalRiskEvidence(this.#ctx, digitalRiskQuery(subjectRef, 'EMAIL_REPUTATION', context));
  }

  assessNetwork(
    subjectRef: string,
    riskType: DigitalRiskType,
    context: RiskEvidenceSubjectRef,
  ): DigitalRiskEvidence | null {
    return fetchDigitalRiskEvidence(this.#ctx, digitalRiskQuery(subjectRef, riskType, context));
  }

  assessVpn(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null {
    return this.assessNetwork(subjectRef, 'VPN', context);
  }

  assessTor(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null {
    return this.assessNetwork(subjectRef, 'TOR', context);
  }

  assessProxy(subjectRef: string, context: RiskEvidenceSubjectRef): DigitalRiskEvidence | null {
    return this.assessNetwork(subjectRef, 'PROXY', context);
  }

  adapterContext(): Wave4AdapterContext {
    return this.#ctx;
  }
}

export function createRiskEvidenceServices(ctx?: Wave4AdapterContext) {
  return Object.freeze({
    kyb: new KYBEvidenceService(ctx),
    digitalRisk: new DigitalRiskEvidenceService(ctx),
  });
}
