/**
 * sunrey-economics supply/policy auditors.
 */

import { monetaryPolicyRegistry, nativeAssetConstitution, policyFor, requireKnownAsset } from './constitution.ts';
import { verifyGenesisAllocationManifest } from './genesis.ts';
import { emptyAllocationManifest } from '../mainnet/allocation.ts';
import { snapshotOf, supplyReconciles, type AssetSupplyBook } from './supply.ts';
import {
  MONETARY_CONSTITUTION_SCHEMA_VERSION,
  PRODUCTION_PARAMETER_UNCONFIGURED,
  TICKER_STATUS_NOT_ASSIGNED,
  type MonetaryPolicyAuditReport,
  type NativeMonetaryAssetId,
  type NativeSupplyAuditReport,
} from './types.ts';

export function auditSupply(
  books: readonly AssetSupplyBook[],
  policyVersion = 'sunrey.monetary.constitution.v1',
): NativeSupplyAuditReport {
  const assets = books.map((book) => {
    const snap = snapshotOf(book);
    const ok = supplyReconciles(book) && snap.expectedTotal === snap.observedTotal;
    return Object.freeze({
      ...snap,
      reconciliation: ok ? ('EXACT' as const) : ('MISMATCH' as const),
      notes: ok ? 'no hidden supply; no reconciliation plugs' : 'supply identity failed',
    });
  });
  return Object.freeze({
    schemaVersion: MONETARY_CONSTITUTION_SCHEMA_VERSION,
    classification: 'ENGINEERING_SIMULATION',
    policyVersion,
    assets: Object.freeze(assets),
    ok: assets.every((row) => row.reconciliation === 'EXACT'),
  });
}

export function showSupply(books: readonly AssetSupplyBook[]) {
  return auditSupply(books).assets.map((row) =>
    Object.freeze({
      assetId: row.assetId,
      genesisQuantity: row.genesisAllocated.toString(),
      postGenesisIssuance: row.issuedPostGenesis.toString(),
      burnQuantity: row.burned.toString(),
      circulating: row.circulating.toString(),
      locked: row.locked.toString(),
      escrowed: row.escrowed.toString(),
      reserved: row.feeReserved.toString(),
      expectedTotal: row.expectedTotal.toString(),
      observedTotal: row.observedTotal.toString(),
      reconciliation: row.reconciliation,
      policyVersion: row.policyVersion,
    }),
  );
}

export function verifyPolicy(options?: {
  readonly assetId?: string;
  readonly versionId?: string;
  readonly state?: 'DEVELOPMENT_ACTIVE' | 'TESTNET_ACTIVE' | 'PRODUCTION_CANDIDATE';
}): MonetaryPolicyAuditReport {
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const push = (id: string, ok: boolean, detail: string) => {
    checks.push({ id, ok, detail });
  };
  const registry = monetaryPolicyRegistry(options?.state ?? 'DEVELOPMENT_ACTIVE');
  const constitution = registry.constitution;
  push('constitution-id', constitution.constitutionId === 'sunrey.native-asset-constitution.v1', constitution.constitutionId);
  push('ticker', constitution.tickerStatus === TICKER_STATUS_NOT_ASSIGNED, constitution.tickerStatus);
  push('mainnet-unavailable', constitution.productionMainnetUnavailable, 'production mainnet unavailable');
  push('economic-activation-unavailable', constitution.productionEconomicActivationUnavailable, 'production economic activation unavailable');
  push('two-assets', constitution.assets.length === 2, String(constitution.assets.length));
  push('asset-separation', constitution.assets[0]?.assetId !== constitution.assets[1]?.assetId, 'SUNREY_COIN != MOONREY_COIN');

  if (options?.assetId) {
    try {
      const asset = policyFor(constitution, requireKnownAsset(options.assetId));
      push('asset', true, asset.assetId);
      push('version', asset.policyVersion.versionId === (options.versionId ?? registry.activeVersionId), asset.policyVersion.versionId);
      push('governance-reference', asset.policyVersion.governanceReference.length > 0, asset.policyVersion.governanceReference);
      push(
        'activation-height',
        asset.policyActivationHeight === 0n || asset.policyActivationHeight === PRODUCTION_PARAMETER_UNCONFIGURED,
        String(asset.policyActivationHeight),
      );
      push(
        'supply-configuration',
        asset.supplyConstraints.maximumSupply === PRODUCTION_PARAMETER_UNCONFIGURED,
        'maximum supply UNCONFIGURED',
      );
      push('issuance-authority', asset.issuancePolicy.unrestrictedMintForbidden, 'no unrestricted mint');
      push('ai-cannot-authorize', asset.issuancePolicy.aiAuthorizationForbidden, 'AI cannot authorize');
      push('burn-policy', asset.burnPolicy.validatorMisconductCannotBurnCustomerAssets, asset.burnPolicy.policyVersion);
      if (asset.assetId === 'SUNREY_COIN') {
        push('sunrey-purpose', asset.assetPurpose === 'HUMAN_ECONOMIC_LAYER', asset.assetPurpose);
        push('sunrey-fee', asset.feeEligibility === 'ELIGIBLE', asset.feeEligibility);
      } else {
        push('moonrey-purpose', asset.assetPurpose === 'AUTONOMOUS_PRODUCTIVE_ECONOMY', asset.assetPurpose);
        push('moonrey-issuance', asset.permittedIssuanceClasses.includes('VERIFIED_PRODUCTIVE_CONTRIBUTION'), 'productive only');
      }
    } catch (error) {
      push('asset', false, error instanceof Error ? error.message : 'invented asset');
    }
  } else {
    for (const asset of constitution.assets) {
      push(`${asset.assetId}-version`, asset.policyVersion.versionId === registry.activeVersionId, asset.policyVersion.versionId);
      push(`${asset.assetId}-governance`, asset.governanceAuthority === 'SUNREY_PROTOCOL_GOVERNANCE', asset.governanceAuthority);
    }
  }

  const genesis = verifyGenesisAllocationManifest(emptyAllocationManifest());
  push('zero-production-genesis', genesis.ok, 'zero allocation candidate');
  return Object.freeze({
    schemaVersion: MONETARY_CONSTITUTION_SCHEMA_VERSION,
    ok: checks.every((row) => row.ok),
    checks: Object.freeze(checks),
  });
}

export function showPolicy(assetId?: NativeMonetaryAssetId) {
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  const assets = assetId ? [policyFor(constitution, assetId)] : constitution.assets;
  return Object.freeze({
    constitutionId: constitution.constitutionId,
    tickerStatus: constitution.tickerStatus,
    productionMainnetUnavailable: true,
    assets: assets.map((asset) =>
      Object.freeze({
        assetId: asset.assetId,
        assetPurpose: asset.assetPurpose,
        precision: asset.precision,
        policyVersion: asset.policyVersion.versionId,
        policyState: asset.policyState,
        feeEligibility: asset.feeEligibility,
        governanceAuthority: asset.governanceAuthority,
        maximumSupply: asset.supplyConstraints.maximumSupply,
        genesisSupply: asset.supplyConstraints.genesisSupply === PRODUCTION_PARAMETER_UNCONFIGURED
          ? PRODUCTION_PARAMETER_UNCONFIGURED
          : asset.supplyConstraints.genesisSupply.toString(),
        permittedIssuanceClasses: asset.permittedIssuanceClasses,
        permittedBurnClasses: asset.permittedBurnClasses,
        activationHeight: String(asset.policyActivationHeight),
        historicalPolicyReference: asset.historicalPolicyReference,
      }),
    ),
  });
}
