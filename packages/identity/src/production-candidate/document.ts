import type { UtcInstant } from '../../../domain/src/time.ts';
import { containsSensitiveIdentityMaterial } from './privacy.ts';
import type { IdentityAdapterStore } from './store.ts';
import type {
  DocumentAuthenticity,
  DocumentType,
  DocumentVerificationRecord,
  IdentityAdapterProfile,
} from './types.ts';

export type RequestDocumentVerificationInput = {
  readonly documentRef: string;
  readonly documentType: DocumentType;
  readonly country: string;
  readonly now: UtcInstant;
  readonly storageRef?: string;
  readonly rawPayload?: unknown;
};

export type DocumentVerificationPort = {
  requestDocumentVerification(input: RequestDocumentVerificationInput): DocumentVerificationRecord;
  retrieveDocumentVerification(documentRef: string): DocumentVerificationRecord | undefined;
};

export class DocumentVerificationAdapter implements DocumentVerificationPort {
  constructor(
    private readonly store: IdentityAdapterStore,
    private readonly profile: IdentityAdapterProfile,
    private readonly authenticityFor: (documentRef: string) => DocumentAuthenticity,
  ) {}

  requestDocumentVerification(input: RequestDocumentVerificationInput): DocumentVerificationRecord {
    if (input.rawPayload !== undefined && containsSensitiveIdentityMaterial(input.rawPayload)) {
      const rejected: DocumentVerificationRecord = Object.freeze({
        documentRef: input.documentRef,
        providerRef: `${this.profile.providerId}:document:${input.documentRef}`,
        documentType: input.documentType,
        country: input.country,
        authenticity: 'FAILED',
        expired: false,
        nameMatch: null,
        dateMatch: null,
        storageRef: input.storageRef ?? `secure-store:${input.documentRef}`,
        imageRetained: false,
        reasonCodes: Object.freeze(['RAW_DOCUMENT_REJECTED']),
        observedAt: input.now,
      });
      this.store.documents.set(rejected.documentRef, rejected);
      return rejected;
    }
    const authenticity = this.authenticityFor(input.documentRef);
    const record: DocumentVerificationRecord = Object.freeze({
      documentRef: input.documentRef,
      providerRef: `${this.profile.providerId}:document:${input.documentRef}`,
      documentType: input.documentType,
      country: input.country,
      authenticity,
      expired: input.documentRef.includes('expired'),
      nameMatch: authenticity === 'AUTHENTIC' ? true : authenticity === 'FAILED' ? false : null,
      dateMatch: authenticity === 'AUTHENTIC' ? true : authenticity === 'FAILED' ? false : null,
      storageRef: input.storageRef ?? `secure-store:${input.documentRef}`,
      imageRetained: false,
      reasonCodes: Object.freeze(
        authenticity === 'AUTHENTIC'
          ? ['DOCUMENT_VERIFIED']
          : authenticity === 'FAILED'
            ? ['DOCUMENT_FAILURE']
            : ['DOCUMENT_INCONCLUSIVE'],
      ),
      observedAt: input.now,
    });
    this.store.documents.set(record.documentRef, record);
    return record;
  }

  retrieveDocumentVerification(documentRef: string): DocumentVerificationRecord | undefined {
    return this.store.documents.get(documentRef);
  }
}
