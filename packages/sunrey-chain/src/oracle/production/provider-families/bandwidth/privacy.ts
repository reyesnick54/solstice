/**
 * Privacy firewall for bandwidth economic evidence.
 *
 * Economic records store aggregate metering metadata and hashed
 * references only. Packet payloads, DNS history, URLs, browsing
 * history, message/email contents, user IP logs, subscriber
 * browsing profiles, and authentication tokens are refused — not
 * redacted into storage.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { bandwidthRefusal, type BandwidthRefusal, type BandwidthRefusalCode } from './types.ts';

const FORBIDDEN_KEY_HINTS: readonly { readonly pattern: RegExp; readonly code: BandwidthRefusalCode }[] = [
  { pattern: /packet[_-]?(payload|content|dump|capture)|pcap|payload[_-]?bytes/i, code: 'PACKET_PAYLOAD_FORBIDDEN' },
  { pattern: /dns[_-]?(history|query|log)|resolved[_-]?name/i, code: 'DNS_HISTORY_FORBIDDEN' },
  { pattern: /\burl\b|request[_-]?uri|page[_-]?path|http[_-]?path/i, code: 'URL_FIELD_FORBIDDEN' },
  {
    pattern: /browsing[_-]?(history|profile)|visited[_-]?site|subscriber[_-]?profile|clickstream/i,
    code: 'BROWSING_HISTORY_FORBIDDEN',
  },
  { pattern: /message[_-]?(content|body|text)|chat[_-]?content|sms[_-]?body/i, code: 'MESSAGE_CONTENT_FORBIDDEN' },
  { pattern: /email[_-]?(content|body|text)|mail[_-]?body/i, code: 'EMAIL_CONTENT_FORBIDDEN' },
  { pattern: /user[_-]?ip|subscriber[_-]?ip|client[_-]?ip|src[_-]?ip|dst[_-]?ip|ip[_-]?log/i, code: 'USER_IP_LOG_FORBIDDEN' },
  {
    pattern: /subscriber[_-]?(name|ssn|email|phone|address)|customer[_-]?(name|email|phone)|pii|passport/i,
    code: 'SUBSCRIBER_PII_FORBIDDEN',
  },
  {
    pattern: /api[_-]?key|access[_-]?token|secret|password|credential|private[_-]?key|authorization|bearer/i,
    code: 'CREDENTIAL_MATERIAL_FORBIDDEN',
  },
];

const FORBIDDEN_VALUE_HINTS: readonly { readonly pattern: RegExp; readonly code: BandwidthRefusalCode }[] = [
  { pattern: /\bhttps?:\/\/[^\s]+/i, code: 'URL_FIELD_FORBIDDEN' },
  { pattern: /\b(sk-|Bearer |BEGIN (RSA |EC )?PRIVATE KEY)\b/i, code: 'CREDENTIAL_MATERIAL_FORBIDDEN' },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, code: 'USER_IP_LOG_FORBIDDEN' },
];

export const PRIVACY_FIREWALL_VERSION = 'sunrey.bandwidth-privacy.v1' as const;

export function scanBandwidthPrivacy(value: unknown, path = 'root'): Result<true, BandwidthRefusal> {
  if (typeof value === 'string') {
    for (const hint of FORBIDDEN_VALUE_HINTS) {
      if (hint.pattern.test(value)) {
        return err(bandwidthRefusal(hint.code, `${path} contains forbidden network or subscriber material`));
      }
    }
    return ok(true);
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nested = scanBandwidthPrivacy(item, `${path}[${index}]`);
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
          return err(bandwidthRefusal(hint.code, `${path}.${key} is forbidden on economic bandwidth evidence`));
        }
      }
      const nested = scanBandwidthPrivacy(item, `${path}.${key}`);
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
    !encoded.includes('packet_payload') &&
    !encoded.includes('https://') &&
    !encoded.includes('browsing_history') &&
    !encoded.includes('dns_history') &&
    !encoded.includes('user_ip') &&
    !encoded.includes('apikey') &&
    !encoded.includes('api_key')
  );
}

export function hashAccountReference(raw: string): string {
  return raw.startsWith('acct.') ? raw : `acct.${raw}`;
}
