/**
 * Tightly controlled HIN → Phase G native-asset interface.
 *
 * Output is an economic-input / issuance-basis proposal. It is not a
 * mint call. Phase G supply authority remains required.
 */

import { hinFailure, type HinEconomicValueInput, type HinFailure, type HinIssuanceBasisProposal } from './types.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';

export function createHinIssuanceBasisProposal(input: HinEconomicValueInput): Result<HinIssuanceBasisProposal, HinFailure> {
  if (input.isMintAmount !== false || input.isSunReyQuantity !== false) {
    return err(hinFailure('MINT_FORBIDDEN', 'an economic value input cannot carry a mint amount'));
  }
  return ok(
    Object.freeze({
      schema: 'sunrey.hin.issuance-basis-proposal.v1',
      proposalId: `hibp_${input.valueInputId}`,
      kind: 'ECONOMIC_INPUT_ISSUANCE_BASIS',
      contributionId: input.contributionId,
      economicValueInputId: input.valueInputId,
      normalizedValue: input.normalizedValue.toString(),
      denomination: input.denomination,
      methodologyId: input.methodologyId,
      methodologyVersion: input.methodologyVersion,
      mintRequested: false,
      sunReyQuantity: null,
      requiresPhaseGGovernance: true,
      requiresNativeAssetAuthority: true,
      productionActivated: false,
      aiApproved: false,
    }),
  );
}

export function refuseHinMint(): Result<never, HinFailure> {
  return err(hinFailure('MINT_FORBIDDEN', 'HIN Economic Value Engine cannot mint SunRey Coin'));
}

export function refuseHinIssuanceAuthorization(): Result<never, HinFailure> {
  return err(hinFailure('ISSUANCE_NOT_AUTHORIZED', 'HIN issuance basis still requires Phase G native-asset governance'));
}
