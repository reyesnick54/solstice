import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DocumentVerificationProvider, IdentityVerificationResult } from '../ports.ts';
import { containsRawSensitiveMaterial, normalizeIdentityVendorResponse } from './normalization.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';
import type { FakeIdentityTransport } from './transport.ts';

export class FixtureDocumentVerificationProvider implements DocumentVerificationProvider {
  readonly #persisted = new Map<string, { readonly documentRef: string; readonly rawDocumentPersisted: false }>();

  readonly #transport: FakeIdentityTransport;
  constructor(transport: FakeIdentityTransport) {
    this.#transport = transport;
  }

  verifyDocument(documentRef: string, now: UtcInstant): IdentityVerificationResult {
    const raw = this.#transport.exchange({
      capability: 'DOCUMENT_VERIFICATION',
      subjectRef: documentRef,
    });
    if (containsRawSensitiveMaterial(raw) || documentRef.includes('raw-image')) {
      return Object.freeze({
        providerRef: `${FIXTURE_IDENTITY_PROVIDER_ID}:document:${documentRef}`,
        outcome: 'FAILED',
        reasonCodes: Object.freeze(['RAW_DOCUMENT_REJECTED']),
        evidenceRefs: Object.freeze([`doc-ref:${documentRef}`]),
        observedAt: now,
      });
    }
    const result = normalizeIdentityVendorResponse(raw, {
      providerRef: `${FIXTURE_IDENTITY_PROVIDER_ID}:document:${documentRef}`,
      now,
    });
    this.#persisted.set(documentRef, Object.freeze({ documentRef, rawDocumentPersisted: false }));
    return result;
  }

  persisted(documentRef: string): { readonly documentRef: string; readonly rawDocumentPersisted: false } | undefined {
    return this.#persisted.get(documentRef);
  }
}
