import { lintTree, formatFindings } from './linter.ts';

const findings = lintTree(process.cwd());
if (findings.length > 0) {
  console.error(formatFindings(findings));
  console.error(`architectural-linter: ${findings.length} violation(s)`);
  process.exit(1);
}
console.log('architectural-linter: ok');
