/** JSON helpers for durable persistence payloads containing bigint minor units. */

export function persistenceJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry));
}
