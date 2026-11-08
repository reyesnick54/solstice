import type { UtcInstant } from '@solstice/domain';

import { registerShadowCapitalAccount } from '../alpha04-shadow-capital/registration.ts';
import { SHADOW_RESEARCH_POSTURE } from '../alpha04-shadow-capital/types.ts';
import type { ShadowCapitalAccount } from '../alpha04-shadow-capital/types.ts';
import type { CohortAllocationPolicy, ForwardCohort } from './types.ts';

export type CohortShadowCapitalLedger = {
  readonly memberAccounts: Readonly<Record<string, ShadowCapitalAccount>>;
  readonly sharedPortfolioAccount: ShadowCapitalAccount;
};

function defaultPolicy() {
  return Object.freeze({
    reinvestRealizedProfits: true,
    additionalDeployableMinor: null,
    settlementDelayDays: 0,
  });
}

/**
 * Each experimental strategy gets isolated research capital accounting; portfolio experiment models shared capital.
 */
export function bootstrapCohortShadowCapital(input: {
  readonly cohort: ForwardCohort;
  readonly registeredAt: UtcInstant;
  readonly currency?: string;
}): CohortShadowCapitalLedger {
  const currency = input.currency ?? 'USD';
  const policy = defaultPolicy();
  const { allocationPolicy, controlStrategies, treatmentStrategies } = input.cohort;
  const members = [...controlStrategies, ...treatmentStrategies];

  const memberAccounts: Record<string, ShadowCapitalAccount> = {};
  for (const member of members) {
    const weightBps = allocationPolicy.memberWeightBps[member.memberId];
    if (weightBps === undefined) {
      throw new Error(`ALPHA20 shadow bootstrap missing weight for ${member.memberId}`);
    }
    const notional =
      (BigInt(allocationPolicy.sharedPortfolioCapitalMinor) * BigInt(weightBps)) / 10_000n;
    memberAccounts[member.memberId] = registerShadowCapitalAccount({
      accountId: `shadow_${input.cohort.experimentId}_${member.memberId}`,
      registrationId: member.shadowCapitalRegistrationId,
      startingNotionalMinor: notional.toString(),
      currency,
      registeredAt: input.registeredAt,
      campaignPolicy: policy,
      strategyIds: Object.freeze([member.strategyId]),
    });
    if (memberAccounts[member.memberId]!.posture !== SHADOW_RESEARCH_POSTURE) {
      throw new Error('ALPHA20 shadow account must remain research-only posture');
    }
  }

  const sharedPortfolioAccount = registerShadowCapitalAccount({
    accountId: `shadow_portfolio_${input.cohort.experimentId}`,
    registrationId: `reg_portfolio_${input.cohort.experimentId}`,
    startingNotionalMinor: allocationPolicy.sharedPortfolioCapitalMinor,
    currency,
    registeredAt: input.registeredAt,
    campaignPolicy: policy,
    strategyIds: Object.freeze(members.map((m) => m.strategyId)),
  });

  return Object.freeze({
    memberAccounts: Object.freeze(memberAccounts),
    sharedPortfolioAccount,
  });
}

export function memberShadowNavMinor(
  ledger: CohortShadowCapitalLedger,
  memberId: string,
  navOverrideMinor?: string,
): string {
  const account = ledger.memberAccounts[memberId];
  if (!account) {
    throw new Error(`ALPHA20 unknown member ${memberId}`);
  }
  return navOverrideMinor ?? account.registration.startingNotionalMinor;
}

export function verifyIsolatedShadowPosture(ledger: CohortShadowCapitalLedger): boolean {
  for (const account of Object.values(ledger.memberAccounts)) {
    if (account.posture.customerMoneyUsed || account.posture.liveCapital || account.posture.financialEffectCreated) {
      return false;
    }
  }
  return !ledger.sharedPortfolioAccount.posture.customerMoneyUsed;
}

export function sumMemberWeightsConserved(policy: CohortAllocationPolicy): boolean {
  const sum = Object.values(policy.memberWeightBps).reduce((s, v) => s + v, 0);
  return sum === 10_000;
}
