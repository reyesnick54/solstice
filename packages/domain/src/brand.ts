declare const brand: unique symbol;

/**
 * Nominal (branded) wrapper around a representation type.
 * Brands are erased at runtime; they exist to stop accidental mixing of IDs.
 */
export type Brand<T, Name extends string> = T & {
  readonly [brand]: Name;
};

export function brandAs<T, Name extends string>(value: T): Brand<T, Name> {
  return value as Brand<T, Name>;
}
