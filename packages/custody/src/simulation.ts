import { createHmac, randomUUID } from 'node:crypto';

import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { asVaspId } from './ids.ts';
import type {
  CustodyProviderPort,
  DestinationRiskProvider,
  TravelRuleNetworkPort,
} from './ports.ts';
import type { SimulatedVasp } from './types.ts';

export const SIMULATION_CUSTODY_HMAC_SECRET = 'simulation-custody-hmac-not-a-production-key';

export function signSimulationNotice(material: string): string {
  return createHmac('sha256', SIMULATION_CUSTODY_HMAC_SECRET).update(material).digest('hex');
}

export class SimulationCustodyProvider implements CustodyProviderPort {
  readonly mode = 'SIMULATION_ONLY' as const;
  private readonly addresses = new Map<string, { custodyAccountId: string; customerId: string }>();
  private readonly submissions = new Map<
    string,
    { txRef: string; confirmations: number; destination: string; amount: bigint }
  >();
  private operational = 0n;
  private unknownNext = false;

  mapCustomerAddress(address: string, custodyAccountId: string, customerId: string): void {
    this.addresses.set(address, { custodyAccountId, customerId });
  }

  mapAddress(address: string): { readonly custodyAccountId: string; readonly customerId: string } | null {
    return this.addresses.get(address) ?? null;
  }

  ingestNotice(material: string, signatureHex: string): { readonly authentic: boolean } {
    const expected = signSimulationNotice(material);
    return { authentic: expected === signatureHex };
  }

  forceNextUnknown(): void {
    this.unknownNext = true;
  }

  submitWithdrawal(input: {
    readonly withdrawalId: string;
    readonly destination: string;
    readonly amount: AssetQuantity;
    readonly timeout?: boolean;
  }):
    | { readonly kind: 'SUBMITTED'; readonly submissionId: string; readonly txRef: string }
    | { readonly kind: 'SUBMISSION_UNKNOWN'; readonly submissionId: string; readonly reason: string } {
    if (input.timeout || this.unknownNext) {
      this.unknownNext = false;
      const submissionId = `csub_${randomUUID().replace(/-/g, '')}`;
      const txRef = `simtx_${randomUUID().replace(/-/g, '')}`;
      this.submissions.set(submissionId, {
        txRef,
        confirmations: 0,
        destination: input.destination,
        amount: input.amount.scaledUnits,
      });
      return {
        kind: 'SUBMISSION_UNKNOWN',
        submissionId,
        reason: 'network timeout after possible broadcast',
      };
    }
    const submissionId = `csub_${randomUUID().replace(/-/g, '')}`;
    const txRef = `simtx_${randomUUID().replace(/-/g, '')}`;
    this.submissions.set(submissionId, {
      txRef,
      confirmations: 6,
      destination: input.destination,
      amount: input.amount.scaledUnits,
    });
    this.operational += input.amount.scaledUnits;
    return { kind: 'SUBMITTED', submissionId, txRef };
  }

  queryWithdrawal(submissionId: string):
    | { readonly kind: 'FINALIZED'; readonly txRef: string; readonly confirmations: number }
    | { readonly kind: 'UNKNOWN' }
    | { readonly kind: 'NOT_FOUND' } {
    const found = this.submissions.get(submissionId);
    if (!found) {
      return { kind: 'NOT_FOUND' };
    }
    if (found.confirmations >= 1) {
      return { kind: 'FINALIZED', txRef: found.txRef, confirmations: found.confirmations };
    }
    found.confirmations = 6;
    this.operational += found.amount;
    return { kind: 'FINALIZED', txRef: found.txRef, confirmations: found.confirmations };
  }

  operationalBalance(assetId: string): AssetQuantity {
    return AssetQuantity.fromScaledUnits(this.operational, assetId);
  }
}

export class SimulationDestinationRiskProvider implements DestinationRiskProvider {
  screen(input: {
    readonly address: string;
    readonly customerId: string;
    readonly assetId: string;
  }): { readonly outcome: 'CLEAR' | 'REVIEW' | 'BLOCK'; readonly reason: string } {
    void input.customerId;
    void input.assetId;
    if (input.address.includes('high-risk') || input.address.includes('blocked')) {
      return { outcome: 'BLOCK', reason: 'simulated high-risk destination' };
    }
    return { outcome: 'CLEAR', reason: 'simulated destination clear' };
  }
}

export const SIMULATION_COUNTERPARTY_VASP: SimulatedVasp = Object.freeze({
  vaspId: asVaspId('vasp_simulation_counterparty'),
  displayName: 'Simulation Counterparty VASP',
  jurisdiction: 'GB' as SimulatedVasp['jurisdiction'],
  licensingClaim: 'NONE',
  legalStatus: 'RESEARCH_REQUIRED',
  simulationOnly: true,
});

export class SimulationTravelRuleNetwork implements TravelRuleNetworkPort {
  readonly mode = 'SIMULATION_ONLY' as const;

  discoverCounterparty(address: string): SimulatedVasp | null {
    if (address.includes('high-risk') || address.includes('blocked')) {
      return null;
    }
    return SIMULATION_COUNTERPARTY_VASP;
  }

  submit(): { readonly acknowledged: boolean } {
    return { acknowledged: true };
  }
}
