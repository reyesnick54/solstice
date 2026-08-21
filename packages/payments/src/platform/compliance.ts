/**
 * Kernel / compliance hooks for payments.
 * Does not invent real sanctions, AML, or screening-provider results.
 */

import type { ScreeningPort, ScreeningSubject } from '../screening.ts';
import { SimulationScreeningAdapter } from '../screening.ts';

export const PAYMENT_COMPLIANCE_HOOKS = [
  'SANCTIONS',
  'AML',
  'BENEFICIARY_SCREENING',
  'TRANSACTION_MONITORING',
  'PURPOSE_OF_PAYMENT',
  'JURISDICTION_RESTRICTIONS',
] as const;
export type PaymentComplianceHook = (typeof PAYMENT_COMPLIANCE_HOOKS)[number];

export type PaymentComplianceSnapshot = {
  readonly hook: PaymentComplianceHook;
  readonly state: 'SIMULATION_CLEAR' | 'SIMULATION_REVIEW' | 'SIMULATION_BLOCK' | 'NOT_EVALUATED';
  readonly providerResultFaked: false;
  readonly detail: string;
};

export function evaluatePaymentComplianceHooks(input: {
  readonly screening: ScreeningPort;
  readonly subject: ScreeningSubject;
  readonly purpose: string;
  readonly sourceJurisdiction: string;
  readonly destinationCountry: string;
}): readonly PaymentComplianceSnapshot[] {
  const hit = input.screening.screen(input.subject);
  const sanctions: PaymentComplianceSnapshot = Object.freeze({
    hook: 'SANCTIONS',
    state: hit.sanctionsHit ? 'SIMULATION_BLOCK' : 'SIMULATION_CLEAR',
    providerResultFaked: false,
    detail: hit.sanctionsHit ? 'simulation screening reported a sanctions hit' : 'simulation screening clear',
  });
  const screening: PaymentComplianceSnapshot = Object.freeze({
    hook: 'BENEFICIARY_SCREENING',
    state: hit.pepHit || hit.fraudHold ? 'SIMULATION_REVIEW' : 'SIMULATION_CLEAR',
    providerResultFaked: false,
    detail: hit.status,
  });
  const aml: PaymentComplianceSnapshot = Object.freeze({
    hook: 'AML',
    state: hit.fraudHold ? 'SIMULATION_REVIEW' : 'SIMULATION_CLEAR',
    providerResultFaked: false,
    detail: 'Kernel remains the decision layer; no live AML vendor',
  });
  const monitoring: PaymentComplianceSnapshot = Object.freeze({
    hook: 'TRANSACTION_MONITORING',
    state: 'SIMULATION_CLEAR',
    providerResultFaked: false,
    detail: 'transaction monitoring uses existing simulation interfaces',
  });
  const purpose: PaymentComplianceSnapshot = Object.freeze({
    hook: 'PURPOSE_OF_PAYMENT',
    state: input.purpose.trim().length === 0 ? 'SIMULATION_REVIEW' : 'SIMULATION_CLEAR',
    providerResultFaked: false,
    detail: input.purpose.trim().length === 0 ? 'purpose required' : 'purpose recorded',
  });
  const jurisdiction: PaymentComplianceSnapshot = Object.freeze({
    hook: 'JURISDICTION_RESTRICTIONS',
    state: 'SIMULATION_CLEAR',
    providerResultFaked: false,
    detail: `${input.sourceJurisdiction}->${input.destinationCountry}; unknown corridors stay RESEARCH_REQUIRED`,
  });
  return Object.freeze([sanctions, screening, aml, monitoring, purpose, jurisdiction]);
}

export function simulationCompliancePort(): ScreeningPort {
  return new SimulationScreeningAdapter();
}
