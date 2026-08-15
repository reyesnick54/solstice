/**
 * PCI-sensitive boundary (simulation documentation, not a compliance claim).
 *
 * Solstice application code uses processor/token references only.
 * This tree does not implement a PAN vault, does not store CVV/CVC,
 * track data, PIN, or magstripe data, and does not claim PCI DSS
 * certification or card-network sponsorship.
 *
 * Future live issuing would keep PAN/CVV inside a separately assessed
 * PCI-sensitive processor boundary. Application services would continue
 * to see only ProcessorCardReference / NetworkTokenReference.
 *
 * Simulation values are unmistakably synthetic (`sim_tok_`, `sim_ntok_`,
 * `SIM-CARD`). They must not resemble production secrets.
 */

export const PCI_SENSITIVE_KEYS = [
  'pan',
  'PAN',
  'primaryAccountNumber',
  'cardNumber',
  'cvv',
  'CVV',
  'cvc',
  'CVC',
  'cvv2',
  'cvc2',
  'pin',
  'PIN',
  'trackData',
  'track1',
  'track2',
  'magstripe',
  'magneticStripe',
  'tokenizedPan',
  'tokenizedPAN',
  'tokenPAN',
  'emvData',
  'emvPayload',
  'contactlessTrack',
  'nfcPayload',
  'walletPrivateKey',
  'providerSecret',
  'providerBackendSecret',
] as const;

export const SYNTHETIC_CARD_DISPLAY = 'SIM-CARD';

export type PciBoundaryViolation = {
  readonly code: 'PCI_SENSITIVE_FIELD_FORBIDDEN';
  readonly field: string;
  readonly message: string;
};

export function assertNoSensitiveCardData(value: unknown, path = 'payload'): void {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoSensitiveCardData(item, `${path}[${String(index)}]`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((PCI_SENSITIVE_KEYS as readonly string[]).includes(key)) {
      throw Object.assign(new Error(`sensitive card field '${key}' is forbidden`), {
        code: 'PCI_SENSITIVE_FIELD_FORBIDDEN',
        field: `${path}.${key}`,
        message: `Solstice must not persist or transport raw ${key}`,
      } satisfies PciBoundaryViolation);
    }
    assertNoSensitiveCardData(child, `${path}.${key}`);
  }
}

export function isSyntheticProcessorRef(value: string): boolean {
  return value.startsWith('sim_tok_') || value.startsWith('sim_proc_') || value.startsWith('sim_ntok_');
}
