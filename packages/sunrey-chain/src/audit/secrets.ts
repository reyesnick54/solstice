const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/,
  /BEGIN ENCRYPTED PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /sk_live_[A-Za-z0-9]+/,
  /-----BEGIN CERTIFICATE-----[\s\S]{200,}-----END CERTIFICATE-----/,
];

const FORBIDDEN_FIELD_NAMES = [
  'privateKey',
  'private_key',
  'hsmCredential',
  'hsm_credential',
  'apiSecret',
  'api_secret',
  'kycPayload',
  'kyc_payload',
  'pdvPayload',
  'pdv_payload',
  'vendorCredential',
  'vendor_credential',
];

export const SANITIZED_SAMPLE_CONFIG = Object.freeze({
  environment: 'simulation',
  networkId: 'net_sunrey_testnet_1',
  chainId: 'chn_sunrey_testnet_1',
  protocolVersion: '1',
  fixtureEnvironment: 'local',
  keys: {
    validatorConsensusPublicKey: 'TEST_ONLY_PUBLIC_KEY_PLACEHOLDER',
    walletPublicKey: 'TEST_ONLY_PUBLIC_KEY_PLACEHOLDER',
    releasePublicKey: 'TEST_ONLY_PUBLIC_KEY_PLACEHOLDER',
  },
  notes: [
    'No private keys',
    'No API secrets',
    'No HSM credentials',
    'No real KYC',
    'No PDV payloads',
    'No external vendor credentials',
  ],
});

export function secretExclusionFindings(text: string): readonly string[] {
  const findings: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`forbidden pattern ${pattern.source}`);
    }
  }
  for (const field of FORBIDDEN_FIELD_NAMES) {
    const named = new RegExp(`"${field}"\\s*:\\s*"[^"]+"`);
    if (named.test(text) && !text.includes('PLACEHOLDER') && !text.includes('TEST_ONLY')) {
      findings.push(`forbidden field ${field}`);
    }
  }
  return findings;
}

export function assertSecretFree(text: string, label: string): void {
  const findings = secretExclusionFindings(text);
  if (findings.length > 0) {
    throw new Error(`${label} failed secret exclusion: ${findings.join('; ')}`);
  }
}
