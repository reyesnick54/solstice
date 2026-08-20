import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityVerificationResult, LivenessVerificationProvider } from '../ports.ts';
import { assertNoSensitiveIdentityLog, normalizeIdentityVendorResponse } from './normalization.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';
import type { FakeIdentityTransport } from './transport.ts';

export class FixtureLivenessVerificationProvider implements LivenessVerificationProvider {
  readonly #logs: unknown[] = [];

  readonly #transport: FakeIdentityTransport;
  constructor(transport: FakeIdentityTransport) {
    this.#transport = transport;
  }

  verifyLiveness(sessionRef: string, now: UtcInstant): IdentityVerificationResult {
    const raw = this.#transport.exchange({
      capability: 'LIVENESS',
      subjectRef: sessionRef,
    });
    const result = normalizeIdentityVendorResponse(raw, {
      providerRef: `${FIXTURE_IDENTITY_PROVIDER_ID}:liveness:${sessionRef}`,
      now,
    });
    const logEntry = Object.freeze({
      sessionRef,
      outcome: result.outcome,
      reasonCodes: result.reasonCodes,
      biometricLogged: false,
    });
    assertNoSensitiveIdentityLog(logEntry);
    this.#logs.push(logEntry);
    return result;
  }

  logs(): readonly unknown[] {
    return this.#logs;
  }
}
