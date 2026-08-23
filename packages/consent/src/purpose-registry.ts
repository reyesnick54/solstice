import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import type { DataCategory, SensitivityClass } from '../../personal-data-vault/src/taxonomy.ts';
import { asPurposeId, asPurposePolicyId, asPurposeVersion, purposeIdFor, purposeVersionFor } from './ids.ts';
import type { PurposeRecord } from './types.ts';
import {
  type ConsentOperation,
  type LegalHookStatus,
  type OnwardSharingState,
  type PurposeCategory,
  type PurposeCode,
  PURPOSE_CODES,
} from './taxonomy.ts';

const EPOCH = asUtcInstant('2026-01-01T00:00:00.000Z');

type PurposeSeed = {
  readonly code: PurposeCode;
  readonly description: string;
  readonly category: PurposeCategory;
  readonly allowedCategories: readonly DataCategory[];
  readonly allowedOperations: readonly ConsentOperation[];
  readonly expectedRecipientKind: PurposeRecord['expectedRecipientKind'];
  readonly retentionExpectationDays: number | null;
  readonly onwardSharing: OnwardSharingState;
  readonly maxSensitivity: SensitivityClass;
  readonly legalHook: LegalHookStatus;
};

const SEEDS: readonly PurposeSeed[] = Object.freeze([
  {
    code: 'CORE_ACCOUNT_SERVICE',
    description: 'Operate the subject\'s own SunRey account, balances, and required regulatory records.',
    category: 'CORE_SERVICE',
    allowedCategories: ['IDENTITY_ATTRIBUTE', 'TRANSACTION_DATA', 'PAYROLL_DATA', 'EXTERNAL_FINANCIAL_ACCOUNT_DATA'],
    allowedOperations: ['READ', 'DERIVE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 365,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'HIGHLY_SENSITIVE',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'PERSONAL_BUDGET_ANALYSIS',
    description: 'Analyse the subject\'s own budget and spending patterns for that subject.',
    category: 'SUBJECT_ANALYSIS',
    allowedCategories: ['TRANSACTION_DATA', 'PURCHASE_HISTORY', 'PREFERENCE_DATA'],
    allowedOperations: ['READ', 'DERIVE', 'AGGREGATE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 90,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'SENSITIVE',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'PERSONAL_ECONOMIC_GRAPH_DERIVATION',
    description: 'Derive Personal Economic Graph nodes from vault metadata without copying raw payload.',
    category: 'GRAPH_DERIVATION',
    allowedCategories: ['TRANSACTION_DATA', 'PAYROLL_DATA', 'PREFERENCE_DATA', 'PURCHASE_HISTORY'],
    allowedOperations: ['DERIVE', 'AGGREGATE', 'READ'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 180,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'HIGHLY_SENSITIVE',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'PERSONAL_AGENT_ANALYSIS',
    description: 'Allow the Personal Economy Agent to read purpose-scoped derived summaries.',
    category: 'AGENT_ANALYSIS',
    allowedCategories: ['PAYROLL_DATA', 'TRANSACTION_DATA', 'PREFERENCE_DATA'],
    allowedOperations: ['READ', 'DERIVE', 'AGGREGATE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 30,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'HIGHLY_SENSITIVE',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'PERSONALIZATION',
    description: 'Optional personalization of the subject\'s own SunRey experience. Not economic licensing.',
    category: 'PERSONALIZATION',
    allowedCategories: ['PREFERENCE_DATA', 'DEVICE_ACTIVITY_SUMMARY', 'USER_DECLARED_DATA'],
    allowedOperations: ['READ', 'DERIVE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 180,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'PERSONAL',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'ANALYTICS',
    description: 'Optional first-party product analytics. Not targeted advertising and not licensing.',
    category: 'ANALYTICS',
    allowedCategories: ['DEVICE_ACTIVITY_SUMMARY', 'PREFERENCE_DATA'],
    allowedOperations: ['AGGREGATE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 90,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'PERSONAL',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'PRODUCT_IMPROVEMENT_RESEARCH',
    description: 'Internal product-improvement research. Never implied by subject-analysis consent.',
    category: 'PRODUCT_RESEARCH',
    allowedCategories: ['PREFERENCE_DATA', 'DEVICE_ACTIVITY_SUMMARY'],
    allowedOperations: ['AGGREGATE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 30,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'PERSONAL',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    code: 'AGGREGATED_RESEARCH',
    description: 'Aggregated research over consented derived facts. Not targeted advertising.',
    category: 'AGGREGATED_RESEARCH',
    allowedCategories: ['TRANSACTION_DATA', 'PREFERENCE_DATA'],
    allowedOperations: ['AGGREGATE'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 90,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'SENSITIVE',
    legalHook: 'RESEARCH_REQUIRED',
  },
  {
    code: 'DATA_CONTRIBUTION_RESEARCH',
    description: 'Future controlled data contribution. Consent does not execute external sharing.',
    category: 'DATA_CONTRIBUTION',
    allowedCategories: ['TRANSACTION_DATA', 'PREFERENCE_DATA', 'DATA_CONTRIBUTION_CANDIDATE'],
    allowedOperations: ['CONTRIBUTE', 'AGGREGATE'],
    expectedRecipientKind: 'EXTERNAL_RESEARCH_PARTNER',
    retentionExpectationDays: 30,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'SENSITIVE',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    code: 'HIN_PARTICIPATION',
    description: 'Optional Human Information Network participation. Withdrawing does not close SunRey financial services.',
    category: 'HIN_PARTICIPATION',
    allowedCategories: ['TRANSACTION_DATA', 'PREFERENCE_DATA', 'DATA_CONTRIBUTION_CANDIDATE', 'DEVICE_ACTIVITY_SUMMARY'],
    allowedOperations: ['AGGREGATE', 'CONTRIBUTE'],
    expectedRecipientKind: 'EXTERNAL_RESEARCH_PARTNER',
    retentionExpectationDays: 90,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'SENSITIVE',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    code: 'MARKETING',
    description: 'Optional marketing communications where a jurisdiction pack allows them. Never required for account use.',
    category: 'MARKETING',
    allowedCategories: ['PREFERENCE_DATA', 'IDENTITY_ATTRIBUTE'],
    allowedOperations: ['READ'],
    expectedRecipientKind: 'SOLSTICE_SERVICE',
    retentionExpectationDays: 30,
    onwardSharing: 'NOT_ALLOWED',
    maxSensitivity: 'PERSONAL',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
  },
]);

export function simulationPurposes(createdAt: UtcInstant = EPOCH): readonly PurposeRecord[] {
  return Object.freeze(
    SEEDS.map((seed) =>
      Object.freeze({
        purposeId: purposeIdFor(seed.code),
        purposeVersion: purposeVersionFor(seed.code, 1),
        versionNumber: 1,
        code: seed.code,
        description: seed.description,
        category: seed.category,
        allowedCategories: Object.freeze([...seed.allowedCategories]),
        allowedOperations: Object.freeze([...seed.allowedOperations]),
        expectedRecipientKind: seed.expectedRecipientKind,
        retentionExpectationDays: seed.retentionExpectationDays,
        onwardSharing: seed.onwardSharing,
        maxSensitivity: seed.maxSensitivity,
        status: 'ACTIVE' as const,
        legalHook: seed.legalHook,
        createdAt,
      }),
    ),
  );
}

export class PurposeRegistry {
  private readonly byVersion = new Map<string, PurposeRecord>();
  private readonly current = new Map<string, PurposeRecord>();

  constructor(records: readonly PurposeRecord[] = simulationPurposes()) {
    for (const record of records) {
      this.put(record);
    }
  }

  put(record: PurposeRecord): void {
    this.byVersion.set(record.purposeVersion, record);
    const existing = this.current.get(record.purposeId);
    if (!existing || record.versionNumber >= existing.versionNumber) {
      this.current.set(record.purposeId, record);
    }
  }

  getByCode(code: PurposeCode): PurposeRecord | undefined {
    return this.current.get(purposeIdFor(code));
  }

  getById(purposeId: string): PurposeRecord | undefined {
    return this.current.get(asPurposeId(purposeId));
  }

  getVersion(purposeVersion: string): PurposeRecord | undefined {
    return this.byVersion.get(asPurposeVersion(purposeVersion));
  }

  resolve(ref: string): PurposeRecord | undefined {
    if (PURPOSE_CODES.includes(ref as PurposeCode)) {
      return this.getByCode(ref as PurposeCode);
    }
    if (ref.startsWith('purv_')) {
      return this.getVersion(ref);
    }
    if (ref.startsWith('pur_')) {
      return this.getById(ref);
    }
    return undefined;
  }

  versionPurpose(current: PurposeRecord, next: Omit<PurposeRecord, 'purposeId' | 'purposeVersion' | 'versionNumber' | 'code'>): PurposeRecord {
    const created: PurposeRecord = Object.freeze({
      ...next,
      purposeId: current.purposeId,
      purposeVersion: purposeVersionFor(current.code, current.versionNumber + 1),
      versionNumber: current.versionNumber + 1,
      code: current.code,
    });
    this.put({ ...current, status: 'SUPERSEDED' });
    this.put(created);
    return created;
  }

  list(): readonly PurposeRecord[] {
    return Object.freeze([...this.byVersion.values()]);
  }

  policyIdFor(record: PurposeRecord): ReturnType<typeof asPurposePolicyId> {
    return asPurposePolicyId(`pol_${record.code.toLowerCase()}_v${record.versionNumber}`);
  }
}
