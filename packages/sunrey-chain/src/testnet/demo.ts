import { runTestnetCommand } from './cli.ts';
import { launchLocalClusterSimulation } from './cluster.ts';
import { runFullTestnetE2e } from './network.ts';

export function runTestnetDemo(): {
  readonly e2e: ReturnType<typeof runFullTestnetE2e>;
  readonly cluster: ReturnType<typeof launchLocalClusterSimulation>;
  readonly verify: ReturnType<typeof runTestnetCommand>;
} {
  const e2e = runFullTestnetE2e();
  const cluster = launchLocalClusterSimulation();
  const verify = runTestnetCommand(['verify']);
  if (!e2e.ok || !cluster.e2eOk || !verify.ok) {
    throw new Error('SunRey testnet demo failed');
  }
  console.log(
    JSON.stringify(
      {
        network: 'SunRey Testnet 1',
        banner: e2e.banner,
        genesisHash: e2e.genesisHash,
        validators: 7,
        e2e: e2e.ok,
        cluster: cluster.mode,
        verify: verify.ok,
      },
      null,
      2,
    ),
  );
  return { e2e, cluster, verify };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTestnetDemo();
}
