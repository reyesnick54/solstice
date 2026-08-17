import { runSunreyOps } from './cli.ts';
import { ResiliencePlatform } from './platform.ts';

export function runOpsDemo(): Record<string, unknown> {
  const platform = new ResiliencePlatform();
  platform.validateObservabilityConfigs();
  const healthy = platform.health();
  const report = platform.run('END_TO_END_RESILIENCE');
  return {
    environment: 'simulation',
    health: healthy,
    report: {
      drillId: report.drillId,
      finalState: report.finalState,
      measuredRpoMs: report.measuredRpoMs.toString(),
      measuredRtoMs: report.measuredRtoMs.toString(),
      integrityChecks: report.integrityChecks,
      failures: report.failures,
    },
  };
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('demo.ts') || entry.endsWith('demo.js')) {
  console.log('SunRey multi-failure-domain resilience demo');
  console.log('ENVIRONMENT=simulation  ENGINEERING_TEST_TARGETS only');
  const result = runOpsDemo();
  console.log(JSON.stringify(result, null, 2));
  console.log('sunrey-ops health');
  console.log(runSunreyOps(['health']));
}
