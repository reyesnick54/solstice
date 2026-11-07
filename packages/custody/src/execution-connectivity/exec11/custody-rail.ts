import type { CustodyRailKind, DigitalAssetCustodyPath, SecuritiesCustodyPath } from './types.ts';

export function digitalAssetCustodyPath(travelRuleApplicable: boolean): DigitalAssetCustodyPath {
  return Object.freeze({
    rail: 'DIGITAL_ASSET',
    hsmMpcBoundaryPreserved: true,
    destinationScreeningRequired: true,
    travelRuleRequired: travelRuleApplicable,
    chainConfirmationRequired: true,
    mayUseCryptoSemanticsOnSecurities: false,
  });
}

export function securitiesCustodyPath(): SecuritiesCustodyPath {
  return Object.freeze({
    rail: 'SECURITIES',
    brokerSettlementRecords: true,
    positionRecordAuthoritative: true,
    chainConfirmationRequired: false,
    travelRuleRequired: false,
    forcedCryptoSemantics: false,
  });
}

export function resolveCustodyRailPath(rail: CustodyRailKind, travelRuleApplicable = false) {
  return rail === 'DIGITAL_ASSET' ? digitalAssetCustodyPath(travelRuleApplicable) : securitiesCustodyPath();
}

export function railUsesChainConfirmation(rail: CustodyRailKind): boolean {
  return rail === 'DIGITAL_ASSET';
}
