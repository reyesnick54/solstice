export const MESH_RUN_STATES = [
  'CREATED',
  'CONTEXT_BOUND',
  'ANALYZING',
  'GENERATING_CANDIDATES',
  'CHALLENGING',
  'RISK_EVALUATING',
  'ARBITRATING',
  'PROPOSAL_READY',
  'COMPLETED',
  'REFUSED',
  'FAILED',
  'STALE',
  'CANCELLED',
] as const;

export type MeshRunState = (typeof MESH_RUN_STATES)[number];

export const LEGAL_MESH_TRANSITIONS: Readonly<Record<MeshRunState, readonly MeshRunState[]>> = Object.freeze({
  CREATED: Object.freeze(['CONTEXT_BOUND', 'CANCELLED', 'FAILED'] as const),
  CONTEXT_BOUND: Object.freeze(['ANALYZING', 'REFUSED', 'CANCELLED', 'FAILED'] as const),
  ANALYZING: Object.freeze(['GENERATING_CANDIDATES', 'REFUSED', 'CANCELLED', 'FAILED'] as const),
  GENERATING_CANDIDATES: Object.freeze(['CHALLENGING', 'REFUSED', 'CANCELLED', 'FAILED'] as const),
  CHALLENGING: Object.freeze(['RISK_EVALUATING', 'REFUSED', 'CANCELLED', 'FAILED'] as const),
  RISK_EVALUATING: Object.freeze(['ARBITRATING', 'REFUSED', 'CANCELLED', 'FAILED'] as const),
  ARBITRATING: Object.freeze(['PROPOSAL_READY', 'REFUSED', 'COMPLETED', 'CANCELLED', 'FAILED'] as const),
  PROPOSAL_READY: Object.freeze(['COMPLETED', 'STALE', 'CANCELLED'] as const),
  COMPLETED: Object.freeze(['STALE'] as const),
  REFUSED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
  STALE: Object.freeze([] as const),
  CANCELLED: Object.freeze([] as const),
});

export function canTransition(from: MeshRunState, to: MeshRunState): boolean {
  return LEGAL_MESH_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: MeshRunState, to: MeshRunState): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal mesh run transition ${from} -> ${to}`);
  }
}
