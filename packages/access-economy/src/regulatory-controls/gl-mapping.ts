// @ts-nocheck
/**
 * ACCESS Wave 5 — Configurable general-ledger mapping foundation.
 *
 * Accountants assign real chart-of-accounts numbers. This module stores
 * conceptual role mappings only.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { ACCESS_GL_ACCOUNT_ROLES } from './taxonomy.ts';
import type { AccessGlAccountRole, AccessGlMapping } from './types.ts';

export const DEFAULT_ACCESS_GL_MAPPINGS: readonly AccessGlMapping[] = Object.freeze(
  ACCESS_GL_ACCOUNT_ROLES.map((accountRole) => {
    const base = glMappingDefaults(accountRole);
    return Object.freeze({
      mappingId: `glm_${accountRole.toLowerCase()}`,
      accountRole,
      accountCodePlaceholder: base.code,
      accountName: base.name,
      debitOnEventTypes: Object.freeze([...base.debitOn]),
      creditOnEventTypes: Object.freeze([...base.creditOn]),
      notes: base.notes,
      effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
      status: 'DRAFT' as const,
    });
  }),
);

function glMappingDefaults(role: AccessGlAccountRole): {
  readonly code: string;
  readonly name: string;
  readonly debitOn: readonly import('./taxonomy.ts').AccessAccountingEventType[];
  readonly creditOn: readonly import('./taxonomy.ts').AccessAccountingEventType[];
  readonly notes: string;
} {
  switch (role) {
    case 'ACCESS_PROGRAM_CASH':
      return {
        code: 'TBD-ACCESS-CASH',
        name: 'Access Program Cash',
        debitOn: ['ACCESS_FUNDING_RECEIVED'],
        creditOn: ['ACCESS_PROVIDER_PAYMENT_CAPTURED', 'ACCESS_USER_REFUND_ISSUED'],
        notes: 'Cash funding received for Access program settlement',
      };
    case 'ACCESS_SETTLEMENT_PAYABLE':
      return {
        code: 'TBD-ACCESS-PAYABLE',
        name: 'Access Settlement Payable',
        debitOn: ['ACCESS_PROVIDER_PAYMENT_CAPTURED'],
        creditOn: ['ACCESS_PROVIDER_PAYMENT_AUTHORIZED'],
        notes: 'Provider settlement obligation pending capture',
      };
    case 'USER_COPAY_CLEARING':
      return {
        code: 'TBD-USER-COPAY',
        name: 'User Co-Pay Clearing',
        debitOn: ['ACCESS_USER_COPAY_CAPTURED'],
        creditOn: ['ACCESS_USER_COPAY_AUTHORIZED'],
        notes: 'User fiat contribution clearing',
      };
    case 'PROVIDER_SETTLEMENT_CLEARING':
      return {
        code: 'TBD-PROVIDER-CLEARING',
        name: 'Provider Settlement Clearing',
        debitOn: ['ACCESS_PROVIDER_PAYMENT_CAPTURED'],
        creditOn: ['ACCESS_PROVIDER_PAYMENT_AUTHORIZED'],
        notes: 'In-flight provider settlement',
      };
    case 'REFUND_RECEIVABLE':
      return {
        code: 'TBD-REFUND-RECV',
        name: 'Refund Receivable',
        debitOn: ['ACCESS_PROVIDER_REFUND_RECEIVED'],
        creditOn: ['ACCESS_USER_REFUND_ISSUED'],
        notes: 'Provider refund pending user restoration',
      };
    case 'ACCESS_PROMOTIONAL_EXPENSE':
      return {
        code: 'TBD-PROMO-EXP',
        name: 'Access Promotional Expense',
        debitOn: ['ACCESS_PROVIDER_PAYMENT_CAPTURED'],
        creditOn: ['ACCESS_FUNDING_RECEIVED'],
        notes: 'Promotional budget consumption',
      };
    case 'PROVIDER_DISCOUNT_BENEFIT':
      return {
        code: 'TBD-DISCOUNT',
        name: 'Provider Discount Benefit',
        debitOn: ['ACCESS_PROVIDER_PAYMENT_CAPTURED'],
        creditOn: ['ACCESS_FUNDING_RECEIVED'],
        notes: 'Provider discount capacity — not unrestricted cash',
      };
    case 'SPONSOR_FUNDING':
      return {
        code: 'TBD-SPONSOR',
        name: 'Sponsor Funding',
        debitOn: ['ACCESS_FUNDING_RECEIVED'],
        creditOn: ['ACCESS_FUNDING_RELEASED'],
        notes: 'Restricted sponsor program funding',
      };
    case 'EMPLOYER_PROGRAM_FUNDING':
      return {
        code: 'TBD-EMPLOYER',
        name: 'Employer Program Funding',
        debitOn: ['ACCESS_FUNDING_RECEIVED'],
        creditOn: ['ACCESS_FUNDING_RELEASED'],
        notes: 'Restricted employer program funding',
      };
    case 'GOVERNMENT_PROGRAM_FUNDING':
      return {
        code: 'TBD-GOV',
        name: 'Government Program Funding',
        debitOn: ['ACCESS_FUNDING_RECEIVED'],
        creditOn: ['ACCESS_FUNDING_RELEASED'],
        notes: 'Restricted government program funding',
      };
    case 'SUBSCRIPTION_PROGRAM_FUNDING':
      return {
        code: 'TBD-SUB-FUND',
        name: 'Subscription Program Funding',
        debitOn: ['ACCESS_FUNDING_RECEIVED'],
        creditOn: ['ACCESS_FUNDING_RELEASED'],
        notes: 'Program funding revenue — not bank deposit or stored value',
      };
    case 'ACCESS_SERVICE_FEE_REVENUE':
      return {
        code: 'TBD-ACCESS-FEE',
        name: 'Access Service Fee Revenue',
        debitOn: [],
        creditOn: ['ACCESS_USER_COPAY_CAPTURED'],
        notes: 'Explicit Access service fees only; default zero at launch',
      };
    default:
      return {
        code: 'TBD',
        name: role,
        debitOn: [],
        creditOn: [],
        notes: 'placeholder mapping for accountant review',
      };
  }
}

export class AccessGlMappingRegistry {
  private readonly mappings: Map<string, AccessGlMapping>;

  constructor(seed: readonly AccessGlMapping[] = DEFAULT_ACCESS_GL_MAPPINGS) {
    this.mappings = new Map(seed.map((row) => [row.mappingId, row]));
  }

  get(mappingId: string): AccessGlMapping | undefined {
    return this.mappings.get(mappingId);
  }

  byRole(role: AccessGlAccountRole): AccessGlMapping | undefined {
    return [...this.mappings.values()].find((row) => row.accountRole === role);
  }

  list(): readonly AccessGlMapping[] {
    return Object.freeze([...this.mappings.values()]);
  }

  upsert(mapping: AccessGlMapping): AccessGlMapping {
    this.mappings.set(mapping.mappingId, mapping);
    return mapping;
  }
}
