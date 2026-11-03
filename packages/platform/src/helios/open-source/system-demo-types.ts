export type SystemDemoStepStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'INTEGRATION_PENDING';

export type SystemDemoStep = {
  readonly stage: string;
  readonly status: SystemDemoStepStatus;
  readonly detail: string;
};

export type OpenSourceSystemDemoResult = {
  readonly steps: readonly SystemDemoStep[];
  readonly pass: boolean;
  readonly openSourceStagesPending: number;
};
