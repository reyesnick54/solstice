/**
 * Wave 7 — Configurable retention semantics.
 *
 * Respects append-only financial history. Canonical ledger, Evidence Vault,
 * and transaction records are immutable — ordinary retention cannot delete them.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  IMMUTABLE_RETENTION_CATEGORIES,
  LEGAL_REVIEW_STATUS,
  type RetentionCategory,
} from './taxonomy.ts';
import type { LegalHoldRecord, RetentionPolicyRule } from './types.ts';

export const DEFAULT_RETENTION_RULES: readonly RetentionPolicyRule[] = Object.freeze([
  Object.freeze({
    ruleId: 'retention.transaction_records.v1',
    category: 'TRANSACTION_RECORDS',
    retentionDays: null,
    immutable: true,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.ledger_records.v1',
    category: 'LEDGER_RECORDS',
    retentionDays: null,
    immutable: true,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.evidence_vault.v1',
    category: 'EVIDENCE_VAULT',
    retentionDays: null,
    immutable: true,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.raw_provider_responses.v1',
    category: 'RAW_PROVIDER_RESPONSES',
    retentionDays: 90,
    immutable: false,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.personal_data.v1',
    category: 'PERSONAL_DATA',
    retentionDays: 730,
    immutable: false,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.consent_records.v1',
    category: 'CONSENT_RECORDS',
    retentionDays: null,
    immutable: false,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.usage_receipts.v1',
    category: 'USAGE_RECEIPTS',
    retentionDays: 365,
    immutable: false,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.logs.v1',
    category: 'LOGS',
    retentionDays: 180,
    immutable: false,
    legalHoldBlocksDeletion: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    ruleId: 'retention.temporary_caches.v1',
    category: 'TEMPORARY_CACHES',
    retentionDays: 7,
    immutable: false,
    legalHoldBlocksDeletion: false,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
]);

export type RetentionEvaluationInput = {
  readonly category: RetentionCategory;
  readonly recordCreatedAt: UtcInstant;
  readonly at: UtcInstant;
  readonly activeLegalHolds: readonly LegalHoldRecord[];
};

export type RetentionEvaluationResult = {
  readonly category: RetentionCategory;
  readonly expired: boolean;
  readonly deletable: boolean;
  readonly immutable: boolean;
  readonly blockedByLegalHold: boolean;
  readonly reasonCode: string;
  readonly reason: string;
};

export class RetentionPolicyRegistry {
  private readonly rules: Map<RetentionCategory, RetentionPolicyRule>;

  constructor(seed: readonly RetentionPolicyRule[] = DEFAULT_RETENTION_RULES) {
    this.rules = new Map(seed.map((rule) => [rule.category, rule]));
  }

  ruleFor(category: RetentionCategory): RetentionPolicyRule | undefined {
    return this.rules.get(category);
  }

  evaluate(input: RetentionEvaluationInput): RetentionEvaluationResult {
    const rule = this.rules.get(input.category);
    if (!rule) {
      return Object.freeze({
        category: input.category,
        expired: false,
        deletable: false,
        immutable: IMMUTABLE_RETENTION_CATEGORIES.includes(input.category),
        blockedByLegalHold: false,
        reasonCode: 'RETENTION_RULE_UNKNOWN',
        reason: `no retention rule for category ${input.category}`,
      });
    }

    const blockedByLegalHold = input.activeLegalHolds.some(
      (hold) => hold.active && hold.recordCategories.includes(input.category),
    );

    if (rule.immutable || IMMUTABLE_RETENTION_CATEGORIES.includes(input.category)) {
      return Object.freeze({
        category: input.category,
        expired: false,
        deletable: false,
        immutable: true,
        blockedByLegalHold,
        reasonCode: 'RETENTION_IMMUTABLE',
        reason: `${input.category} is immutable — financial/blockchain history protected`,
      });
    }

    if (blockedByLegalHold) {
      return Object.freeze({
        category: input.category,
        expired: false,
        deletable: false,
        immutable: false,
        blockedByLegalHold: true,
        reasonCode: 'RETENTION_LEGAL_HOLD',
        reason: 'active legal hold prevents deletion',
      });
    }

    if (rule.retentionDays === null) {
      return Object.freeze({
        category: input.category,
        expired: false,
        deletable: false,
        immutable: false,
        blockedByLegalHold: false,
        reasonCode: 'RETENTION_INDEFINITE',
        reason: 'no expiry configured — record retained',
      });
    }

    const createdMs = Date.parse(input.recordCreatedAt);
    const atMs = Date.parse(input.at);
    const ageDays = (atMs - createdMs) / (1000 * 60 * 60 * 24);
    const expired = ageDays > rule.retentionDays;

    return Object.freeze({
      category: input.category,
      expired,
      deletable: expired,
      immutable: false,
      blockedByLegalHold: false,
      reasonCode: expired ? 'RETENTION_EXPIRED' : 'RETENTION_ACTIVE',
      reason: expired
        ? `record exceeded ${rule.retentionDays} day retention period`
        : `record within ${rule.retentionDays} day retention period`,
    });
  }
}
