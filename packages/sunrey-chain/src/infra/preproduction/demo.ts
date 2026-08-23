import { runPreproductionRehearsal } from './rehearsal.ts';

const rehearsal = runPreproductionRehearsal('PREPRODUCTION');
console.log(`sunrey-preproduction environment=${rehearsal.environment}`);
console.log(`manifests=${rehearsal.manifests}`);
console.log(`helmOk=${String(rehearsal.helmOk)}`);
console.log(`iacOk=${String(rehearsal.iacOk)}`);
console.log(`smokeOk=${String(rehearsal.smokeOk)}`);
console.log(`productionAuthorized=${String(rehearsal.productionAuthorized)}`);
console.log(`mainnetEnabled=${String(rehearsal.mainnetEnabled)}`);
console.log(`cloudApplied=${String(rehearsal.cloudApplied)}`);
console.log(`promotionGated=${String(rehearsal.promotionGated)}`);
console.log(`releaseHash=${rehearsal.releaseHash}`);
console.log(`ok=${String(rehearsal.ok)}`);
if (!rehearsal.ok) {
  for (const failure of rehearsal.failures) {
    console.error(`failure=${failure}`);
  }
  process.exit(1);
}
