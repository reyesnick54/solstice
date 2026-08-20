/**
 * Goods / commerce ingest adapter. Fixture and in-process only.
 * Consensus is never called. Facts never mint MoonRey.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { oracleFactCreationNeverMintsMoonRey } from '../../eligibility.ts';
import { evaluateGoodsDelivery } from './delivery.ts';
import { evaluateGoodsOutput } from './goods.ts';
import {
  eventFromGoods,
  evaluateSourceIndependence,
} from './lineage.ts';
import { orderIsNotGoodsOutput } from './orders.ts';
import { publicEvidenceFrom, refusePrivacyLeaks } from './privacy.ts';
import { evaluateGoodsReturn } from './returns.ts';
import { detectSchemaDrift, parseIntegerMantissa } from './schemas.ts';
import {
  GOODS_FACT_AUTO_MINTS,
  PRODUCTION_ACTIVE,
  REAL_PROVIDER_CONTACTED,
  isForbiddenGoodsFactType,
  isGoodsFactType,
  isGoodsSourceClass,
  type GoodsRefusal,
  type GoodsSourceObservation,
  type PublicGoodsEvidence,
} from './types.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import type { GoodsReturnRecord } from './returns.ts';

export type AcceptedGoodsObservation = {
  readonly observation: GoodsSourceObservation;
  readonly publicEvidence: PublicGoodsEvidence;
  readonly event: ProductiveEconomicEvent;
  readonly returnRecord: GoodsReturnRecord | null;
  readonly mintsMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
  readonly orderEqualsOutput: false;
  readonly paymentEqualsOutput: false;
  readonly networkCalls: 0;
};

export class GoodsCommerceDataFabric {
  readonly fabricVersion = 'sunrey.goods-commerce-data-fabric.v1';
  readonly productionActive = PRODUCTION_ACTIVE;
  readonly autoMints = GOODS_FACT_AUTO_MINTS;
  readonly realProviderContacted = REAL_PROVIDER_CONTACTED;

  private readonly accepted: AcceptedGoodsObservation[] = [];
  private readonly historic = new Map<string, GoodsSourceObservation>();

  ingest(observation: GoodsSourceObservation): Result<AcceptedGoodsObservation, GoodsRefusal> {
    if (observation.networkCallAttempted === true) {
      return err({ code: 'NETWORK_FORBIDDEN', detail: 'goods fabric does not contact real commerce providers' });
    }
    if (!isGoodsSourceClass(observation.sourceClass)) {
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unsupported source class ${observation.sourceClass}` });
    }
    if (isForbiddenGoodsFactType(observation.factType)) {
      return err({
        code: 'FORBIDDEN_FACT_TYPE',
        detail: `${observation.factType} is not a productive-output fact`,
      });
    }
    if (!isGoodsFactType(observation.factType)) {
      return err({ code: 'UNKNOWN_FACT_TYPE', detail: `do not invent synonym fact types; ${observation.factType}` });
    }
    const privacy = refusePrivacyLeaks(observation);
    if (!privacy.ok) {
      return privacy;
    }
    const quantity = parseIntegerMantissa(observation.numericValue, 'numericValue');
    if (!quantity.ok) {
      return quantity;
    }
    const schema = detectSchemaDrift(observation);
    if (!schema.ok) {
      return schema;
    }
    const independence = evaluateSourceIndependence([observation]);
    if (!independence.ok) {
      return independence;
    }
    const order = orderIsNotGoodsOutput(observation);
    if (!order.ok) {
      return order;
    }

    let returnRecord: GoodsReturnRecord | null = null;
    if (observation.goodsState === 'RETURNED' || observation.returnOfObservationId !== null) {
      const returned = evaluateGoodsReturn(observation, this.historic);
      if (!returned.ok) {
        return returned;
      }
      returnRecord = returned.value;
      const event = eventFromGoods(observation);
      const accepted = Object.freeze({
        observation,
        publicEvidence: publicEvidenceFrom(observation, 'DELIVERY'),
        event,
        returnRecord,
        mintsMoonRey: false as const,
        realProviderContacted: REAL_PROVIDER_CONTACTED,
        productionActive: PRODUCTION_ACTIVE,
        orderEqualsOutput: false as const,
        paymentEqualsOutput: false as const,
        networkCalls: 0 as const,
      });
      this.accepted.push(accepted);
      this.historic.set(observation.observationId, observation);
      return ok(accepted);
    }

    if (observation.factType === 'GOODS_OUTPUT') {
      const output = evaluateGoodsOutput(observation);
      if (!output.ok) {
        return output;
      }
    } else {
      const delivery = evaluateGoodsDelivery(observation);
      if (!delivery.ok) {
        return delivery;
      }
    }

    const event = eventFromGoods(observation);
    const accepted = Object.freeze({
      observation,
      publicEvidence: publicEvidenceFrom(
        observation,
        observation.factType === 'GOODS_DELIVERY' ? 'DELIVERY' : 'OUTPUT',
      ),
      event,
      returnRecord,
      mintsMoonRey: false as const,
      realProviderContacted: REAL_PROVIDER_CONTACTED,
      productionActive: PRODUCTION_ACTIVE,
      orderEqualsOutput: false as const,
      paymentEqualsOutput: false as const,
      networkCalls: 0 as const,
    });
    this.accepted.push(accepted);
    this.historic.set(observation.observationId, observation);
    return ok(accepted);
  }

  observations(): readonly AcceptedGoodsObservation[] {
    return this.accepted.map((row) => Object.freeze({ ...row }));
  }

  goodsFactCannotAutoMint(): true {
    if (!oracleFactCreationNeverMintsMoonRey() || this.autoMints !== false) {
      throw new Error('GOODS_FACT_AUTO_MINTS');
    }
    return true;
  }
}

export function ingestGoodsObservation(
  observation: GoodsSourceObservation,
): Result<AcceptedGoodsObservation, GoodsRefusal> {
  return new GoodsCommerceDataFabric().ingest(observation);
}

export function goodsObservationNeverMints(_accepted?: AcceptedGoodsObservation): true {
  if (!oracleFactCreationNeverMintsMoonRey()) {
    throw new Error('GOODS_FACT_AUTO_MINTS');
  }
  return true;
}
