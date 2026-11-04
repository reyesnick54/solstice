import { createHash } from 'node:crypto';

export type TrialId = string & { readonly __brand: 'TrialId' };

export function trialIdFor(material: string): TrialId {
  const digest = createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 24);
  return `trial_${digest}` as TrialId;
}

export function trialIdFromConfig(config: Record<string, unknown>): TrialId {
  const keys = Object.keys(config).sort();
  const payload = keys.map((key) => `${key}=${JSON.stringify(config[key])}`).join('|');
  return trialIdFor(payload);
}
