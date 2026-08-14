import { type Brand, brandAs } from '../../domain/src/brand.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

export type IntentId = Brand<string, 'IntentId'>;

export function asIntentId(value: string): IntentId {
  if (value.length === 0) {
    throw new TypeError('IntentId must be a non-empty string');
  }
  return brandAs<string, 'IntentId'>(value);
}

/**
 * Canonical ActionIntent envelope. Every consequential action enters the
 * Compliance Kernel as one of these. New action types add a payload that
 * conforms to this envelope; they do not bypass it.
 *
 * This interface did not exist on main. It is declared here as the single
 * intent shape for Phase 1.
 */
export interface ActionIntent<TPayload = unknown> {
  readonly id: IntentId;
  readonly actionType: string;
  readonly payload: TPayload;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly requestedAt: UtcInstant;
  readonly purpose: PurposeCode;
}

export const PURPOSE_CODES = [
  'CUSTOMER_ONBOARDING',
  'CUSTOMER_FUNDING',
  'CUSTOMER_WITHDRAWAL',
  'CUSTOMER_TRANSFER',
  'PROHIBITED',
] as const;

export type PurposeCode = (typeof PURPOSE_CODES)[number];

export function isPurposeCode(value: unknown): value is PurposeCode {
  return typeof value === 'string' && (PURPOSE_CODES as readonly string[]).includes(value);
}
