/**
 * Mandatory production security controls. Satisfying this catalog is
 * not production authorization and is not an external audit.
 */

export const SECURITY_BASELINE_CONTROLS = Object.freeze([
  'SecretReference only in production configuration',
  'PRODUCTION_HSM_KMS_CONFIGURED remains false until external HSM/KMS is connected',
  'Key trust domains are separated; no purpose crossing',
  'Versioned rotation with overlapping verification',
  'Service-specific identity; no shared internal API key',
  'mTLS or short-lived service credentials; no committed certificates',
  'Default-deny network surfaces',
  'Named admin, step-up, short-lived, audited, recorded break-glass',
  'Database TLS, role separation, no application superuser',
  'Envelope encryption only where a key-management design exists',
  'API authn/authz, CORS allow-list, rate limits, IDOR and mass-assignment refusal',
  'Webhooks: signature, timestamp, replay, environment, raw-body, idempotency, domain machine',
  'Mainnet off; validator keys are not service secrets',
  'Agent has no secrets, EA, or privileged tools',
  'Non-root containers, no baked secrets, pinned Actions',
  'Independent external audit remains EXTERNAL',
] as const);

export const EXTERNAL_AUDIT_COMPLETE = false as const;
export const EXTERNAL_PENTEST_EXECUTED = false as const;
export const PRODUCTION_READY = false as const;
export const PRODUCTION_ACTIVE = false as const;
