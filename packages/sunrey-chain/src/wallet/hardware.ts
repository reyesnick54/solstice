/**
 * Hardware signer protocol port.
 *
 * The device receives canonical sign bytes and a transaction summary.
 * The host receives a signature only. Private keys remain external.
 * This port does not claim certification with any hardware vendor.
 */

import type { HardwareSignRequest, HardwareSignResponse } from './types.ts';

export type HardwareSignerProtocol = {
  readonly protocolId: 'sunrey.hardware-signer.v1';
  readonly displaySummary: (request: HardwareSignRequest) => string;
  readonly exportSignBytes: (request: HardwareSignRequest) => string;
};

export const hardwareSignerProtocol: HardwareSignerProtocol = {
  protocolId: 'sunrey.hardware-signer.v1',
  displaySummary(request) {
    const summary = request.transactionSummary;
    return [
      `family ${summary.family}`,
      `from ${summary.fromAddress}`,
      `to ${summary.toAddress ?? 'none'}`,
      `amount ${summary.amount ?? '0'} ${summary.assetId ?? ''}`,
      `max_fee ${summary.maxFee} ${summary.feeAsset}`,
      `network ${summary.networkId}`,
    ].join('\n');
  },
  exportSignBytes(request) {
    return request.signBytesHex;
  },
};

export function acceptHardwareSignature(response: HardwareSignResponse): HardwareSignResponse {
  return Object.freeze({
    signatureHex: response.signatureHex,
    publicKeyHex: response.publicKeyHex,
    suiteId: response.suiteId,
  });
}
