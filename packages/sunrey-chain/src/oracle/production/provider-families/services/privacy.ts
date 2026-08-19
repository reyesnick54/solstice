/**
 * Digital and professional service privacy.
 *
 * Economic metering only. Customer content, prompts, documents, private
 * inputs, API payload bodies, emails, phones, and support-chat content
 * are refused — not redacted into storage.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  HUMAN_WORTH_SCORING,
  INVOICE_EQUALS_COMPLETED_SERVICE,
  type PublicServiceEvidence,
  type ServiceRefusal,
  type ServiceSourceObservation,
} from './types.ts';

const PAYLOAD_KEY_HINTS = [
  'prompt',
  'payload',
  'payloadbody',
  'requestbody',
  'customercontent',
  'document',
  'privateinput',
  'supportchat',
] as const;

const PII_KEY_HINTS = ['customername', 'email', 'phone', 'chatcontent'] as const;

const CREDENTIAL_KEY_HINTS = ['apikey', 'password', 'secret', 'authorization', 'cardnumber', 'cvv'] as const;

function normalizedKey(key: string): string {
  return key.replace(/[^A-Za-z]/g, '').toLowerCase();
}

export function refuseServicePrivacyLeaks(observation: ServiceSourceObservation): Result<true, ServiceRefusal> {
  if (observation.promptContent || observation.payloadBody || observation.customerContent || observation.supportChatContent) {
    return err({
      code: 'PAYLOAD_FORBIDDEN',
      detail: 'digital service evidence stores metering only; payloads, prompts, and private inputs are forbidden',
    });
  }
  if (observation.rawCustomerName || observation.rawEmail || observation.rawPhone) {
    return err({
      code: 'CUSTOMER_PII_FORBIDDEN',
      detail: 'customer names, emails, and phones are not economic evidence',
    });
  }
  for (const key of Object.keys(observation.extras ?? {})) {
    const normalized = normalizedKey(key);
    if (PAYLOAD_KEY_HINTS.some((hint) => normalized.includes(hint))) {
      return err({ code: 'PAYLOAD_FORBIDDEN', detail: `extras must not include ${key}` });
    }
    if (PII_KEY_HINTS.some((hint) => normalized.includes(hint))) {
      return err({ code: 'CUSTOMER_PII_FORBIDDEN', detail: `extras must not include ${key}` });
    }
    if (CREDENTIAL_KEY_HINTS.some((hint) => normalized.includes(hint))) {
      return err({ code: 'PAYMENT_CREDENTIAL_FORBIDDEN', detail: `extras must not include ${key}` });
    }
  }
  return ok(true);
}

export function publicEvidenceFrom(observation: ServiceSourceObservation): PublicServiceEvidence {
  return Object.freeze({
    observationId: observation.observationId,
    sourceClass: observation.sourceClass,
    factType: 'SERVICE_DELIVERY',
    claimType: 'DELIVERY',
    productiveCategory: 'SERVICES',
    serviceKind: observation.serviceKind,
    completionState: observation.completionState,
    unit: observation.unit,
    mantissa: observation.numericValue,
    durationSeconds: observation.durationSeconds,
    identity: Object.freeze({ ...observation.identity }),
    historicalMachineHourRecord: observation.historicalMachineHourRecord,
    containsPayload: false,
    containsCustomerPii: false,
    humanWorthScoring: HUMAN_WORTH_SCORING,
    invoiceEqualsCompletion: INVOICE_EQUALS_COMPLETED_SERVICE,
    mintsMoonRey: false,
  });
}

export function publicEvidenceHidesPayload(evidence: PublicServiceEvidence): boolean {
  const encoded = JSON.stringify(evidence).toLowerCase();
  return (
    evidence.containsPayload === false &&
    !encoded.includes('prompt') &&
    !encoded.includes('payload') &&
    !encoded.includes('you are a helpful')
  );
}
