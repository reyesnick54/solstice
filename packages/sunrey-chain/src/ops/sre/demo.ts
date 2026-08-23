import { runSreDemo } from './platform.ts';

const result = runSreDemo();
console.log(
  JSON.stringify(
    {
      PHASE_I_PROMPT_3: 'SRE_DR_DEMO',
      overall: result.overall,
      restore: result.restore,
      chaosPassed: result.chaosPassed,
      productionDisabled: result.productionDisabled,
      ENVIRONMENT: 'simulation',
      PRODUCTION_ACTIVE: false,
    },
    null,
    2,
  ),
);
