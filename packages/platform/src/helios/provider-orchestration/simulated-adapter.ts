/**
 * Simulated sandbox provider adapters for orchestration qualification.
 *
 * Injected/fake transports only. Does not activate production or invent
 * real provider credentials.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type {
  AdapterAccountOutcome,
  AdapterAccountQueryInput,
  AdapterAccountSubmitInput,
  AdapterFundingOutcome,
  AdapterFundingQueryInput,
  AdapterFundingSubmitInput,
  AdapterWalletOutcome,
  AdapterWalletQueryInput,
  AdapterWalletSubmitInput,
  CustodyWalletAdapterPort,
  FundingAdapterPort,
  InvestmentAccountAdapterPort,
} from './adapter-port.ts';
import type { CustomerActionRequirement } from './types.ts';

type ScenarioKey = string;

type StoredAccount = {
  readonly idempotencyKey: string;
  readonly payloadDigest: string;
  readonly providerObjectId: string;
  readonly scenario: ScenarioKey;
  readonly submittedAt: UtcInstant;
};

type StoredFunding = {
  readonly idempotencyKey: string;
  readonly payloadDigest: string;
  readonly providerObjectId: string;
  readonly scenario: ScenarioKey;
  readonly submittedAt: UtcInstant;
};

type StoredWallet = {
  readonly idempotencyKey: string;
  readonly payloadDigest: string;
  readonly providerObjectId: string;
  readonly scenario: ScenarioKey;
  readonly submittedAt: UtcInstant;
};

function digestAccount(input: AdapterAccountSubmitInput): string {
  return `${input.customerId}:${input.accountType}:${input.productRequested}`;
}

function digestFunding(input: AdapterFundingSubmitInput): string {
  return `${input.customerId}:${input.destinationAccountRef}:${input.amountMinor}`;
}

function digestWallet(input: AdapterWalletSubmitInput): string {
  return `${input.customerId}:${input.assetId}:${input.networkId}`;
}

function actionRequired(kind: CustomerActionRequirement['kind'], description: string): CustomerActionRequirement {
  return Object.freeze({
    requirementId: `req_${kind.toLowerCase()}`,
    kind,
    description,
    providerReference: null,
    dueBy: null,
    aiMayComplete: false,
  });
}

function accountOutcomeForScenario(
  scenario: ScenarioKey,
  providerObjectId: string,
  submittedAt: UtcInstant,
  now: UtcInstant,
): AdapterAccountOutcome {
  switch (scenario) {
    case 'action_required':
      return {
        status: 'ACTION_REQUIRED',
        providerObjectId,
        providerAccountRef: null,
        providerTimestamp: now,
        rawStatus: 'action_required',
        actionRequirements: Object.freeze([
          actionRequired('TAX_FORM', 'Complete W-9 tax certification'),
        ]),
        capabilityState: 'SANDBOX_AVAILABLE',
      };
    case 'reject':
      return {
        status: 'REJECTED',
        providerObjectId,
        providerAccountRef: null,
        providerTimestamp: now,
        rawStatus: 'rejected',
        actionRequirements: Object.freeze([]),
        capabilityState: 'SANDBOX_AVAILABLE',
      };
    case 'unknown':
      return {
        status: 'UNKNOWN',
        providerObjectId,
        providerAccountRef: null,
        providerTimestamp: null,
        rawStatus: 'unknown',
        actionRequirements: Object.freeze([]),
        capabilityState: 'SANDBOX_AVAILABLE',
      };
    case 'pending_then_approve':
      if (Date.parse(now) - Date.parse(submittedAt) < 1000) {
        return {
          status: 'PENDING',
          providerObjectId,
          providerAccountRef: null,
          providerTimestamp: now,
          rawStatus: 'pending',
          actionRequirements: Object.freeze([]),
          capabilityState: 'SANDBOX_AVAILABLE',
        };
      }
      return {
        status: 'APPROVED',
        providerObjectId,
        providerAccountRef: `sim_acct_${providerObjectId}`,
        providerTimestamp: now,
        rawStatus: 'approved',
        actionRequirements: Object.freeze([]),
        capabilityState: 'SANDBOX_AVAILABLE',
      };
    case 'unavailable':
      throw new Error('PROVIDER_UNAVAILABLE');
    default:
      return {
        status: 'APPROVED',
        providerObjectId,
        providerAccountRef: `sim_acct_${providerObjectId}`,
        providerTimestamp: now,
        rawStatus: 'approved',
        actionRequirements: Object.freeze([]),
        capabilityState: 'SANDBOX_AVAILABLE',
      };
  }
}

function fundingOutcomeForScenario(
  scenario: ScenarioKey,
  providerObjectId: string,
  submittedAt: UtcInstant,
  now: UtcInstant,
): AdapterFundingOutcome {
  switch (scenario) {
    case 'fail':
      return {
        status: 'FAILED',
        providerObjectId,
        providerTimestamp: now,
        rawStatus: 'failed',
        actionRequirements: Object.freeze([]),
      };
    case 'unknown':
      return {
        status: 'UNKNOWN',
        providerObjectId,
        providerTimestamp: null,
        rawStatus: 'unknown',
        actionRequirements: Object.freeze([]),
      };
    case 'settle_delayed':
      if (Date.parse(now) - Date.parse(submittedAt) < 1000) {
        return {
          status: 'PENDING',
          providerObjectId,
          providerTimestamp: now,
          rawStatus: 'pending',
          actionRequirements: Object.freeze([]),
        };
      }
      return {
        status: 'SETTLED',
        providerObjectId,
        providerTimestamp: now,
        rawStatus: 'settled',
        actionRequirements: Object.freeze([]),
      };
    case 'unavailable':
      throw new Error('PROVIDER_UNAVAILABLE');
    default:
      return {
        status: 'SETTLED',
        providerObjectId,
        providerTimestamp: now,
        rawStatus: 'settled',
        actionRequirements: Object.freeze([]),
      };
  }
}

function walletOutcomeForScenario(
  scenario: ScenarioKey,
  providerObjectId: string,
  now: UtcInstant,
): AdapterWalletOutcome {
  if (scenario === 'fail') {
    return {
      status: 'FAILED',
      providerObjectId,
      addressOrReference: null,
      providerTimestamp: now,
      rawStatus: 'failed',
      signingCredentialExposed: false,
    };
  }
  if (scenario === 'unavailable') {
    throw new Error('PROVIDER_UNAVAILABLE');
  }
  return {
    status: 'PROVISIONED',
    providerObjectId,
    addressOrReference: `sim_addr_${providerObjectId}`,
    providerTimestamp: now,
    rawStatus: 'provisioned',
    signingCredentialExposed: false,
  };
}

export type SimulatedProviderScenarioRegistry = {
  setAccountScenario(idempotencyKey: string, scenario: ScenarioKey): void;
  setFundingScenario(idempotencyKey: string, scenario: ScenarioKey): void;
  setWalletScenario(idempotencyKey: string, scenario: ScenarioKey): void;
  markProviderUnavailable(providerId: string): void;
  markProviderAvailable(providerId: string): void;
};

export function createSimulatedInvestmentAdapter(
  providerId: string,
): InvestmentAccountAdapterPort & SimulatedProviderScenarioRegistry {
  const accounts = new Map<string, StoredAccount>();
  const scenarios = new Map<string, ScenarioKey>();
  let unavailable = false;

  return {
    providerId,
    setAccountScenario(idempotencyKey: string, scenario: ScenarioKey): void {
      scenarios.set(`acct:${idempotencyKey}`, scenario);
    },
    setFundingScenario(): void {
      /* investment adapter does not handle funding */
    },
    setWalletScenario(): void {
      /* investment adapter does not handle wallets */
    },
    markProviderUnavailable(): void {
      unavailable = true;
    },
    markProviderAvailable(): void {
      unavailable = false;
    },
    submitApplication(input: AdapterAccountSubmitInput): AdapterAccountOutcome {
      if (unavailable) {
        throw new Error('PROVIDER_UNAVAILABLE');
      }
      const payloadDigest = digestAccount(input);
      const existing = accounts.get(input.idempotencyKey);
      if (existing) {
        if (existing.payloadDigest !== payloadDigest) {
          throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
        }
        const scenario = scenarios.get(`acct:${input.idempotencyKey}`) ?? 'approve';
        return accountOutcomeForScenario(
          scenario,
          existing.providerObjectId,
          existing.submittedAt,
          input.now,
        );
      }
      const providerObjectId = `sim_app_${input.idempotencyKey.slice(0, 12)}`;
      const scenario = scenarios.get(`acct:${input.idempotencyKey}`) ?? 'approve';
      const submittedAt = input.now;
      accounts.set(input.idempotencyKey, {
        idempotencyKey: input.idempotencyKey,
        payloadDigest,
        providerObjectId,
        scenario,
        submittedAt,
      });
      if (scenario === 'pending_then_approve') {
        return accountOutcomeForScenario(scenario, providerObjectId, submittedAt, input.now);
      }
      return accountOutcomeForScenario(scenario, providerObjectId, submittedAt, input.now);
    },
    queryApplication(input: AdapterAccountQueryInput): AdapterAccountOutcome {
      if (unavailable) {
        throw new Error('PROVIDER_UNAVAILABLE');
      }
      const stored = [...accounts.values()].find((row) => row.providerObjectId === input.providerObjectId);
      if (!stored) {
        return {
          status: 'UNKNOWN',
          providerObjectId: input.providerObjectId,
          providerAccountRef: null,
          providerTimestamp: null,
          rawStatus: 'not_found',
          actionRequirements: Object.freeze([]),
          capabilityState: null,
        };
      }
      return accountOutcomeForScenario(
        stored.scenario,
        stored.providerObjectId,
        stored.submittedAt,
        input.now,
      );
    },
  };
}

