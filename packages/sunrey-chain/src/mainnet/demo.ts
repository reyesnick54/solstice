import { runMainnetCandidateRehearsal } from './rehearsal.ts';

const rehearsal = runMainnetCandidateRehearsal();
process.stdout.write(
  `${JSON.stringify(
    {
      status: rehearsal.status,
      genesisHash: rehearsal.genesisHash,
      validatorCount: rehearsal.validatorCount,
      deterministic: rehearsal.deterministic,
      evidenceIncomplete: rehearsal.evidenceIncomplete,
      productionServicesActivated: rehearsal.productionServicesActivated,
      distinctions: rehearsal.report.distinctions,
    },
    null,
    2,
  )}\n`,
);
if (rehearsal.productionServicesActivated || !rehearsal.deterministic) {
  process.exit(1);
}
