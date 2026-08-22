const SENSITIVE = /documentImage|selfie|passport|nationalId|ssn|taxId|legalName|dateOfBirth|articleBody|matchRule/i;
const SECRET_RULE = /secret database|rule [A-Z0-9_-]{6,}|sanctions score \d+/i;

export type RedactedComplianceLog = {
  readonly providerId: string;
  readonly findingKind: string;
  readonly subjectRef: string;
  readonly matchState: string | null;
  readonly reasonCodes: readonly string[];
  readonly scoreOmitted: true;
  readonly rawIdentityPayloadPresent: false;
};

export function redactComplianceLog(input: {
  readonly providerId: string;
  readonly findingKind: string;
  readonly subjectRef: string;
  readonly matchState: string | null;
  readonly reasonCodes: readonly string[];
}): RedactedComplianceLog {
  return Object.freeze({
    providerId: input.providerId,
    findingKind: input.findingKind,
    subjectRef: input.subjectRef,
    matchState: input.matchState,
    reasonCodes: Object.freeze(input.reasonCodes.filter((code) => !SECRET_RULE.test(code))),
    scoreOmitted: true,
    rawIdentityPayloadPresent: false,
  });
}

export function assertNoSensitiveComplianceLog(payload: unknown): void {
  const serialized = JSON.stringify(payload ?? {});
  if (SENSITIVE.test(serialized) || SECRET_RULE.test(serialized)) {
    throw new Error('compliance logs must not contain identity payloads or secret matching logic');
  }
}

export function clientMaySeeInternalMatchLogic(): false {
  return false;
}
