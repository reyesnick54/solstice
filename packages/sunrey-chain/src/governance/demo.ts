import { runIncompatibleNodeDemo, runModuleUpgradeDemo, runParameterUpgradeDemo } from './demo-helpers.ts';

export { runIncompatibleNodeDemo, runModuleUpgradeDemo, runParameterUpgradeDemo };

export async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SunRey protocol governance / upgrade manager demo');
  console.log('ENVIRONMENT=simulation  no governance token  no coin voting');
  console.log('============================================================');
  const parameter = runParameterUpgradeDemo();
  console.log('parameter upgrade', parameter);
  const moduleUpgrade = runModuleUpgradeDemo();
  console.log('module upgrade', moduleUpgrade);
  const incompatible = runIncompatibleNodeDemo();
  console.log('incompatible node', incompatible);
  console.log('demo ok — development governance only');
}

await main();