export function createSimulatedFundingAdapter(
  providerId: string,
): FundingAdapterPort & Pick<SimulatedProviderScenarioRegistry, 'setFundingScenario' | 'markProviderUnavailable' | 'markProviderAvailable'> {
  const operations = new Map<string, StoredFunding>();
  const scenarios = new Map<string, ScenarioKey>();
  let unavailable = false;

  return {
    providerId,
    setFundingScenario(idempotencyKey: string, scenario: ScenarioKey): void {
      scenarios.set(`fund:${idempotencyKey}`, scenario);
    },
    markProviderUnavailable(): void {
      unavailable = true;
    },
    markProviderAvailable(): void {
      unavailable = false;
    },
    verifyFundingOwnership(input): { readonly verified: boolean; readonly reason: string } {
      if (!input.sourceAccountRef.startsWith(`owned:${input.customerId}:`)) {
        return Object.freeze({
          verified: false,
          reason: 'source account ownership evidence missing',
        });
      }
      return Object.freeze({ verified: true, reason: 'provider ownership evidence present' });
    },
    submitFunding(input: AdapterFundingSubmitInput): AdapterFundingOutcome {
      if (unavailable) {
        throw new Error('PROVIDER_UNAVAILABLE');
      }
      const payloadDigest = digestFunding(input);
      const existing = operations.get(input.idempotencyKey);
      if (existing) {
        if (existing.payloadDigest !== payloadDigest) {
          throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
        }
        const scenario = scenarios.get(`fund:${input.idempotencyKey}`) ?? 'settle';
        return fundingOutcomeForScenario(
          scenario,
          existing.providerObjectId,
          existing.submittedAt,
          input.now,
        );
      }
      const providerObjectId = `sim_fund_${input.idempotencyKey.slice(0, 12)}`;
      const scenario = scenarios.get(`fund:${input.idempotencyKey}`) ?? 'settle';
      const submittedAt = input.now;
      operations.set(input.idempotencyKey, {
        idempotencyKey: input.idempotencyKey,
        payloadDigest,
        providerObjectId,
        scenario,
        submittedAt,
      });
      return fundingOutcomeForScenario(scenario, providerObjectId, submittedAt, input.now);
    },
    queryFunding(input: AdapterFundingQueryInput): AdapterFundingOutcome {
      if (unavailable) {
        throw new Error('PROVIDER_UNAVAILABLE');
      }
      const stored = [...operations.values()].find((row) => row.providerObjectId === input.providerObjectId);
      if (!stored) {
        return {
          status: 'UNKNOWN',
          providerObjectId: input.providerObjectId,
          providerTimestamp: null,
          rawStatus: 'not_found',
          actionRequirements: Object.freeze([]),
        };
      }
      return fundingOutcomeForScenario(
        stored.scenario,
        stored.providerObjectId,
        stored.submittedAt,
        input.now,
      );
    },
  };
}

