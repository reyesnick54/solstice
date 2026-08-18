/**
 * Mobile deep-link safety. Links validate scheme/domain, environment,
 * action class, network, and chain. They never auto-sign.
 */

import { createHash } from 'node:crypto';

import {
  DEEP_LINK_ACTION_CLASSES,
  DEEP_LINK_SCHEME,
  UNIVERSAL_LINK_HOSTS,
  reject,
  type DeepLinkActionClass,
  type MobileSyncRejection,
} from './types.ts';
import { parsePaymentRequest, type SunReyPaymentRequest } from './payment-request.ts';

export type ValidatedDeepLink = {
  readonly actionClass: DeepLinkActionClass;
  readonly networkId: string;
  readonly chainId: string;
  readonly environment: 'simulation';
  readonly payloadSignatureValid: boolean;
  readonly autoSign: false;
  readonly paymentRequest: SunReyPaymentRequest | null;
};

export function validateDeepLink(
  raw: string,
  expected: { readonly networkId: string; readonly chainId: string; readonly signature?: string },
): ValidatedDeepLink | MobileSyncRejection {
  let url: URL;
  try {
    url = raw.startsWith(`${DEEP_LINK_SCHEME}://`)
      ? new URL(raw.replace(`${DEEP_LINK_SCHEME}://`, 'https://wallet.sunrey.invalid/'))
      : new URL(raw);
  } catch {
    return reject('WRONG_NETWORK', 'malformed deep link');
  }
  const schemeOk = raw.startsWith(`${DEEP_LINK_SCHEME}://`) || url.protocol === 'https:';
  const hostOk = raw.startsWith(`${DEEP_LINK_SCHEME}://`) || (UNIVERSAL_LINK_HOSTS as readonly string[]).includes(url.host);
  if (!schemeOk || !hostOk) {
    return reject('WRONG_NETWORK', 'deep link scheme or domain is not trusted');
  }
  const action = inferAction(url);
  if (!(DEEP_LINK_ACTION_CLASSES as readonly string[]).includes(action)) {
    return reject('DEEP_LINK_CANNOT_AUTO_SIGN', 'unknown deep-link action class');
  }
  const networkId = url.searchParams.get('n') ?? expected.networkId;
  const chainId = url.searchParams.get('c') ?? expected.chainId;
  if (networkId !== expected.networkId) {
    return reject('WRONG_NETWORK', 'deep link network does not match the open wallet');
  }
  if (chainId !== expected.chainId) {
    return reject('WRONG_CHAIN', 'deep link chain does not match the open wallet');
  }
  let paymentRequest: SunReyPaymentRequest | null = null;
  if (action === 'PAYMENT_REQUEST') {
    const parsed = parsePaymentRequest(raw.startsWith('sunrey:pay/') ? raw : encodeAsPaymentUri(url), expected);
    if ('ok' in parsed && parsed.ok === false) {
      return parsed;
    }
    paymentRequest = parsed as SunReyPaymentRequest;
  }
  const payload = url.searchParams.toString();
  const expectedSig = expected.signature;
  const payloadSignatureValid = expectedSig
    ? expectedSig === createHash('sha256').update(payload).digest('hex')
    : expectedSig === undefined;
  return Object.freeze({
    actionClass: action,
    networkId,
    chainId,
    environment: 'simulation',
    payloadSignatureValid,
    autoSign: false,
    paymentRequest,
  });
}

export function refuseAutoSign(): MobileSyncRejection {
  return reject('DEEP_LINK_CANNOT_AUTO_SIGN', 'a deep link cannot automatically sign a transaction');
}

function inferAction(url: URL): DeepLinkActionClass {
  const path = url.pathname.toLowerCase();
  if (path.includes('/pay') || path.includes('payment')) {
    return 'PAYMENT_REQUEST';
  }
  if (path.includes('/tx') || path.includes('transaction')) {
    return 'VIEW_TRANSACTION';
  }
  if (path.includes('security')) {
    return 'SECURITY_NOTICE';
  }
  return 'OPEN_WALLET';
}

function encodeAsPaymentUri(url: URL): string {
  return `sunrey:pay/1?${url.searchParams.toString()}`;
}
