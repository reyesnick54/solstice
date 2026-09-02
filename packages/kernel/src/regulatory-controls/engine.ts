/**
 * Wave 7 — Regulatory control evaluation engine.
 *
 * Composes jurisdiction context, regulatory profiles, retention, residency,
 * provider licenses, and feature gates into auditable decisions.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { ComplianceAuditReceiptStore, createComplianceAuditReceipt } from './audit-receipts.ts';
import { RegulatoryFeatureGateRegistry } from './feature-gates.ts';
import { primaryJurisdictionOrDefer } from './jurisdiction-context.ts';
import { LegalHoldRegistry } from './legal-hold.ts';
import { ProviderLicenseRegistry } from './provider-license.ts';
import { RegulatoryControlProfileRegistry } from './regulatory-profile.ts';
import { DataResidencyRegistry } from './residency.ts';
import { RetentionPolicyRegistry } from './retention.ts';
import type {
  ComplianceAuditReceipt,
  RegulatoryControlEvaluationInput,
  RegulatoryControlEvaluationResult,
} from './types.ts';

export type RegulatoryControlEngineOptions = {
  readonly profiles?: RegulatoryControlProfileRegistry;
  readonly retention?: RetentionPolicyRegistry;
  readonly residency?: DataResidencyRegistry;
  readonly providerLicenses?: ProviderLicenseRegistry;
  readonly featureGates?: RegulatoryFeatureGateRegistry;
  readonly legalHolds?: LegalHoldRegistry;
  readonly receipts?: ComplianceAuditReceiptStore;
};

export class RegulatoryControlEngine {
  readonly #profiles: RegulatoryControlProfileRegistry;
  readonly #retention: RetentionPolicyRegistry;
  readonly #residency: DataResidencyRegistry;
  readonly #providerLicenses: ProviderLicenseRegistry;
  readonly #featureGates: RegulatoryFeatureGateRegistry;
  readonly #legalHolds: LegalHoldRegistry;
  readonly #receipts: ComplianceAuditReceiptStore;

  constructor(options: RegulatoryControlEngineOptions = {}) {
    this.#profiles = options.profiles ?? new RegulatoryControlProfileRegistry();
    this.#retention = options.retention ?? new RetentionPolicyRegistry();
    this.#residency = options.residency ?? new DataResidencyRegistry();
    this.#providerLicenses = options.providerLicenses ?? new ProviderLicenseRegistry();
    this.#featureGates = options.featureGates ?? new RegulatoryFeatureGateRegistry();
    this.#legalHolds = options.legalHolds ?? new LegalHoldRegistry();
    this.#receipts = options.receipts ?? new ComplianceAuditReceiptStore();
  }

  receiptStore(): ComplianceAuditReceiptStore {
    return this.#receipts;
  }

  legalHoldRegistry(): LegalHoldRegistry {
    return this.#legalHolds;
  }

  evaluate(input: RegulatoryControlEvaluationInput): RegulatoryControlEvaluationResult {
    const decisionRef = `rcdec_${randomUUID()}`;
    const receipts: ComplianceAuditReceipt[] = [];

    const jurisdictionResolution = primaryJurisdictionOrDefer(input.jurisdictionContext);
    const jurisdictionReceipt = createComplianceAuditReceipt({
      kind: 'JURISDICTION',
      decisionRef,
      outcome: jurisdictionResolution.status === 'RESOLVED' ? 'ALLOW' : 'DEFER',
      jurisdictionContextId: input.jurisdictionContext.contextId,
      reasonCode: jurisdictionResolution.reasonCode,
      reason:
        jurisdictionResolution.status === 'RESOLVED'
          ? `jurisdiction resolved to ${jurisdictionResolution.jurisdiction}`
          : `jurisdiction deferred: ${input.jurisdictionContext.ambiguityReason ?? 'unresolved'}`,
      recordedAt: input.at,
    });
    receipts.push(jurisdictionReceipt);
    this.#receipts.record(jurisdictionReceipt);

    if (jurisdictionResolution.status === 'DEFER') {
      return this.#deny(decisionRef, receipts, 'JURISDICTION', jurisdictionResolution.reasonCode, jurisdictionReceipt.reason);
    }

    const jurisdiction = jurisdictionResolution.jurisdiction!;

    if (input.regulatedFeature) {
      const gate = this.#featureGates.evaluate({
        feature: input.regulatedFeature,
        jurisdiction,
        environment: input.environment,
        at: input.at,
      });
      const gateReceipt = createComplianceAuditReceipt({
        kind: 'SERVICE_FEATURE_GATE',
        decisionRef,
        outcome: gate.allowed ? 'ALLOW' : 'DENY',
        jurisdictionContextId: input.jurisdictionContext.contextId,
        feature: input.regulatedFeature,
        reasonCode: gate.reasonCode,
        reason: gate.reason,
        evidenceRefs: gate.gateId ? [gate.gateId] : [],
        recordedAt: input.at,
      });
      receipts.push(gateReceipt);
      this.#receipts.record(gateReceipt);

      if (!gate.allowed) {
        return this.#deny(decisionRef, receipts, 'SERVICE_FEATURE_GATE', gate.reasonCode, gate.reason);
      }
    }

    if (input.providerId && input.providerCapability) {
      const license = this.#providerLicenses.evaluate({
        providerId: input.providerId,
        capability: input.providerCapability,
        jurisdiction,
        at: input.at,
      });
      const licenseReceipt = createComplianceAuditReceipt({
        kind: 'PROVIDER_LICENSE',
        decisionRef,
        outcome: license.allowed ? 'ALLOW' : 'DENY',
        jurisdictionContextId: input.jurisdictionContext.contextId,
        providerId: input.providerId,
        reasonCode: license.reasonCode,
        reason: license.reason,
        evidenceRefs: license.licenseRef ? [license.licenseRef] : [],
        recordedAt: input.at,
      });
      receipts.push(licenseReceipt);
      this.#receipts.record(licenseReceipt);

      if (!license.allowed) {
        return this.#deny(decisionRef, receipts, 'PROVIDER_LICENSE', license.reasonCode, license.reason);
      }
    }

    if (input.storageRegion) {
      const residency = this.#residency.evaluate({
        jurisdiction,
        storageRegion: input.storageRegion,
        persist: input.providerCapability !== 'QUERY',
        at: input.at,
      });
      const residencyReceipt = createComplianceAuditReceipt({
        kind: 'RESIDENCY',
        decisionRef,
        outcome: residency.allowed ? 'ALLOW' : 'DENY',
        jurisdictionContextId: input.jurisdictionContext.contextId,
        reasonCode: residency.reasonCode,
        reason: residency.reason,
        evidenceRefs: residency.constraintId ? [residency.constraintId] : [],
        recordedAt: input.at,
      });
      receipts.push(residencyReceipt);
      this.#receipts.record(residencyReceipt);

      if (!residency.allowed) {
        return this.#deny(decisionRef, receipts, 'RESIDENCY', residency.reasonCode, residency.reason);
      }
    }

    if (input.rightsGranted === false) {
      const rightsReceipt = createComplianceAuditReceipt({
        kind: 'RIGHTS',
        decisionRef,
        outcome: 'DENY',
        jurisdictionContextId: input.jurisdictionContext.contextId,
        reasonCode: 'RIGHTS_DENIED',
        reason: 'rights not granted for this action',
        recordedAt: input.at,
      });
      receipts.push(rightsReceipt);
      this.#receipts.record(rightsReceipt);
      return this.#deny(decisionRef, receipts, 'RIGHTS', 'RIGHTS_DENIED', rightsReceipt.reason);
    }

    if (input.consentGranted === false) {
      const consentReceipt = createComplianceAuditReceipt({
        kind: 'CONSENT',
        decisionRef,
        outcome: 'DENY',
        jurisdictionContextId: input.jurisdictionContext.contextId,
        reasonCode: 'CONSENT_DENIED',
        reason: 'consent not granted for this action',
        recordedAt: input.at,
      });
      receipts.push(consentReceipt);
      this.#receipts.record(consentReceipt);
      return this.#deny(decisionRef, receipts, 'CONSENT', 'CONSENT_DENIED', consentReceipt.reason);
    }

    if (input.regulatoryCategory) {
      const profiles = this.#profiles.applicable(input.regulatoryCategory, jurisdiction, input.at);
      if (profiles.length === 0) {
        const policyReceipt = createComplianceAuditReceipt({
          kind: 'POLICY',
          decisionRef,
          outcome: 'REQUIRE_MANUAL_REVIEW',
          jurisdictionContextId: input.jurisdictionContext.contextId,
          reasonCode: 'REGULATORY_PROFILE_MISSING',
          reason: `no regulatory profile for category ${input.regulatoryCategory} in jurisdiction ${jurisdiction}`,
          recordedAt: input.at,
        });
        receipts.push(policyReceipt);
        this.#receipts.record(policyReceipt);
        return Object.freeze({
          outcome: 'REQUIRE_MANUAL_REVIEW',
          reasonCode: 'REGULATORY_PROFILE_MISSING',
          reason: policyReceipt.reason,
          receipts: Object.freeze(receipts),
          blockedBy: 'POLICY',
        });
      }
      const profileReceipt = createComplianceAuditReceipt({
        kind: 'POLICY',
        decisionRef,
        outcome: 'ALLOW',
        jurisdictionContextId: input.jurisdictionContext.contextId,
        profileId: profiles[0]!.profileId,
        reasonCode: 'REGULATORY_PROFILE_APPLIED',
        reason: `applied profile ${profiles[0]!.profileId}`,
        evidenceRefs: profiles.map((profile) => profile.profileId),
        recordedAt: input.at,
      });
      receipts.push(profileReceipt);
      this.#receipts.record(profileReceipt);
    }

    const decisionReceipt = createComplianceAuditReceipt({
      kind: 'DECISION',
      decisionRef,
      outcome: 'ALLOW',
      jurisdictionContextId: input.jurisdictionContext.contextId,
      reasonCode: 'REGULATORY_CONTROL_ALLOWED',
      reason: `action ${input.action} allowed under regulatory controls`,
      recordedAt: input.at,
    });
    receipts.push(decisionReceipt);
    this.#receipts.record(decisionReceipt);

    return Object.freeze({
      outcome: 'ALLOW',
      reasonCode: 'REGULATORY_CONTROL_ALLOWED',
      reason: decisionReceipt.reason,
      receipts: Object.freeze(receipts),
      blockedBy: null,
    });
  }

  evaluateRetention(input: {
    readonly category: import('./taxonomy.ts').RetentionCategory;
    readonly recordCreatedAt: UtcInstant;
    readonly at: UtcInstant;
    readonly decisionRef?: string;
  }): import('./retention.ts').RetentionEvaluationResult {
    const result = this.#retention.evaluate({
      category: input.category,
      recordCreatedAt: input.recordCreatedAt,
      at: input.at,
      activeLegalHolds: this.#legalHolds.active(),
    });

    const receipt = createComplianceAuditReceipt({
      kind: 'RETENTION',
      decisionRef: input.decisionRef ?? `rcdec_retention_${randomUUID()}`,
      outcome: result.deletable ? 'ALLOW' : 'DENY',
      reasonCode: result.reasonCode,
      reason: result.reason,
      recordedAt: input.at,
    });
    this.#receipts.record(receipt);

    return result;
  }

  #deny(
    decisionRef: string,
    receipts: ComplianceAuditReceipt[],
    blockedBy: import('./taxonomy.ts').ComplianceReceiptKind,
    reasonCode: string,
    reason: string,
  ): RegulatoryControlEvaluationResult {
    const decisionReceipt = createComplianceAuditReceipt({
      kind: 'DECISION',
      decisionRef,
      outcome: 'DENY',
      reasonCode,
      reason,
      recordedAt: receipts[0]?.recordedAt ?? ('2026-01-01T00:00:00.000Z' as UtcInstant),
    });
    receipts.push(decisionReceipt);
    this.#receipts.record(decisionReceipt);

    return Object.freeze({
      outcome: 'DENY',
      reasonCode,
      reason,
      receipts: Object.freeze(receipts),
      blockedBy,
    });
  }
}

export function createRegulatoryControlEngine(
  options?: RegulatoryControlEngineOptions,
): RegulatoryControlEngine {
  return new RegulatoryControlEngine(options);
}