export function createSimulatedCustodyWalletAdapter(
  custodyProviderId: string,
): CustodyWalletAdapterPort & Pick<SimulatedProviderScenarioRegistry, 'setWalletScenario' | 'markProviderUnavailable' | 'markProviderAvailable'> {
  const wallets = new Map<string, StoredWallet>();
  const scenarios = new Map<string, ScenarioKey>();
  let unavailable = false;

  return {
    custodyProviderId,
    setWalletScenario(idempotencyKey: string, scenario: ScenarioKey): void {
      scenarios.set(`wallet:${idempotencyKey}`, scenario);
    },
    markProviderUnavailable(): void {
      unavailable = true;
    },
    markProviderAvailable(): void {
      unavailable = false;
    },
    submitWalletProvision(input: AdapterWalletSubmitInput): AdapterWalletOutcome {
      if (unavailable) {
        throw new Error('PROVIDER_UNAVAILABLE');
      }
      const payloadDigest = digestWallet(input);
      const existing = wallets.get(input.idempotencyKey);
      if (existing) {
        if (existing.payloadDigest !== payloadDigest) {
          throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
        }
        const scenario = scenarios.get(`wallet:${input.idempotencyKey}`) ?? 'provision';
        return walletOutcomeForScenario(scenario, existing.providerObjectId, input.now);
      }
      const providerObjectId = `sim_wallet_${input.idempotencyKey.slice(0, 12)}`;
      const scenario = scenarios.get(`wallet:${input.idempotencyKey}`) ?? 'provision';
      wallets.set(input.idempotencyKey, {
        idempotencyKey: input.idempotencyKey,
        payloadDigest,
        providerObjectId,
        scenario,
        submittedAt: input.now,
      });
      return walletOutcomeForScenario(scenario, providerObjectId, input.now);
    },
    queryWalletProvision(input: AdapterWalletQueryInput): AdapterWalletOutcome {
      if (unavailable) {
        throw new Error('PROVIDER_UNAVAILABLE');
      }
      const stored = [...wallets.values()].find((row) => row.providerObjectId === input.providerObjectId);
      if (!stored) {
        return {
          status: 'UNKNOWN',
          providerObjectId: input.providerObjectId,
          addressOrReference: null,
          providerTimestamp: null,
          rawStatus: 'not_found',
          signingCredentialExposed: false,
        };
      }
      return walletOutcomeForScenario(stored.scenario, stored.providerObjectId, asUtcInstant(input.now));
    },
  };
}
