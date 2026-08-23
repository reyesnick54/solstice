import { Money } from '../../../../money/src/money.ts';
import { RoundingMode } from '../../../../money/src/money.ts';
import type { KnownFee } from './types.ts';
import type { ReturnAssumption } from './types.ts';

export function catalogFees(assumption: ReturnAssumption, notional: Money): readonly KnownFee[] {
  const sleeve: KnownFee = {
    code: 'SIMULATION_SLEEVE_FEE',
    description: 'Catalog simulation sleeve fee included in projections when assumptions are available',
    certainty: assumption.availability === 'AVAILABLE' && assumption.feeBpsAnnual !== undefined ? 'KNOWN' : 'ESTIMATE',
    ...(assumption.feeBpsAnnual !== undefined ? { annualBps: assumption.feeBpsAnnual } : {}),
    ...(assumption.availability === 'AVAILABLE' && assumption.feeBpsAnnual !== undefined
      ? { amount: notional.allocate(BigInt(assumption.feeBpsAnnual), 10000n, RoundingMode.HALF_EVEN).toJSON() }
      : {}),
    includedInProjection: assumption.availability === 'AVAILABLE',
    note:
      assumption.availability === 'AVAILABLE'
        ? 'Known catalog fee. Not omitted to improve illustrated results.'
        : 'Sleeve fee unavailable because return assumptions are unavailable.',
  };
  const provider: KnownFee = {
    code: 'PROVIDER_PRODUCT_FEE',
    description: 'Provider or product fee until a live quote exists',
    certainty: 'ESTIMATE',
    includedInProjection: false,
    note: 'Estimate only. Live provider fees are not connected. Production remains disabled.',
  };
  return Object.freeze([Object.freeze(sleeve), Object.freeze(provider)]);
}
