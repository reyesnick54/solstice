import type { AccountClass } from '../../domain/src/account-class.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import type { CardFormFactor } from './card.ts';
import { asCardProgramId, type CardProgramId } from './ids.ts';

export const CARD_PROGRAM_CAPABILITIES = [
  'AUTHORIZE',
  'CLEAR',
  'SETTLE',
  'REFUND',
  'REVERSE',
  'DISPUTE',
  'VIRTUAL_ISSUE',
  'PHYSICAL_METADATA',
] as const;

export type CardProgramCapability = (typeof CARD_PROGRAM_CAPABILITIES)[number];

/**
 * Card program metadata. Live capability is OFF. This is not a claim of
 * network sponsorship, BIN sponsorship, or issuing-bank approval.
 */
export type CardProgram = {
  readonly programId: CardProgramId;
  readonly legalEntityId: LegalEntityId;
  readonly currency: CurrencyCode;
  readonly fundingAccountClass: AccountClass;
  readonly region: string;
  readonly formFactors: readonly CardFormFactor[];
  readonly supportedCapabilities: readonly CardProgramCapability[];
  readonly simulationEnabled: boolean;
  readonly liveCapability: false;
  readonly policyCapabilityId: string;
  readonly authorizationHoldTtlMs: bigint;
  readonly clearingOverageToleranceMinor: bigint;
  readonly networkSponsorshipClaim: 'NONE';
};

export const DEFAULT_SIMULATION_HOLD_TTL_MS = 7n * 24n * 60n * 60n * 1000n;

export function freezeCardProgram(program: CardProgram): CardProgram {
  if (program.liveCapability !== false) {
    throw new TypeError('card program live capability must stay OFF');
  }
  return Object.freeze({
    ...program,
    liveCapability: false,
    networkSponsorshipClaim: 'NONE',
    formFactors: Object.freeze([...program.formFactors]),
    supportedCapabilities: Object.freeze([...program.supportedCapabilities]),
  });
}

export const SIMULATION_US_VIRTUAL_PROGRAM: CardProgram = freezeCardProgram({
  programId: asCardProgramId('prog_sim_us_virtual'),
  legalEntityId: asLegalEntityId('le_solstice_us_inc'),
  currency: asCurrencyCode('USD'),
  fundingAccountClass: 'DEMAND_DEPOSIT',
  region: 'US',
  formFactors: ['VIRTUAL', 'PHYSICAL'],
  supportedCapabilities: [
    'AUTHORIZE',
    'CLEAR',
    'SETTLE',
    'REFUND',
    'REVERSE',
    'DISPUTE',
    'VIRTUAL_ISSUE',
    'PHYSICAL_METADATA',
  ],
  simulationEnabled: true,
  liveCapability: false,
  policyCapabilityId: 'cap-us-sim-card-program',
  authorizationHoldTtlMs: DEFAULT_SIMULATION_HOLD_TTL_MS,
  clearingOverageToleranceMinor: 0n,
  networkSponsorshipClaim: 'NONE',
});

export const SIMULATION_GB_VIRTUAL_PROGRAM: CardProgram = freezeCardProgram({
  programId: asCardProgramId('prog_sim_gb_virtual'),
  legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
  currency: asCurrencyCode('USD'),
  fundingAccountClass: 'DEMAND_DEPOSIT',
  region: 'GB',
  formFactors: ['VIRTUAL', 'PHYSICAL'],
  supportedCapabilities: SIMULATION_US_VIRTUAL_PROGRAM.supportedCapabilities,
  simulationEnabled: true,
  liveCapability: false,
  policyCapabilityId: 'cap-gb-sim-card-program',
  authorizationHoldTtlMs: DEFAULT_SIMULATION_HOLD_TTL_MS,
  clearingOverageToleranceMinor: 0n,
  networkSponsorshipClaim: 'NONE',
});

export function simulationPrograms(): readonly CardProgram[] {
  return Object.freeze([SIMULATION_US_VIRTUAL_PROGRAM, SIMULATION_GB_VIRTUAL_PROGRAM]);
}

export function findCardProgram(programId: string): CardProgram | undefined {
  return simulationPrograms().find((program) => program.programId === programId);
}
