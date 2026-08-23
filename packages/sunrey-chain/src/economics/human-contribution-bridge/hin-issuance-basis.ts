/**
 * Phase G consumer of HIN Economic Value Inputs.
 *
 * Accepts an issuance-basis proposal and refuses to mint. Native-asset
 * supply authority remains required.
 */

import { createIssuanceProposal, type NativeIssuanceProposal } from '../../native-assets/issuance-pipelines.ts';
import { emptyBook } from '../supply.ts';

export type HinIssuanceBasisShape = {
  readonly kind: 'ECONOMIC_INPUT_ISSUANCE_BASIS';
  readonly proposalId: string;
  readonly contributionId: string;
  readonly economicValueInputId: string;
  readonly normalizedValue: string;
  readonly denomination: string;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly mintRequested: false;
  readonly sunReyQuantity: null;
  readonly requiresPhaseGGovernance: true;
};

export type HinIssuanceAcceptance =
  | {
      readonly ok: true;
      readonly acceptedAs: 'ISSUANCE_BASIS_PROPOSAL';
      readonly minted: false;
      readonly sunReyQuantity: null;
      readonly requiresHumanGovernance: true;
      readonly draft: NativeIssuanceProposal;
    }
  | {
      readonly ok: false;
      readonly code: 'HIN_CANNOT_MINT' | 'HIN_BASIS_NOT_PROPOSAL' | 'HIN_MINT_REQUEST_FORBIDDEN';
    };

export function acceptHinIssuanceBasis(proposal: HinIssuanceBasisShape): HinIssuanceAcceptance {
  if (proposal.kind !== 'ECONOMIC_INPUT_ISSUANCE_BASIS') {
    return { ok: false, code: 'HIN_BASIS_NOT_PROPOSAL' };
  }
  if (proposal.mintRequested !== false || proposal.sunReyQuantity !== null) {
    return { ok: false, code: 'HIN_MINT_REQUEST_FORBIDDEN' };
  }
  const draft = createIssuanceProposal({
    proposalId: proposal.proposalId,
    asset: 'SUNREY_COIN',
    amount: 0n,
    basis: 'HIN_ECONOMIC_VALUE_INPUT_NOT_MINT',
    inputReferences: [proposal.economicValueInputId, proposal.contributionId],
    valuationMethodology: `${proposal.methodologyId}:${proposal.methodologyVersion}`,
    policyVersion: 'simulation',
    book: emptyBook('SUNREY_COIN', 'simulation'),
    network: 'DEVELOPMENT',
  });
  return {
    ok: true,
    acceptedAs: 'ISSUANCE_BASIS_PROPOSAL',
    minted: false,
    sunReyQuantity: null,
    requiresHumanGovernance: true,
    draft: Object.freeze({ ...draft, status: 'AWAITING_GOVERNANCE' }),
  };
}

export function hinCannotMint(): { readonly ok: false; readonly code: 'HIN_CANNOT_MINT'; readonly minted: false } {
  return { ok: false, code: 'HIN_CANNOT_MINT', minted: false };
}
