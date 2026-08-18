/**
 * Versioned SunRey payment-request encoding for QR and universal links.
 * Scanning creates a preview, not a signature.
 */

import {
  PAYMENT_REQUEST_VERSION,
  UNIVERSAL_LINK_HOSTS,
  reject,
  type MobileSyncRejection,
} from './types.ts';

export type SunReyPaymentRequest = {
  readonly version: typeof PAYMENT_REQUEST_VERSION;
  readonly networkId: string;
  readonly chainId: string;
  readonly recipient: string;
  readonly assetId: string;
  readonly quantityMinorUnits: string | null;
  readonly memo: string | null;
  readonly expiryUtc: string | null;
  readonly previewOnly: true;
};

export function createPaymentRequest(input: {
  readonly networkId: string;
  readonly chainId: string;
  readonly recipient: string;
  readonly assetId: string;
  readonly quantityMinorUnits?: string;
  readonly memo?: string;
  readonly expiryUtc?: string;
}): SunReyPaymentRequest {
  return Object.freeze({
    version: PAYMENT_REQUEST_VERSION,
    networkId: input.networkId,
    chainId: input.chainId,
    recipient: input.recipient,
    assetId: input.assetId,
    quantityMinorUnits: input.quantityMinorUnits ?? null,
    memo: input.memo ?? null,
    expiryUtc: input.expiryUtc ?? null,
    previewOnly: true,
  });
}

export function encodePaymentRequest(request: SunReyPaymentRequest): string {
  const params = new URLSearchParams({
    v: String(request.version),
    n: request.networkId,
    c: request.chainId,
    r: request.recipient,
    a: request.assetId,
  });
  if (request.quantityMinorUnits) {
    params.set('q', request.quantityMinorUnits);
  }
  if (request.memo) {
    params.set('m', request.memo);
  }
  if (request.expiryUtc) {
    params.set('x', request.expiryUtc);
  }
  return `sunrey:pay/${request.version}?${params.toString()}`;
}

export function encodeUniversalPaymentLink(request: SunReyPaymentRequest, host = UNIVERSAL_LINK_HOSTS[0]): string {
  const encoded = encodePaymentRequest(request).replace(`sunrey:pay/${request.version}?`, '');
  return `https://${host}/pay/${request.version}?${encoded}`;
}

export function parsePaymentRequest(
  raw: string,
  expected?: { readonly networkId?: string; readonly chainId?: string },
): SunReyPaymentRequest | MobileSyncRejection {
  const uri = normalizePaymentUri(raw);
  if (!uri) {
    return reject('WRONG_NETWORK', 'unrecognized payment request encoding');
  }
  const version = Number(uri.searchParams.get('v') ?? uri.pathname.split('/').pop() ?? '0');
  if (version !== PAYMENT_REQUEST_VERSION) {
    return reject('CLIENT_VERSION_UNSUPPORTED', 'unsupported payment-request version');
  }
  const networkId = uri.searchParams.get('n') ?? '';
  const chainId = uri.searchParams.get('c') ?? '';
  const recipient = uri.searchParams.get('r') ?? '';
  const assetId = uri.searchParams.get('a') ?? '';
  if (!networkId || !chainId || !recipient || !assetId) {
    return reject('WRONG_NETWORK', 'payment request missing required fields');
  }
  if (expected?.networkId && expected.networkId !== networkId) {
    return reject('WRONG_NETWORK', 'payment request is for a different network');
  }
  if (expected?.chainId && expected.chainId !== chainId) {
    return reject('WRONG_CHAIN', 'payment request is for a different chain');
  }
  return createPaymentRequest({
    networkId,
    chainId,
    recipient,
    assetId,
    quantityMinorUnits: uri.searchParams.get('q') ?? undefined,
    memo: uri.searchParams.get('m') ?? undefined,
    expiryUtc: uri.searchParams.get('x') ?? undefined,
  });
}

export function paymentRequestIsPreview(request: SunReyPaymentRequest): true {
  return request.previewOnly;
}

function normalizePaymentUri(raw: string): URL | null {
  try {
    if (raw.startsWith('sunrey:pay/')) {
      return new URL(raw.replace('sunrey:pay/', 'https://wallet.sunrey.invalid/pay/'));
    }
    const url = new URL(raw);
    if (url.protocol === 'https:' && (UNIVERSAL_LINK_HOSTS as readonly string[]).includes(url.host)) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}
