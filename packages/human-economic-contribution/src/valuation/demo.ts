import { asUtcInstant } from '../../../domain/src/time.ts';
import { HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION } from './constitution.ts';
import { SIMULATION_POLICY_FIXTURES } from './fixtures.ts';
import { hashValuationPolicy } from './policy.ts';
import { HumanContributionValuationPolicyRegistry } from './registry.ts';
import { createContributionReferenceValue } from './value.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function runHumanContributionValuationPolicyDemo(): {
  readonly PEVE_USED: false;
  readonly HUMAN_WORTH_SCORE: false;
  readonly SUNREY_QUANTITY: false;
  readonly PRODUCTION_VALUATION_ACTIVE: false;
} {
  const registry = new HumanContributionValuationPolicyRegistry();
  const now = asUtcInstant('2026-08-19T12:00:00.000Z');

  console.log('SunRey Human Contribution Valuation Constitution (CHUNK-110)');
  console.log(`constitution=${HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.constitutionId}`);
  console.log(`eventSpecific=${String(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_EVENT_SPECIFIC)}`);
  console.log('');

  for (const fixture of SIMULATION_POLICY_FIXTURES) {
    const stored = unwrap(registry.register(fixture));
    const active = unwrap(registry.resolveActiveSimulation(fixture.contributionClass, now));
    const reference = unwrap(
      createContributionReferenceValue({
        amount: 2500n,
        denomination: stored.policy.referenceDenomination,
        minorUnitPrecision: 2n,
        valueClass: fixture.method === 'CONTRACTUAL_COMPENSATION' ? 'CONTRACT_REFERENCE' : 'GOVERNED_SETTLEMENT_REFERENCE',
      }),
    );
    console.log(
      [
        stored.policy.contributionClass,
        `method=${stored.policy.method}`,
        `status=${stored.lifecycleStatus}`,
        `hash=${hashValuationPolicy(stored.policy)}`,
        `active=${active.policy.policyId === stored.policy.policyId}`,
        `amount=${reference.amount.toString()} ${reference.denomination}`,
        `isSunReyQuantity=${String(reference.isSunReyQuantity)}`,
        `createsMintAuthority=${String(reference.createsMintAuthority)}`,
      ].join(' | '),
    );
  }

  const production = registry.resolveActiveProduction();
  console.log('');
  console.log(`productionAvailable=${String(production.ok)}`);
  console.log('PEVE_USED=false');
  console.log('HUMAN_WORTH_SCORE=false');
  console.log('SUNREY_QUANTITY=false');
  console.log('PRODUCTION_VALUATION_ACTIVE=false');

  return {
    PEVE_USED: false,
    HUMAN_WORTH_SCORE: false,
    SUNREY_QUANTITY: false,
    PRODUCTION_VALUATION_ACTIVE: false,
  };
}

runHumanContributionValuationPolicyDemo();
