import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureAsset } from './fixtures.ts';
import { assetIdFor } from './ids.ts';
import { EconomicAssetRegistry } from './registry.ts';
import {
  ENGINEERING_VERIFICATION_POLICY,
} from './verification/index.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function runEconomicAssetVerificationDemo(): {
  readonly RAW_DATA_STORED: false;
  readonly LEGAL_OWNERSHIP_INFERRED: false;
  readonly VALUATION_AUTHORIZED: false;
  readonly SUNREY_MINT_AUTHORIZED: false;
  readonly MOONREY_MINT_AUTHORIZED: false;
  readonly PRODUCTION_ACTIVE: false;
} {
  const registry = new EconomicAssetRegistry();
  const registered = unwrap(registry.register(fixtureAsset('hin-information', 'demo-verify-hin')));
  const evaluatedAt = asUtcInstant('2026-08-19T12:20:00.000Z');
  const decision = unwrap(registry.evaluateVerification(registered.assetId, evaluatedAt));
  const verified = unwrap(registry.applyVerificationDecision(decision));

  console.log('SunRey Economic Asset Verification — Chunk 114');
  console.log('Path: registered asset → rights → provenance → lineage → verification decision → VERIFIED descriptor');
  console.log('');
  console.log(`assetId=${registered.assetId}`);
  console.log(`assetClass=${registered.assetClass} status=${registered.status}`);
  console.log(`rightsPolicy=${registered.rightsPolicyRef} consent=${registered.consentRefs.join(',')} purpose=${registered.purposeRefs.join(',')}`);
  console.log(`provenance=${registered.provenanceDigest} source=${registered.sourceClass} commitment=${registered.contentCommitment}`);
  console.log(`lineageRoot=${registered.lineageRoot} edges=${registered.lineage.length}`);
  console.log(`policyId=${ENGINEERING_VERIFICATION_POLICY.policyId} policyVersion=${ENGINEERING_VERIFICATION_POLICY.policyVersion}`);
  console.log(`policyState=${ENGINEERING_VERIFICATION_POLICY.state} productionActivated=${String(ENGINEERING_VERIFICATION_POLICY.productionActivated)}`);
  console.log(`decision=${decision.decision} decisionId=${decision.decisionId}`);
  console.log(`decisionDigest=${decision.decisionDigest}`);
  console.log(`decisionCodes=${decision.decisionCodes.join(',') || 'none'}`);
  console.log(`registryStatus=${verified.status} verificationDecisionId=${verified.verificationDecisionId}`);
  console.log(`authorizesValuation=${String(decision.authorizesValuation)} authorizesSunRey=${String(decision.authorizesSunReyIssuance)} authorizesMoonRey=${String(decision.authorizesMoonReyIssuance)}`);
  console.log(`controllerIsLegalOwner=${String(verified.roles.controllerIsLegalOwner)} subjectIsLegalOwner=${String(verified.roles.subjectIsLegalOwner)}`);
  console.log('');

  const rejected = unwrap(
    registry.register({
      ...fixtureAsset('hin-information', 'demo-verify-reject'),
      storageClass: 'OFF_CHAIN_PUBLIC_REFERENCE',
    }),
  );
  const rejectedDecision = unwrap(registry.evaluateVerification(rejected.assetId, asUtcInstant('2026-08-19T12:21:00.000Z')));
  console.log('Incompatible storage/sensitivity → REJECTED');
  console.log(`assetId=${rejected.assetId} sensitivity=${rejected.sensitivityClass} storage=${rejected.storageClass}`);
  console.log(`decision=${rejectedDecision.decision} codes=${rejectedDecision.decisionCodes.join(',')}`);
  console.log('');

  const source = unwrap(registry.register(fixtureAsset('oracle-source', 'demo-verify-src')));
  const fact = unwrap(
    registry.register({
      ...fixtureAsset('verified-fact', 'demo-verify-fact'),
      assetId: assetIdFor('demo-verify-fact'),
      lineage: [{ kind: 'DERIVED_FROM', fromAssetId: assetIdFor('demo-verify-fact'), toAssetId: source.assetId }],
    }),
  );
  const factDecision = unwrap(registry.evaluateVerification(fact.assetId, asUtcInstant('2026-08-19T12:22:00.000Z')));
  console.log(`verified fact lineage=${fact.lineage.map((edge) => `${edge.kind}:${edge.toAssetId}`).join(',')} decision=${factDecision.decision}`);
  console.log('');
  console.log(`RAW_DATA_STORED=${String(false)}`);
  console.log(`LEGAL_OWNERSHIP_INFERRED=${String(false)}`);
  console.log(`VALUATION_AUTHORIZED=${String(decision.authorizesValuation)}`);
  console.log(`SUNREY_MINT_AUTHORIZED=${String(decision.authorizesSunReyIssuance)}`);
  console.log(`MOONREY_MINT_AUTHORIZED=${String(decision.authorizesMoonReyIssuance)}`);
  console.log(`PRODUCTION_ACTIVE=${String(ENGINEERING_VERIFICATION_POLICY.productionActivated)}`);

  return {
    RAW_DATA_STORED: false,
    LEGAL_OWNERSHIP_INFERRED: false,
    VALUATION_AUTHORIZED: false,
    SUNREY_MINT_AUTHORIZED: false,
    MOONREY_MINT_AUTHORIZED: false,
    PRODUCTION_ACTIVE: false,
  };
}

runEconomicAssetVerificationDemo();
