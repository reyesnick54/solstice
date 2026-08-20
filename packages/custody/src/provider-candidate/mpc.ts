/**
 * Provider-neutral MPC candidate. No vendor SDK. No raw shares.
 */

import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export type MpcSigningRequest = {
  readonly requestRef: string;
  readonly previewHash: string;
  readonly quorumRequired: number;
  readonly publicDescriptor: string;
};

export type MpcSignature = {
  readonly requestRef: string;
  readonly signature: string;
  readonly publicDescriptor: string;
  readonly rawSharePresent: false;
};

export type MpcCandidatePort = {
  readonly vendorSdkPresent: false;
  requestSignature(request: MpcSigningRequest): CustodyCandidateResult<MpcSignature>;
};

export class FixtureMpcCandidatePort implements MpcCandidatePort {
  readonly vendorSdkPresent = false as const;

  requestSignature(request: MpcSigningRequest): CustodyCandidateResult<MpcSignature> {
    if (request.quorumRequired < 1) {
      return candidateErr('MPC_QUORUM', 'MPC quorum metadata is required');
    }
    return candidateOk(
      Object.freeze({
        requestRef: request.requestRef,
        signature: `mpc-fixture:${request.previewHash}`,
        publicDescriptor: request.publicDescriptor,
        rawSharePresent: false,
      }),
    );
  }
}

export function exposeMpcShare(): CustodyCandidateResult<never> {
  return candidateErr('MPC_SHARE_FORBIDDEN', 'MPC interface must never expose raw private shares');
}
