import { economicRehearsalDoesNotActivateProduction, runEconomicRehearsal } from './engine.ts';

const session = runEconomicRehearsal();
economicRehearsalDoesNotActivateProduction(session);
const report = session.report;
process.stdout.write(
  `${JSON.stringify(
    {
      rehearsalIdentity: report.displayName,
      rehearsalId: report.rehearsalId,
      genesisHash: report.rehearsalGenesis.genesisHash,
      economicRc: report.economicRc.rcId,
      sunreySupply: report.sunreySupply.observedTotal.toString(),
      moonreySupply: report.moonreySupply.observedTotal.toString(),
      validatorBonds: report.validatorEconomics.bondedValidators,
      validatorRewards: report.validatorEconomics.rewardEpochs,
      fees: {
        charged: report.fees.charged.toString(),
        validatorReward: report.fees.validatorReward.toString(),
        burned: report.fees.burned.toString(),
        treasury: report.fees.treasury.toString(),
      },
      treasury: report.treasury.remaining.toString(),
      exchange: report.exchange.marketId,
      moonreyIssuance: report.moonreyIssuance.issued.toString(),
      stressStatus: report.stress.accountingSafe ? 'SAFE' : 'UNSAFE',
      classification: report.classification,
      productionAuthorized: false,
    },
    null,
    2,
  )}\n`,
);
