import { HIN_CHAIN_ANCHOR_INVARIANTS, HIN_CHAIN_ANCHOR_OWNER } from './policy.ts';
import { provisionHinChainAnchorFixture, realizeHinUse, unwrapAnchor } from './fixtures.ts';

export type HinChainAnchorFoundationDemoResult = {
  readonly consentAnchored: true;
  readonly usageAnchored: true;
  readonly revocationAnchored: true;
  readonly contributionAnchored: true;
  readonly intentCreated: true;
  readonly chainRecordType: 'CONSENT_RECEIPT';
  readonly CHAIN_OWNER: typeof HIN_CHAIN_ANCHOR_OWNER.CHAIN_OWNER;
  readonly HIN_RIGHTS_OWNER: typeof HIN_CHAIN_ANCHOR_OWNER.HIN_RIGHTS_OWNER;
  readonly RAW_PERSONAL_DATA_ON_CHAIN: false;
  readonly ANCHOR_TRANSFERS_OWNERSHIP: false;
  readonly ANCHOR_MINTS_SUNREY: false;
  readonly ANCHOR_MINTS_MOONREY: false;
  readonly PRODUCTION_ACTIVE: false;
};

export function runHinChainAnchorFoundationDemo(): HinChainAnchorFoundationDemoResult {
  const net = provisionHinChainAnchorFixture();
  const realized = realizeHinUse(net);
  const consent = unwrapAnchor(
    net.adapter.createAnchorIntent({
      kind: 'CONSENT_GRANT',
      sourceRecordId: net.approved.grant.grantId,
    }),
  );
  const intent = net.adapter.getIntent(consent.anchorId);
  if (!intent || intent.recordType !== 'CONSENT_RECEIPT') {
    throw new Error('consent must produce an existing SunRey Chain CONSENT_RECEIPT write intent');
  }
  if (intent.economicValueMovement !== false) {
    throw new Error('HIN anchors must not move economic value');
  }
  unwrapAnchor(
    net.adapter.createAnchorIntent({
      kind: 'USAGE_RECEIPT',
      sourceRecordId: realized.receipt.receiptId,
    }),
  );
  const recorded = unwrapAnchor(net.contribution.submitRealizedUse({ receiptId: realized.receipt.receiptId }));
  unwrapAnchor(
    net.adapter.createAnchorIntent({
      kind: 'HUMAN_CONTRIBUTION_PROOF',
      sourceRecordId: recorded.contributionId,
      contributionId: recorded.contributionId,
    }),
  );
  const revocation = unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
  unwrapAnchor(
    net.adapter.createAnchorIntent({
      kind: 'CONSENT_REVOCATION',
      sourceRecordId: revocation.revocationId,
    }),
  );
  if (consent.mintsAsset !== false || consent.transfersOwnership !== false) {
    throw new Error('HIN chain anchors cannot mint or transfer ownership');
  }
  if (net.engine.policy.productionActivated !== false) {
    throw new Error('HIN chain anchoring must remain simulation-only');
  }
  return Object.freeze({
    consentAnchored: true,
    usageAnchored: true,
    revocationAnchored: true,
    contributionAnchored: true,
    intentCreated: true,
    chainRecordType: 'CONSENT_RECEIPT',
    CHAIN_OWNER: HIN_CHAIN_ANCHOR_OWNER.CHAIN_OWNER,
    HIN_RIGHTS_OWNER: HIN_CHAIN_ANCHOR_OWNER.HIN_RIGHTS_OWNER,
    RAW_PERSONAL_DATA_ON_CHAIN: HIN_CHAIN_ANCHOR_INVARIANTS.RAW_PERSONAL_DATA_ON_CHAIN,
    ANCHOR_TRANSFERS_OWNERSHIP: HIN_CHAIN_ANCHOR_INVARIANTS.CHAIN_ANCHOR_TRANSFERS_OWNERSHIP,
    ANCHOR_MINTS_SUNREY: HIN_CHAIN_ANCHOR_INVARIANTS.ANCHOR_MINTS_SUNREY,
    ANCHOR_MINTS_MOONREY: HIN_CHAIN_ANCHOR_INVARIANTS.ANCHOR_MINTS_MOONREY,
    PRODUCTION_ACTIVE: HIN_CHAIN_ANCHOR_INVARIANTS.PRODUCTION_ACTIVE,
  });
}

const isMain = process.argv[1]?.includes('chain-anchor/demo.ts') === true;
if (isMain) {
  const result = runHinChainAnchorFoundationDemo();
  process.stdout.write(
    [
      'SunRey Human Information Network → SunRey Chain anchoring foundation demo',
      'HIN consent → privacy-safe anchor request → SunReyChainService.createIntent → ChainWriteIntent',
      `consentAnchored=${result.consentAnchored}`,
      `usageAnchored=${result.usageAnchored}`,
      `revocationAnchored=${result.revocationAnchored}`,
      `contributionAnchored=${result.contributionAnchored}`,
      `intentCreated=${result.intentCreated}`,
      `chainRecordType=${result.chainRecordType}`,
      `CHAIN_OWNER=${result.CHAIN_OWNER}`,
      `HIN_RIGHTS_OWNER=${result.HIN_RIGHTS_OWNER}`,
      `RAW_PERSONAL_DATA_ON_CHAIN=${result.RAW_PERSONAL_DATA_ON_CHAIN}`,
      `ANCHOR_TRANSFERS_OWNERSHIP=${result.ANCHOR_TRANSFERS_OWNERSHIP}`,
      `ANCHOR_MINTS_SUNREY=${result.ANCHOR_MINTS_SUNREY}`,
      `ANCHOR_MINTS_MOONREY=${result.ANCHOR_MINTS_MOONREY}`,
      `PRODUCTION_ACTIVE=${result.PRODUCTION_ACTIVE}`,
      '',
    ].join('\n'),
  );
}
