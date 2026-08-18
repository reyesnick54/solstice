import { DeveloperPortalApi } from './index.ts';

const portal = new DeveloperPortalApi();
const account = portal.registerDeveloper({ email: 'demo@example.test', displayName: 'Demo Developer' });
const org = portal.createOrganization({ name: 'Demo Org', ownerAccountId: account.accountId });
if (!org.ok) {
  throw new Error(org.reason);
}
const app = portal.createApplication({
  actorAccountId: account.accountId,
  organizationId: org.value.organizationId,
  name: 'demo-app',
  environment: 'SANDBOX',
  permissions: ['CHAIN_READ', 'WEBHOOK_MANAGE', 'FAUCET_REQUEST', 'TRANSACTION_SUBMIT'],
});
if (!app.ok) {
  throw new Error(app.reason);
}
console.log('SunRey developer platform demo: ok');
console.log(`app=${app.value.appId}`);
console.log(`production_financial_capabilities=${app.value.productionFinancialCapabilitiesActivated}`);
console.log(`status=${JSON.stringify(portal.status())}`);
