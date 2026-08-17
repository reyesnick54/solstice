import { runProductionOracleE2E } from './e2e.ts';

const report = runProductionOracleE2E();
console.log('SunRey production-candidate oracle demo');
console.log('ENVIRONMENT=simulation  consensus does not call external APIs');
console.log(JSON.stringify(report, null, 2));
console.log('demo ok — facts are not money; MoonRey issuance stays on the productive path');
