import type { Account } from '../../../domain/src/account.ts';
import type { Customer } from '../../../domain/src/customer.ts';
import type { LegalEntity } from '../../../domain/src/legal-entity.ts';
import type { Product } from '../../../domain/src/product.ts';
import type { EvidenceRecord } from '../../../evidence/src/vault.ts';
import type { DomainEvent } from '../../../events/src/events.ts';
import type { Journal, LedgerAccount } from '../../../ledger/src/types.ts';
import type { PersistedPolicyState } from '../policy/store.ts';
import type { ActionIntent } from '../../../permissions/src/action-intent.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';

export type PersistedOpenOutcome = {
  readonly intentId: string;
  readonly outcome: 'OPENED' | 'KERNEL_REFUSED' | 'REJECTED';
  readonly accountId: string | null;
  readonly decisionStatus: string;
  readonly evidenceRecordId: string;
  readonly code: string | null;
  readonly message: string | null;
};

export type AuthorityAudit = {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly amountMinorUnits: string | null;
  readonly amountCurrency: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signatureSha256: string;
};

export type LoadedPersistence = {
  readonly customers: readonly Customer[];
  readonly legalEntities: readonly LegalEntity[];
  readonly products: readonly Product[];
  readonly accounts: readonly Account[];
  readonly ledgerAccounts: readonly LedgerAccount[];
  readonly journals: readonly Journal[];
  readonly evidence: readonly EvidenceRecord[];
  readonly events: readonly DomainEvent[];
  readonly intents: readonly ActionIntent[];
  readonly authorities: readonly AuthorityAudit[];
  readonly openOutcomes: readonly PersistedOpenOutcome[];
  readonly policy: PersistedPolicyState;
};
