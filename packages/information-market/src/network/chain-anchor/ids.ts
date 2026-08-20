import { randomUUID } from 'node:crypto';

export const HIN_ANCHOR_ID_PREFIXES = Object.freeze({
  anchor: 'hianchor_',
  projection: 'hiproj_',
  reconciliation: 'hirecon_',
});

export type HumanInformationAnchorId = string & { readonly __brand: 'HumanInformationAnchorId' };
export type HumanInformationUsageAnchorProjectionId = string & {
  readonly __brand: 'HumanInformationUsageAnchorProjectionId';
};
export type HumanInformationAnchorReconciliationId = string & {
  readonly __brand: 'HumanInformationAnchorReconciliationId';
};

function mint(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export const newHumanInformationAnchorId = (): HumanInformationAnchorId =>
  mint(HIN_ANCHOR_ID_PREFIXES.anchor) as HumanInformationAnchorId;
export const newUsageAnchorProjectionId = (): HumanInformationUsageAnchorProjectionId =>
  mint(HIN_ANCHOR_ID_PREFIXES.projection) as HumanInformationUsageAnchorProjectionId;
export const newAnchorReconciliationId = (): HumanInformationAnchorReconciliationId =>
  mint(HIN_ANCHOR_ID_PREFIXES.reconciliation) as HumanInformationAnchorReconciliationId;
