const FORBIDDEN_KEYS = [
  'privatekey',
  'private_key',
  'seedphrase',
  'seed_phrase',
  'mnemonic',
  'hsmsecret',
  'hsm_secret',
  'rawpdv',
  'raw_pdv',
  'rawpayload',
  'raw_payload',
  'cleanroomrow',
  'consentpayload',
  'stack',
  'stacktrace',
];

export function containsForbiddenSensitiveField(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return FORBIDDEN_KEYS.some((key) => lower.includes(key) && lower.includes('BEGIN') === false && key === 'privatekey' && lower.includes('privatekey='));
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenSensitiveField(item, depth + 1));
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(key.toLowerCase().replace(/-/g, '_'))) {
        return true;
      }
      if (containsForbiddenSensitiveField(nested, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

export function objectHasPrivateKeyField(value: unknown): boolean {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false;
  }
  const seen = new Set<unknown>();
  const walk = (node: unknown): boolean => {
    if (node === null || node === undefined || typeof node !== 'object' || seen.has(node)) {
      return false;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      return node.some(walk);
    }
    for (const [key, nested] of Object.entries(node)) {
      const normalized = key.toLowerCase().replace(/-/g, '_');
      if (
        normalized === 'private_key' ||
        normalized === 'privatekey' ||
        normalized === 'seed_hex' ||
        normalized === 'seedhex' ||
        normalized === 'seed_phrase' ||
        normalized === 'mnemonic' ||
        normalized === 'raw_pdv' ||
        normalized === 'rawpdv' ||
        normalized === 'hsm_secret'
      ) {
        return true;
      }
      if (walk(nested)) {
        return true;
      }
    }
    return false;
  };
  return walk(value);
}
