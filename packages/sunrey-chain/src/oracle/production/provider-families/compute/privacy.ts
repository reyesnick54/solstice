/**
 * Privacy firewall for compute economic evidence.
 *
 * Economic records store metering metadata and commitments only.
 * Prompts, model outputs, training examples, source code, secrets,
 * customer filenames, database payloads, API credentials, and
 * private model weights are refused — not redacted into storage.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { computeRefusal, type ComputeRefusal, type ComputeRefusalCode } from './types.ts';

const FORBIDDEN_KEY_HINTS: readonly { readonly pattern: RegExp; readonly code: ComputeRefusalCode }[] = [
  { pattern: /prompt|user[_-]?message|chat[_-]?input|system[_-]?prompt/i, code: 'PROMPT_CONTENT_FORBIDDEN' },
  {
    pattern: /model[_-]?(output|response|completion)|generated[_-]?text|assistant[_-]?message/i,
    code: 'MODEL_OUTPUT_FORBIDDEN',
  },
  {
    pattern: /api[_-]?key|access[_-]?token|secret|password|credential|private[_-]?key|authorization/i,
    code: 'CREDENTIAL_MATERIAL_FORBIDDEN',
  },
  {
    pattern: /source[_-]?code|dockerfile|container[_-]?env|training[_-]?(example|sample|row)|customer[_-]?(file|filename|path)|database[_-]?(payload|row|dump)|model[_-]?weight|safetensor|checkpoint[_-]?blob/i,
    code: 'WORKLOAD_PAYLOAD_FORBIDDEN',
  },
];

const FORBIDDEN_VALUE_HINTS: readonly { readonly pattern: RegExp; readonly code: ComputeRefusalCode }[] = [
  { pattern: /\b(sk-|Bearer |BEGIN (RSA |EC )?PRIVATE KEY)\b/i, code: 'CREDENTIAL_MATERIAL_FORBIDDEN' },
  { pattern: /\b(you are a helpful assistant|user prompt:)\b/i, code: 'PROMPT_CONTENT_FORBIDDEN' },
];

export const PRIVACY_FIREWALL_VERSION = 'sunrey.compute-privacy.v1' as const;

export function scanComputePrivacy(value: unknown, path = 'root'): Result<true, ComputeRefusal> {
  if (typeof value === 'string') {
    for (const hint of FORBIDDEN_VALUE_HINTS) {
      if (hint.pattern.test(value)) {
        return err(computeRefusal(hint.code, `${path} contains forbidden workload or credential material`));
      }
    }
    return ok(true);
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nested = scanComputePrivacy(item, `${path}[${index}]`);
      if (!nested.ok) {
        return nested;
      }
    }
    return ok(true);
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      for (const hint of FORBIDDEN_KEY_HINTS) {
        if (hint.pattern.test(key)) {
          return err(computeRefusal(hint.code, `${path}.${key} is forbidden on economic compute evidence`));
        }
      }
      const nested = scanComputePrivacy(item, `${path}.${key}`);
      if (!nested.ok) {
        return nested;
      }
    }
  }
  return ok(true);
}

export function economicRecordOmitsPayloads(record: unknown): boolean {
  const encoded = JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)).toLowerCase();
  return (
    !encoded.includes('summarize the customer') &&
    !encoded.includes('model_output') &&
    !encoded.includes('apikey') &&
    !encoded.includes('api_key') &&
    !encoded.includes('source_code') &&
    !encoded.includes('model_weight')
  );
}
