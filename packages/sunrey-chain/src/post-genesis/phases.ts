/**
 * Governed post-genesis phase model.
 *
 * Advancement is evidence-driven. Chain health never inherits legal
 * authority onto regulated services.
 */

import type {
  PhaseAdmissionCriterion,
  PostGenesisEvidenceState,
  PostGenesisPhase,
} from './types.ts';
import { POST_GENESIS_PHASES } from './types.ts';

const PHASE_ORDER = new Map<PostGenesisPhase, number>(
  POST_GENESIS_PHASES.map((phase, index) => [phase, index]),
);

export function phaseIndex(phase: PostGenesisPhase): number {
  return PHASE_ORDER.get(phase) ?? 0;
}

export function canAdvancePhase(from: PostGenesisPhase, to: PostGenesisPhase): boolean {
  return phaseIndex(to) === phaseIndex(from) + 1;
}

export function defaultAdmissionCriteria(phase: PostGenesisPhase): readonly PhaseAdmissionCriterion[] {
  const engineering = criterion(
    `ADM-${phase}-ENG`,
    phase,
    'ENGINEERING',
    engineeringDescription(phase),
    phaseEngineeringDefault(phase),
    phaseEngineeringDefault(phase) ? 'ENGINEERING_VERIFIED' : 'NOT_PROVIDED',
    false,
  );
  const external = criterion(
    `ADM-${phase}-EXT`,
    phase,
    'EXTERNAL',
    externalDescription(phase),
    false,
    phase === 'CHAIN_STABILIZATION' ? 'NOT_APPLICABLE' : 'NOT_PROVIDED',
    phase !== 'CHAIN_STABILIZATION',
  );
  const human = criterion(
    `ADM-${phase}-HUM`,
    phase,
    'HUMAN',
    'Human governance authorization for phase advancement',
    false,
    phase === 'CHAIN_STABILIZATION' ? 'NOT_APPLICABLE' : 'NOT_PROVIDED',
    phase !== 'CHAIN_STABILIZATION',
  );
  return Object.freeze([engineering, external, human]);
}

export function phaseAdvanceAllowed(
  current: PostGenesisPhase,
  next: PostGenesisPhase,
  criteria: readonly PhaseAdmissionCriterion[],
): { readonly ok: boolean; readonly reasons: readonly string[] } {
  if (!canAdvancePhase(current, next)) {
    return { ok: false, reasons: Object.freeze([`phase advancement must be sequential: ${current} -> ${next}`]) };
  }
  const reasons: string[] = [];
  for (const row of criteria.filter((item) => item.phase === next)) {
    if (!row.satisfied) {
      reasons.push(`${row.kind} criterion ${row.criterionId} is not satisfied (${row.evidenceState})`);
    }
  }
  return { ok: reasons.length === 0, reasons: Object.freeze(reasons) };
}

function criterion(
  criterionId: string,
  phase: PostGenesisPhase,
  kind: PhaseAdmissionCriterion['kind'],
  description: string,
  satisfied: boolean,
  evidenceState: PostGenesisEvidenceState,
  missingEvidenceVisible: boolean,
): PhaseAdmissionCriterion {
  return Object.freeze({
    criterionId,
    phase,
    kind,
    description,
    satisfied,
    evidenceState,
    missingEvidenceVisible,
  });
}

function engineeringDescription(phase: PostGenesisPhase): string {
  switch (phase) {
    case 'CHAIN_STABILIZATION':
      return 'Consensus, validators, monitoring, and backups operate; financial capabilities remain disabled';
    case 'NATIVE_ASSET_LIMITED':
      return 'Native asset conservation and fee market remain conserved at checkpoints';
    case 'ORACLE_LIMITED':
      return 'Oracle technical health is measured without enabling production feeds';
    case 'ECONOMIC_SERVICES_LIMITED':
      return 'Economic audits pass without activating Exchange, custody, or fiat';
    case 'REGULATED_SERVICES_ELIGIBLE':
      return 'Each regulated capability still requires its own activation package';
    case 'FULL_CONFIGURED_OPERATIONS':
      return 'Configured operations remain independently gated and restriction-bound';
  }
}

function externalDescription(phase: PostGenesisPhase): string {
  switch (phase) {
    case 'CHAIN_STABILIZATION':
      return 'No external legal evidence is required for chain-only stabilization';
    case 'NATIVE_ASSET_LIMITED':
      return 'Native-asset production quantities remain UNCONFIGURED until external policy exists';
    case 'ORACLE_LIMITED':
      return 'Accepted provider, commercial/data-right, and governance evidence remain visible when missing';
    case 'ECONOMIC_SERVICES_LIMITED':
      return 'Treasury production spending requires configured policy and governance authorization';
    case 'REGULATED_SERVICES_ELIGIBLE':
      return 'Market, license, banking, privacy, and counsel evidence remain independently required';
    case 'FULL_CONFIGURED_OPERATIONS':
      return 'Configured operations cannot inherit missing external evidence from chain health';
  }
}

function phaseEngineeringDefault(phase: PostGenesisPhase): boolean {
  return phase === 'CHAIN_STABILIZATION';
}
