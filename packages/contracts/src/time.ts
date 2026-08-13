import { type Brand, brandAs } from './brand.ts';

export type UtcInstant = Brand<string, 'UtcInstant'>;

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export function asUtcInstant(value: string): UtcInstant {
  if (!UTC_INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`Invalid UTC instant: ${value}`);
  }
  return brandAs<string, 'UtcInstant'>(value);
}

export function isUtcInstant(value: unknown): value is UtcInstant {
  return (
    typeof value === 'string' &&
    UTC_INSTANT.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function addUtcMillis(instant: UtcInstant, millis: number): UtcInstant {
  return asUtcInstant(new Date(Date.parse(instant) + millis).toISOString());
}
