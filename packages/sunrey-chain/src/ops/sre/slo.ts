import { SLO_LABEL } from '../types.ts';
import { ENGINEERING_TARGET_LABEL, SLI_IDS, type ProductizationSlo, type SliId } from './types.ts';

const TARGETS: Readonly<Record<SliId, string>> = Object.freeze({
  API_AVAILABILITY: '99.5 percent good events over a preproduction measurement window',
  API_LATENCY: '95 percent of requests <= 500ms in the preproduction window',
  AUTHENTICATION_SUCCESS: '99.0 percent infrastructure-successful authentications',
  LEDGER_POSTING: '99.9 percent of authorized posts commit; invariant failures are SEV1 not burned as latency',
  PAYMENT_ORCHESTRATION: '99.0 percent reach a terminal state without SUBMISSION_UNKNOWN remainder',
  PROVIDER_SUCCESS: '99.0 percent technical success in the drill window',
  FX_QUOTE: '99.0 percent of quotes are fresh enough to use, or same-currency path remains available',
  AGENT_RESPONSE: '95.0 percent structured proposal or explicit refuse; model timeout is not a money failure',
  EXCHANGE_ORDER_PROCESSING: '99.0 percent of accepted orders reach a terminal engineering state',
  CHAIN_FINALITY: 'finality when connected voting power >= two-thirds-plus',
  WALLET_PROCESSING: '99.0 percent of wallet operations leave the backlog in the drill window',
  RECONCILIATION: '100 percent of windows close with zero unmatched breaks or an open incident',
});

export function productizationSlos(): readonly ProductizationSlo[] {
  return Object.freeze(
    SLI_IDS.map((sliId) =>
      Object.freeze({
        sliId,
        label: ENGINEERING_TARGET_LABEL,
        existingOpsLabel: SLO_LABEL,
        proposedTarget: TARGETS[sliId],
        contractualSla: false,
        humanApproved: false,
      }),
    ),
  );
}

export function assertEngineeringTargets(slos: readonly ProductizationSlo[] = productizationSlos()): void {
  for (const slo of slos) {
    if (slo.label !== ENGINEERING_TARGET_LABEL) {
      throw new Error(`${slo.sliId} is not labeled ${ENGINEERING_TARGET_LABEL}`);
    }
    if (slo.contractualSla !== false || slo.humanApproved !== false) {
      throw new Error(`${slo.sliId} must remain an unapproved engineering target`);
    }
  }
  if (slos.length !== SLI_IDS.length) {
    throw new Error('productization SLO catalog is incomplete');
  }
}
