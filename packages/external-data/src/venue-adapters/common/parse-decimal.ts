/** Parse a venue decimal string without floating-point. */
export function requireDecimalString(value: unknown, field: string): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} must be finite`);
    }
    return String(value);
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty decimal string`);
  }
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error(`${field} is not a decimal string`);
  }
  return value.trim();
}

export function optionalDecimalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return requireDecimalString(value, 'decimal');
}
