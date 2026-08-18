/**
 * Manual extended Mainnet RC workflows.
 *
 * These do not claim a duration or campaign that was not executed.
 */

export type ExtendedWorkflowId =
  | 'soak'
  | 'extended-fuzz'
  | 'formal-extended'
  | 'full-adversarial-range'
  | 'long-horizon-economics';

export type ExtendedWorkflowRecord = {
  readonly id: ExtendedWorkflowId;
  readonly executed: false;
  readonly claimedDurationCompleted: false;
  readonly notes: string;
};

export const MANUAL_EXTENDED_WORKFLOWS: readonly ExtendedWorkflowRecord[] = Object.freeze([
  Object.freeze({
    id: 'soak',
    executed: false,
    claimedDurationCompleted: false,
    notes: 'Manual soak. Do not claim multi-day duration unless that duration completed.',
  }),
  Object.freeze({
    id: 'extended-fuzz',
    executed: false,
    claimedDurationCompleted: false,
    notes: 'Run FUZZ_EXTENDED outside PR CI. Bind corpus hash and campaign configuration.',
  }),
  Object.freeze({
    id: 'formal-extended',
    executed: false,
    claimedDurationCompleted: false,
    notes: 'FORMAL_EXTENDED bounds remain separate if expensive. State exact model bounds.',
  }),
  Object.freeze({
    id: 'full-adversarial-range',
    executed: false,
    claimedDurationCompleted: false,
    notes: 'Full Chunk 57 range is a manual workflow. CI runs critical scenarios only.',
  }),
  Object.freeze({
    id: 'long-horizon-economics',
    executed: false,
    claimedDurationCompleted: false,
    notes: 'Long-horizon Chunk 76 campaigns are extended. Smoke/critical+compound run in qualification.',
  }),
]);

export function listExtendedWorkflows(): readonly ExtendedWorkflowRecord[] {
  return MANUAL_EXTENDED_WORKFLOWS;
}
