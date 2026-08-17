import { runSanity } from './runner.ts';
import { toHumanSummary } from './result.ts';

const report = runSanity();
console.log(toHumanSummary(report));
if (!report.invariants.every((row) => row.ok)) {
  throw new Error('sunrey-bench demo invariants failed');
}
console.log('sunrey-bench demo ok — engineering measurements only');
