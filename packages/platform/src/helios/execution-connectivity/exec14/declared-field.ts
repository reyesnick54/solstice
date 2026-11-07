import type { Exec14CapabilityAvailability } from './taxonomy.ts';

export type Exec14DeclaredField<T> = Readonly<
  | { readonly availability: 'UNAVAILABLE' }
  | { readonly availability: 'AVAILABLE'; readonly value: T }
>;

export type Exec14BooleanCapability = Exec14DeclaredField<boolean>;

export function unavailableField<T>(): Exec14DeclaredField<T> {
  return Object.freeze({ availability: 'UNAVAILABLE' });
}

export function availableField<T>(value: T): Exec14DeclaredField<T> {
  return Object.freeze({ availability: 'AVAILABLE', value });
}

export function isFieldAvailable<T>(
  field: Exec14DeclaredField<T>,
): field is { readonly availability: 'AVAILABLE'; readonly value: T } {
  return field.availability === 'AVAILABLE';
}

export function capabilityAvailability(field: Exec14DeclaredField<unknown> | Exec14BooleanCapability): Exec14CapabilityAvailability {
  return field.availability;
}
