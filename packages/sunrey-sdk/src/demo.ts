import { runQuickstart } from './quickstart.ts';

const result = await runQuickstart();
if (result.status !== 'FINALIZED') {
  throw new Error(`quickstart expected FINALIZED, got ${result.status}`);
}
if (result.bobAvailable !== '25000') {
  throw new Error(`expected bob 25000, got ${result.bobAvailable}`);
}
console.log('SunRey developer platform demo: ok');
