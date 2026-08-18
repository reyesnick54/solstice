/**
 * Chunk 87 pre-genesis shadow qualification demo.
 * Does not launch mainnet.
 */

import { qualifyPregenesisNetwork } from './qualify.ts';
import { summarizePregenesisReport, verifyPregenesisReport } from './report.ts';

const session = qualifyPregenesisNetwork({ profile: 'bounded' });
const summary = summarizePregenesisReport(session.report);
const verified = verifyPregenesisReport(session.report);
process.stdout.write(
  `${JSON.stringify(
    {
      ...summary,
      verified: verified.ok,
      liveFlagsRemainDisabled: session.report.liveFlagsRemainDisabled,
    },
    null,
    2,
  )}\n`,
);
if (!verified.ok || session.report.mainnetEnabled !== false) {
  process.exitCode = 1;
}
