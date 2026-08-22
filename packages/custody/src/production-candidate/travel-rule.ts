import type { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import {
  evaluateTravelRuleApplicability,
  GB_SIMULATION_TRAVEL_RULE_PACK,
  type TravelRulePack,
} from '../travel-rule.ts';
import { FixtureTravelRuleCandidate } from '../provider-candidate/travel-rule.ts';
import type {
  TravelRuleAdapterRecord,
  TravelRuleComplianceStatus,
  TravelRuleMessageStatus,
} from './types.ts';
import { TRAVEL_RULE_ADAPTER_FLAGS } from './types.ts';

export type TravelRuleEvaluateInput = {
  readonly transferRef: string;
  readonly originatorJurisdiction: Jurisdiction;
  readonly quantity: AssetQuantity;
  readonly counterpartyIsVasp: boolean;
  readonly counterpartyVasp?: string;
  readonly originatorRef: string;
  readonly beneficiaryRef: string;
  readonly pack?: TravelRulePack;
  readonly scenario?: 'pending' | 'rejected' | 'failed' | 'complete';
};

export type TravelRuleProviderPort = {
  evaluate(input: TravelRuleEvaluateInput): TravelRuleAdapterRecord;
  retrieve(messageId: string): TravelRuleAdapterRecord | undefined;
};

export class TravelRuleAdapter implements TravelRuleProviderPort {
  readonly #candidate = new FixtureTravelRuleCandidate();
  readonly #records = new Map<string, TravelRuleAdapterRecord>();

  evaluate(input: TravelRuleEvaluateInput): TravelRuleAdapterRecord {
    const decision = evaluateTravelRuleApplicability({
      pack: input.pack ?? GB_SIMULATION_TRAVEL_RULE_PACK,
      originatorJurisdiction: input.originatorJurisdiction,
      quantity: input.quantity,
      counterpartyIsVasp: input.counterpartyIsVasp,
    });
    if (decision.applicability === 'NOT_APPLICABLE') {
      const record = this.record({
        messageId: `tr_${input.transferRef}_na`,
        transferRef: input.transferRef,
        counterpartyVasp: input.counterpartyVasp ?? null,
        originatorRef: input.originatorRef,
        beneficiaryRef: input.beneficiaryRef,
        applicability: 'NOT_APPLICABLE',
        messageStatus: 'NOT_CREATED',
        complianceStatus: 'NOT_APPLICABLE',
      });
      return record;
    }
    if (decision.applicability === 'RESEARCH_REQUIRED') {
      return this.record({
        messageId: `tr_${input.transferRef}_research`,
        transferRef: input.transferRef,
        counterpartyVasp: input.counterpartyVasp ?? null,
        originatorRef: input.originatorRef,
        beneficiaryRef: input.beneficiaryRef,
        applicability: 'RESEARCH_REQUIRED',
        messageStatus: 'NOT_CREATED',
        complianceStatus: 'RESEARCH_REQUIRED',
      });
    }
    const prepared = this.#candidate.prepare({
      messageId: `tr_${input.transferRef}`,
      withdrawalId: input.transferRef,
      recipientBinding: input.counterpartyVasp ?? 'vasp:sandbox',
      originatorRef: input.originatorRef,
      beneficiaryRef: input.beneficiaryRef,
      amountMinor: input.quantity.scaledUnits.toString(),
      currency: input.quantity.assetId,
    });
    if ('ok' in prepared && prepared.ok === false) {
      return this.require(`tr_${input.transferRef}`);
    }
    const scenario = input.scenario ?? 'complete';
    const statuses = statusesFor(scenario);
    return this.record({
      messageId: `tr_${input.transferRef}`,
      transferRef: input.transferRef,
      counterpartyVasp: input.counterpartyVasp ?? 'vasp:sandbox',
      originatorRef: input.originatorRef,
      beneficiaryRef: input.beneficiaryRef,
      applicability: 'REQUIRED_BY_PACK',
      messageStatus: statuses.message,
      complianceStatus: statuses.compliance,
    });
  }

  retrieve(messageId: string): TravelRuleAdapterRecord | undefined {
    return this.#records.get(messageId);
  }

  flags() {
    return TRAVEL_RULE_ADAPTER_FLAGS;
  }

  private record(input: {
    readonly messageId: string;
    readonly transferRef: string;
    readonly counterpartyVasp: string | null;
    readonly originatorRef: string;
    readonly beneficiaryRef: string;
    readonly applicability: TravelRuleAdapterRecord['applicability'];
    readonly messageStatus: TravelRuleMessageStatus;
    readonly complianceStatus: TravelRuleComplianceStatus;
  }): TravelRuleAdapterRecord {
    const record: TravelRuleAdapterRecord = Object.freeze({
      ...input,
      authorizesWithdrawal: false,
      requiredForEveryBlockchainAction: false,
      piiOnChain: false,
    });
    this.#records.set(record.messageId, record);
    return record;
  }

  private require(messageId: string): TravelRuleAdapterRecord {
    const current = this.#records.get(messageId);
    if (!current) {
      throw new Error(`unknown travel-rule record ${messageId}`);
    }
    return current;
  }
}

function statusesFor(scenario: 'pending' | 'rejected' | 'failed' | 'complete'): {
  readonly message: TravelRuleMessageStatus;
  readonly compliance: TravelRuleComplianceStatus;
} {
  if (scenario === 'pending') return { message: 'PENDING', compliance: 'APPLICABLE_PENDING' };
  if (scenario === 'rejected') return { message: 'REJECTED', compliance: 'REJECTED' };
  if (scenario === 'failed') return { message: 'FAILED', compliance: 'FAILED' };
  return { message: 'COMPLETED', compliance: 'COMPLETE' };
}
