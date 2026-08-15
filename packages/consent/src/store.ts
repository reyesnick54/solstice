import type {
  ConsentDecision,
  ConsentLedgerEntry,
  ConsentReceipt,
  ConsentRecord,
  ConsentRevocation,
  ConsentStoreSnapshot,
  DataUsePermit,
  PurposeRecord,
  RecipientRecord,
} from './types.ts';

export class ConsentStore {
  private readonly records = new Map<string, ConsentRecord>();
  private readonly receipts = new Map<string, ConsentReceipt>();
  private readonly revocations = new Map<string, ConsentRevocation>();
  private readonly decisions: ConsentDecision[] = [];
  private readonly permits = new Map<string, DataUsePermit>();
  private readonly ledger: ConsentLedgerEntry[] = [];
  private readonly purposes = new Map<string, PurposeRecord>();
  private readonly recipients = new Map<string, RecipientRecord>();
  private readonly grantIdempotency = new Map<string, string>();
  private readonly revokeIdempotency = new Map<string, string>();
  private readonly locks = new Map<string, number>();

  putRecord(record: ConsentRecord): void {
    this.records.set(`${record.consentId}:${record.version}`, record);
  }

  currentForId(consentId: string): ConsentRecord | undefined {
    const versions = [...this.records.values()].filter((row) => row.consentId === consentId);
    if (versions.length === 0) {
      return undefined;
    }
    return versions.reduce((latest, row) => (row.versionSequence > latest.versionSequence ? row : latest));
  }

  getVersion(consentId: string, version: string): ConsentRecord | undefined {
    return this.records.get(`${consentId}:${version}`);
  }

  listForSubject(subjectId: string): readonly ConsentRecord[] {
    const latest = new Map<string, ConsentRecord>();
    for (const record of this.records.values()) {
      if (record.subjectId !== subjectId) {
        continue;
      }
      const existing = latest.get(record.consentId);
      if (!existing || record.versionSequence > existing.versionSequence) {
        latest.set(record.consentId, record);
      }
    }
    return Object.freeze([...latest.values()]);
  }

  allForSubject(subjectId: string): readonly ConsentRecord[] {
    return Object.freeze([...this.records.values()].filter((row) => row.subjectId === subjectId));
  }

  putReceipt(receipt: ConsentReceipt): void {
    this.receipts.set(receipt.receiptId, receipt);
  }

  getReceipt(receiptId: string): ConsentReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  receiptForConsent(consentId: string, version: string): ConsentReceipt | undefined {
    return [...this.receipts.values()].find((row) => row.consentId === consentId && row.version === version);
  }

  putRevocation(revocation: ConsentRevocation): void {
    this.revocations.set(revocation.revocationId, revocation);
  }

  putDecision(decision: ConsentDecision): void {
    this.decisions.push(decision);
  }

  decisionsForConsent(consentId: string): readonly ConsentDecision[] {
    return Object.freeze(this.decisions.filter((row) => row.consentId === consentId));
  }

  putPermit(permit: DataUsePermit): void {
    this.permits.set(permit.permitId, permit);
  }

  getPermit(permitId: string): DataUsePermit | undefined {
    return this.permits.get(permitId);
  }

  appendLedger(entry: ConsentLedgerEntry): void {
    this.ledger.push(entry);
  }

  ledgerEntries(): readonly ConsentLedgerEntry[] {
    return Object.freeze([...this.ledger]);
  }

  lastLedgerHash(): string | null {
    return this.ledger.at(-1)?.hash ?? null;
  }

  nextLedgerSequence(): number {
    return this.ledger.length + 1;
  }

  putPurpose(record: PurposeRecord): void {
    this.purposes.set(record.purposeVersion, record);
  }

  putRecipient(record: RecipientRecord): void {
    this.recipients.set(record.recipientId, record);
  }

  rememberGrant(key: string, consentId: string): void {
    this.grantIdempotency.set(key, consentId);
  }

  grantForKey(key: string): string | undefined {
    return this.grantIdempotency.get(key);
  }

  rememberRevoke(key: string, revocationId: string): void {
    this.revokeIdempotency.set(key, revocationId);
  }

  revokeForKey(key: string): string | undefined {
    return this.revokeIdempotency.get(key);
  }

  acquire(consentId: string): number {
    const next = (this.locks.get(consentId) ?? 0) + 1;
    this.locks.set(consentId, next);
    return next;
  }

  snapshot(): ConsentStoreSnapshot {
    return Object.freeze({
      records: Object.freeze([...this.records.values()]),
      receipts: Object.freeze([...this.receipts.values()]),
      revocations: Object.freeze([...this.revocations.values()]),
      decisions: Object.freeze([...this.decisions]),
      permits: Object.freeze([...this.permits.values()]),
      ledger: Object.freeze([...this.ledger]),
      purposes: Object.freeze([...this.purposes.values()]),
      recipients: Object.freeze([...this.recipients.values()]),
      grantIdempotency: Object.freeze(Object.fromEntries(this.grantIdempotency)),
      revokeIdempotency: Object.freeze(Object.fromEntries(this.revokeIdempotency)),
    });
  }

  restore(state: ConsentStoreSnapshot): void {
    this.records.clear();
    this.receipts.clear();
    this.revocations.clear();
    this.decisions.length = 0;
    this.permits.clear();
    this.ledger.length = 0;
    this.purposes.clear();
    this.recipients.clear();
    this.grantIdempotency.clear();
    this.revokeIdempotency.clear();
    for (const record of state.records) {
      this.putRecord(record);
    }
    for (const receipt of state.receipts) {
      this.putReceipt(receipt);
    }
    for (const revocation of state.revocations) {
      this.putRevocation(revocation);
    }
    for (const decision of state.decisions) {
      this.putDecision(decision);
    }
    for (const permit of state.permits) {
      this.putPermit(permit);
    }
    for (const entry of state.ledger) {
      this.appendLedger(entry);
    }
    for (const purpose of state.purposes) {
      this.putPurpose(purpose);
    }
    for (const recipient of state.recipients) {
      this.putRecipient(recipient);
    }
    for (const [key, value] of Object.entries(state.grantIdempotency)) {
      this.grantIdempotency.set(key, value);
    }
    for (const [key, value] of Object.entries(state.revokeIdempotency)) {
      this.revokeIdempotency.set(key, value);
    }
  }
}
