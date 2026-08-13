declare const brand: unique symbol;

export type Brand<T, Name extends string> = T & {
  readonly [brand]: Name;
};

export function brandAs<T, Name extends string>(value: T): Brand<T, Name> {
  return value as Brand<T, Name>;
}
