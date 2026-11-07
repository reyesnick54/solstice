export function normalizeAltLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeIdentifierToken(system: string, id: string): string {
  return `${system.trim().toLowerCase()}:${id.trim().toLowerCase()}`;
}
