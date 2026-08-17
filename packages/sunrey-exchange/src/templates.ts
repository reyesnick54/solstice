import { sha256Hex } from '../../security/src/hash.ts';
import type { TemplateHash } from './ids.ts';
import type { ContractTemplate } from './types-universal.ts';
import { CONTRACT_TEMPLATE_IDS, type ContractTemplateId } from './taxonomy.ts';

function hashed(templateId: ContractTemplateId, body: string): TemplateHash {
  return sha256Hex(`sunrey.exchange.template.v1:${templateId}:${body}`) as TemplateHash;
}

const TEMPLATES: { readonly [K in ContractTemplateId]: ContractTemplate } = {
  COMPUTE_SPOT_V1: Object.freeze({
    templateId: 'COMPUTE_SPOT_V1',
    version: 1,
    contentHash: hashed(
      'COMPUTE_SPOT_V1',
      'escrow+metered_delivery+pay_verified_release_unused+oracle_required',
    ),
    family: 'INTELLIGENCE_COMPUTE',
    settlementModel: 'COMPUTE_CONTRACT',
    partialPolicy: 'PAY_VERIFIED_RELEASE_UNUSED',
    oracleRequired: true,
    description: 'Spot compute: escrow settlement asset, pay verified units, release unused.',
  }),
  ENERGY_DELIVERY_V1: Object.freeze({
    templateId: 'ENERGY_DELIVERY_V1',
    version: 1,
    contentHash: hashed('ENERGY_DELIVERY_V1', 'escrow+oracle_mwh+partial_pay+no_title_token'),
    family: 'PRODUCTIVE_CAPACITY',
    settlementModel: 'CAPACITY_ESCROW_ORACLE',
    partialPolicy: 'PAY_VERIFIED_RELEASE_UNUSED',
    oracleRequired: true,
    description: 'Energy capacity/delivery rights. Does not tokenize title to generation assets.',
  }),
  MANUFACTURING_CAPACITY_V1: Object.freeze({
    templateId: 'MANUFACTURING_CAPACITY_V1',
    version: 1,
    contentHash: hashed('MANUFACTURING_CAPACITY_V1', 'batch_auction+oracle_output+partial_pay'),
    family: 'PRODUCTIVE_CAPACITY',
    settlementModel: 'CAPACITY_ESCROW_ORACLE',
    partialPolicy: 'PAY_VERIFIED_RELEASE_UNUSED',
    oracleRequired: true,
    description: 'Future manufacturing capacity. Batch auction appropriate. No real-property title.',
  }),
  STORAGE_CAPACITY_V1: Object.freeze({
    templateId: 'STORAGE_CAPACITY_V1',
    version: 1,
    contentHash: hashed('STORAGE_CAPACITY_V1', 'escrow+oracle_capacity_supplied+partial_pay'),
    family: 'PRODUCTIVE_CAPACITY',
    settlementModel: 'CAPACITY_ESCROW_ORACLE',
    partialPolicy: 'PAY_VERIFIED_RELEASE_UNUSED',
    oracleRequired: true,
    description: 'Warehouse or energy-storage capacity rights for a delivery window.',
  }),
  INFORMATION_COMPUTE_RIGHT_V1: Object.freeze({
    templateId: 'INFORMATION_COMPUTE_RIGHT_V1',
    version: 1,
    contentHash: hashed(
      'INFORMATION_COMPUTE_RIGHT_V1',
      'consent+purpose+clean_room+aggregate_only+no_raw_rows+dvr',
    ),
    family: 'HUMAN_INFORMATION_RIGHT',
    settlementModel: 'DELIVERY_VERSUS_RIGHT',
    partialPolicy: 'ALL_OR_NOTHING',
    oracleRequired: false,
    description: 'Permissioned clean-room computation right. Raw subject rows remain unavailable.',
  }),
};

export const ContractTemplateRegistry = Object.freeze({
  id: 'sunrey.exchange.contract-templates.v1',
  get(id: ContractTemplateId): ContractTemplate {
    return TEMPLATES[id];
  },
  known(value: string): value is ContractTemplateId {
    return (CONTRACT_TEMPLATE_IDS as readonly string[]).includes(value);
  },
  all(): readonly ContractTemplate[] {
    return CONTRACT_TEMPLATE_IDS.map((id) => TEMPLATES[id]);
  },
  verifyHash(id: ContractTemplateId, hash: string): boolean {
    return TEMPLATES[id].contentHash === hash;
  },
});
