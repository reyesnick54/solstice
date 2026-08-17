import { runLaunchRehearsal } from './engine.ts';

const session = runLaunchRehearsal();
process.stdout.write(
  `${JSON.stringify(
    {
      rehearsalId: session.report.rehearsalId,
      displayName: session.report.displayName,
      networkId: session.report.rehearsalGenesis.networkId,
      chainId: session.report.rehearsalGenesis.chainId,
      genesisHash: session.report.rehearsalGenesis.genesisHash,
      classification: session.report.classification,
      productionAuthorized: session.report.productionAuthorized,
      banner: session.report.explorer.banner,
    },
    null,
    2,
  )}\n`,
);
