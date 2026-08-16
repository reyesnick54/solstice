import { runComputeDemo, runEnergyDemo } from './demo-helpers.ts';

export { runComputeDemo, runEnergyDemo };

export async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SunRey machine economic identity and commerce demo');
  console.log('ENVIRONMENT=simulation  machines cannot govern or validate');
  console.log('============================================================');
  const compute = runComputeDemo();
  console.log('compute demo', compute);
  const energy = runEnergyDemo();
  console.log('energy demo', energy);
  console.log('demo ok — development machine commerce only');
}

await main();
