export type CaseCollision = {
  readonly variants: readonly string[];
};

export function findCaseCollisions(paths: readonly string[]): CaseCollision[];
export function formatCaseCollisionReport(collisions: readonly CaseCollision[]): string;
