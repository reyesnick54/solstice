import { createHmac, timingSafeEqual } from 'node:crypto';

import { isNativeCustodyAssetId, type NativeCustodyAssetId } from '../native-assets.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export type CustodyProviderCallback = {
  readonly callbackId: string;
  readonly kind: 'DEPOSIT' | 'WITHDRAWAL';
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly destination: string;
  readonly transactionRef: string;
  readonly signatureHex: string;
  readonly material: string;
};

export function verifyAuthenticCallback(
  callback: CustodyProviderCallback,
  hmacSecret: string,
): CustodyCandidateResult<CustodyProviderCallback> {
  if (!isNativeCustodyAssetId(callback.assetId)) {
    return candidateErr('INVALID_ASSET', 'callback asset is not a native custody asset');
  }
  const expected = createHmac('sha256', hmacSecret).update(callback.material).digest('hex');
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(callback.signatureHex, 'hex');
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return candidateErr('UNAUTHENTIC_CALLBACK', 'callback signature is not authentic');
  }
  return candidateOk(callback);
}

export function signFixtureCallback(material: string, hmacSecret: string): string {
  return createHmac('sha256', hmacSecret).update(material).digest('hex');
}
