export type BehaviorPolicySnapshotId = `bps_${string}`;

export function asBehaviorPolicySnapshotId(value: string): BehaviorPolicySnapshotId {
  if (!value.startsWith('bps_') || value.length < 5) {
    throw new Error(`invalid BehaviorPolicySnapshotId: ${value}`);
  }
  return value as BehaviorPolicySnapshotId;
}
