export type SameShaArtifactBinding = {
  readonly role: 'application' | 'migration-runner';
  readonly imageRef: string;
  readonly sourceCommit: string;
  readonly dockerfile: string;
};

export type SameShaRuleResult = {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly bindings: readonly SameShaArtifactBinding[];
};

export function evaluateSameShaMigrationRule(input: {
  readonly gitSha: string;
  readonly applicationSourceCommit: string;
  readonly migrationRunnerSourceCommit: string;
  readonly applicationDockerfile: string;
  readonly migrationRunnerDockerfile: string;
  readonly applicationImageRef: string;
  readonly migrationRunnerImageRef: string;
  readonly documentedCompatibilityException?: string | null;
}): SameShaRuleResult {
  const blockers: string[] = [];
  const normalizedSha = input.gitSha.trim().toLowerCase();

  if (!/^[0-9a-f]{40}$/.test(normalizedSha)) {
    blockers.push('release gitSha must be a 40-character object SHA');
  }

  if (input.applicationSourceCommit.trim().toLowerCase() !== normalizedSha) {
    blockers.push('application container SOURCE_COMMIT must match release gitSha');
  }

  if (input.migrationRunnerSourceCommit.trim().toLowerCase() !== normalizedSha) {
    blockers.push('migration runner SOURCE_COMMIT must match release gitSha');
  }

  if (input.applicationSourceCommit !== input.migrationRunnerSourceCommit && !input.documentedCompatibilityException) {
    blockers.push(
      'application and migration-runner SOURCE_COMMIT differ without documented compatibility exception',
    );
  }

  if (input.applicationDockerfile !== input.migrationRunnerDockerfile) {
    blockers.push('application and migration-runner must share the same Dockerfile for Hetzner sandbox releases');
  }

  const bindings: SameShaArtifactBinding[] = [
    {
      role: 'application',
      imageRef: input.applicationImageRef,
      sourceCommit: input.applicationSourceCommit,
      dockerfile: input.applicationDockerfile,
    },
    {
      role: 'migration-runner',
      imageRef: input.migrationRunnerImageRef,
      sourceCommit: input.migrationRunnerSourceCommit,
      dockerfile: input.migrationRunnerDockerfile,
    },
  ];

  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    bindings: Object.freeze(bindings),
  });
}
