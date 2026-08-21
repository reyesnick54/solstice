import { qualifyEngineeringClosure } from './qualify.ts';
import { formatEngineeringClosureReport, writeEngineeringClosureDocuments } from './report.ts';

export function runSunReyEngineeringClosureDemo(root = process.cwd()): string {
  const bundle = qualifyEngineeringClosure(root, { burnInProfile: 'STANDARD' });
  writeEngineeringClosureDocuments(bundle, root);
  const text = formatEngineeringClosureReport(bundle);
  console.log(text);
  return text;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('demo.ts')) {
  runSunReyEngineeringClosureDemo();
}
