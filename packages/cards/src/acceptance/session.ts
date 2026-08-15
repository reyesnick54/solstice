import { isExpired } from '../../../config/src/clock.ts';
import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type { AcceptanceDeviceId, AcceptanceSessionId, MerchantId } from './ids.ts';

export type AcceptanceSession = {
  readonly sessionId: AcceptanceSessionId;
  readonly merchantId: MerchantId;
  readonly deviceId: AcceptanceDeviceId;
  readonly provider: string;
  readonly currency: CurrencyCode;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
};

export function freezeAcceptanceSession(session: AcceptanceSession): AcceptanceSession {
  assertNoSensitiveCardData(session, 'acceptanceSession');
  return Object.freeze({ ...session });
}

export function sessionIsUsable(session: AcceptanceSession, now: UtcInstant): boolean {
  return !isExpired(session.expiresAt, now);
}
