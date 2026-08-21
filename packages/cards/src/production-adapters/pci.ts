/**
 * Card data security. Prefer provider-hosted retrieval, ephemeral token,
 * PCI-compliant iframe, or network token. Do not persist PAN/CVV.
 */

import { assertNoSensitiveCardData, PCI_SENSITIVE_KEYS } from '../pci-boundary.ts';

export const PREFERRED_CARD_DETAIL_CHANNELS = [
  'PROVIDER_HOSTED_RETRIEVAL',
  'EPHEMERAL_TOKEN',
  'PCI_IFRAME',
  'NETWORK_TOKEN',
] as const;
export type PreferredCardDetailChannel = (typeof PREFERRED_CARD_DETAIL_CHANNELS)[number];

export function refuseApplicationPanStorage(): {
  readonly persistPan: false;
  readonly persistCvv: false;
  readonly preferredChannels: typeof PREFERRED_CARD_DETAIL_CHANNELS;
} {
  return Object.freeze({
    persistPan: false,
    persistCvv: false,
    preferredChannels: PREFERRED_CARD_DETAIL_CHANNELS,
  });
}

export function assertAdapterPayloadIsPciSafe(payload: Readonly<Record<string, unknown>>): void {
  assertNoSensitiveCardData(payload, 'cardAdapter.payload');
}

export function pciSensitiveKeyCount(): number {
  return PCI_SENSITIVE_KEYS.length;
}
