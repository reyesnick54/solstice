/**
 * Digital-asset authority planes. Custody provider balances must not
 * silently become SunRey fiat Ledger balances or AssetSupplyBook.
 */

export const DIGITAL_ASSET_STATE_PLANES = [
  'SUNREY_CHAIN_PROTOCOL_STATE',
  'CUSTODY_PROVIDER_REPORTED_STATE',
  'EXCHANGE_INTERNAL_POSITION',
  'CUSTOMER_PRODUCT_READ_MODEL',
] as const;
export type DigitalAssetStatePlane = (typeof DIGITAL_ASSET_STATE_PLANES)[number];

export type DigitalAssetPlaneSnapshot = {
  readonly plane: DigitalAssetStatePlane;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly authoritativeForFiatLedger: false;
  readonly mayMintMoonRey: false;
};

export type CustodyAuthorityReconciliation = {
  readonly assetId: string;
  readonly chain: DigitalAssetPlaneSnapshot;
  readonly custodyProvider: DigitalAssetPlaneSnapshot;
  readonly exchange: DigitalAssetPlaneSnapshot;
  readonly customerReadModel: DigitalAssetPlaneSnapshot;
  readonly matched: boolean;
  readonly autoCorrectedLedger: false;
  readonly autoMinted: false;
  readonly notes: readonly string[];
};

export function planeSnapshot(
  plane: DigitalAssetStatePlane,
  assetId: string,
  quantity: bigint,
): DigitalAssetPlaneSnapshot {
  return Object.freeze({
    plane,
    assetId,
    quantity,
    authoritativeForFiatLedger: false,
    mayMintMoonRey: false,
  });
}

export function reconcileDigitalAssetPlanes(input: {
  readonly assetId: string;
  readonly chainQuantity: bigint;
  readonly custodyProviderQuantity: bigint;
  readonly exchangeQuantity: bigint;
  readonly customerReadModelQuantity: bigint;
}): CustodyAuthorityReconciliation {
  const chain = planeSnapshot('SUNREY_CHAIN_PROTOCOL_STATE', input.assetId, input.chainQuantity);
  const custodyProvider = planeSnapshot(
    'CUSTODY_PROVIDER_REPORTED_STATE',
    input.assetId,
    input.custodyProviderQuantity,
  );
  const exchange = planeSnapshot('EXCHANGE_INTERNAL_POSITION', input.assetId, input.exchangeQuantity);
  const customerReadModel = planeSnapshot(
    'CUSTOMER_PRODUCT_READ_MODEL',
    input.assetId,
    input.customerReadModelQuantity,
  );
  const matched =
    input.chainQuantity === input.custodyProviderQuantity &&
    input.custodyProviderQuantity === input.exchangeQuantity &&
    input.exchangeQuantity === input.customerReadModelQuantity;
  const notes = matched
    ? Object.freeze(['all planes agree; none is a fiat Ledger balance'])
    : Object.freeze(['plane mismatch; investigation required; ledger not auto-corrected']);
  return Object.freeze({
    assetId: input.assetId,
    chain,
    custodyProvider,
    exchange,
    customerReadModel,
    matched,
    autoCorrectedLedger: false,
    autoMinted: false,
    notes,
  });
}

export function custodyBalanceCannotBecomeLedger(balance: { readonly isFiatLedgerBalance: boolean }): boolean {
  return balance.isFiatLedgerBalance === false;
}
