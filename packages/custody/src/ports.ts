import type { Result } from '../../domain/src/result.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { EncryptedEnvelope } from '../../security/src/envelope.ts';
import type { DestinationScreeningOutcome } from './taxonomy.ts';
import type { CustodyFailure, SimulatedVasp, TravelRuleMessage } from './types.ts';

export type CustomerAssetPosition = {
  readonly available: AssetQuantity;
  readonly held: AssetQuantity;
  readonly settled: AssetQuantity;
};

export type CustomerAssetPort = {
  credit(ownerId: string, amount: AssetQuantity): Result<{ journalId: string }, CustodyFailure>;
  placeHold(accountId: string, amount: AssetQuantity): Result<{ holdId: string }, CustodyFailure>;
  releaseHold(holdId: string): Result<unknown, CustodyFailure>;
  debitHeld(holdId: string, amount: AssetQuantity): Result<{ journalId: string }, CustodyFailure>;
  /**
   * Dual-asset position read. Asset identity is required.
   */
  position(ownerId: string, assetId: string): CustomerAssetPosition;
  positionForAsset(ownerId: string, assetId: string): CustomerAssetPosition;
  /**
   * @deprecated Ambiguous once an owner may hold both native assets.
   * Dual-asset flows must call position(ownerId, assetId).
   */
  positionLegacy(ownerId: string): { readonly error: 'ASSET_IDENTITY_REQUIRED' };
};

export type DestinationRiskProvider = {
  screen(input: {
    readonly address: string;
    readonly customerId: string;
    readonly assetId: string;
  }): { readonly outcome: DestinationScreeningOutcome; readonly reason: string };
};

/**
 * Historical simulation-only custody provider. Live functionality
 * remains unavailable. Production-candidate profiles live alongside
 * this port and do not replace it.
 */
export type CustodyProviderPort = {
  readonly mode: 'SIMULATION_ONLY';
  mapAddress(address: string): { readonly custodyAccountId: string; readonly customerId: string } | null;
  ingestNotice(material: string, signatureHex: string): { readonly authentic: boolean };
  submitWithdrawal(input: {
    readonly withdrawalId: string;
    readonly destination: string;
    readonly amount: AssetQuantity;
    readonly timeout?: boolean;
  }):
    | { readonly kind: 'SUBMITTED'; readonly submissionId: string; readonly txRef: string }
    | { readonly kind: 'SUBMISSION_UNKNOWN'; readonly submissionId: string; readonly reason: string };
  queryWithdrawal(submissionId: string):
    | { readonly kind: 'FINALIZED'; readonly txRef: string; readonly confirmations: number }
    | { readonly kind: 'UNKNOWN' }
    | { readonly kind: 'NOT_FOUND' };
  operationalBalance(assetId: string): AssetQuantity;
};

export type TravelRuleNetworkPort = {
  readonly mode: 'SIMULATION_ONLY';
  discoverCounterparty(address: string): SimulatedVasp | null;
  submit(message: TravelRuleMessage): { readonly acknowledged: boolean };
};

export type TravelRuleProtectionPort = {
  seal(plaintext: Buffer): EncryptedEnvelope;
};
