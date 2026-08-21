import { assertNoPrivateKeyMaterial } from '../../ops/logging.ts';
import { qualifyEngineeringClosure } from './qualify.ts';
import { formatEngineeringClosureReport, writeEngineeringClosureDocuments } from './report.ts';

export type EngineeringClosureCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function engineeringClosureUsage(): string {
  return [
    'sunrey-ops production engineering-closure verify',
    'sunrey-ops production engineering-closure report',
    'sunrey-ops production engineering-closure write',
  ].join('\n');
}

export function runEngineeringClosureCommand(argv: readonly string[], root = process.cwd()): EngineeringClosureCliResult {
  process.env.SUNREY_FIXTURE_ENV ??= 'local';
  const [command = 'help'] = argv;
  if (command === 'help') {
    return { ok: true, command: 'help', payload: { usage: engineeringClosureUsage(), productionActive: false } };
  }
  const bundle = qualifyEngineeringClosure(root, { burnInProfile: command === 'report' ? 'SMOKE' : 'STANDARD' });
  if (command === 'write') {
    writeEngineeringClosureDocuments(bundle, root);
  }
  const payload = command === 'report' || command === 'write' ? bundle : { report: bundle.report, receipts: bundle.receipts };
  const text = formatEngineeringClosureReport(bundle);
  assertNoPrivateKeyMaterial(payload);
  return {
    ok: bundle.report.coreCodeCompleteCandidate && bundle.report.productionActive === false,
    command,
    payload: { ...payload, text },
  };
}
