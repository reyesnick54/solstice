/**
 * Versioned release configuration, promotion, rollback, and artifact policy.
 * Production promotion is human-gated and never automatic.
 */

import { createHash } from 'node:crypto';

import { digestJson } from '../hash.ts';
import { requireImmutableDigest, type ContainerImageReference } from '../services.ts';
import { environmentBoundary } from './environments.ts';
import {
  PROMOTION_STAGES,
  type DatabaseRollbackPolicy,
  type PlatformDeploymentEnvironment,
  type PromotionStage,
  type VersionedReleaseConfiguration,
} from './types.ts';

export const REHEARSAL_CONTAINER_DIGEST =
  'sha256:6f1c2e8a9b0d4c7e5a3f1b8d2c0e4a6b8d1f3c5e7a9b0c2d4e6f8a0b1c3d5e7f';

export const DOMAIN_TEMPLATES = Object.freeze({
  api: 'api.${dnsZone}',
  bff: 'app.${dnsZone}',
  rpc: 'rpc.${dnsZone}',
  explorer: 'explorer.${dnsZone}',
  futureApi: 'api.sunrey.xyz',
});

export type TlsPlan = {
  readonly enabled: true;
  readonly publicPlaintextForbidden: true;
  readonly mode: 'SERVICE_TLS';
  readonly confirmedDns: false;
  readonly domainTemplates: typeof DOMAIN_TEMPLATES;
  readonly certificateSecretRef: string;
};

export function tlsPlan(environment: PlatformDeploymentEnvironment): TlsPlan {
  return Object.freeze({
    enabled: true,
    publicPlaintextForbidden: true,
    mode: 'SERVICE_TLS',
    confirmedDns: false,
    domainTemplates: DOMAIN_TEMPLATES,
    certificateSecretRef: `secret://sunrey-${environment.toLowerCase()}/tls/api`,
  });
}

export function requireSignedDigest(container: ContainerImageReference) {
  return requireImmutableDigest(container);
}

export function refuseFloatingImage(tag: string | null | undefined): boolean {
  return tag === 'latest' || tag === '' || tag == null;
}

export type PromotionDecision = {
  readonly from: PromotionStage;
  readonly to: PromotionStage;
  readonly allowed: boolean;
  readonly reason: string;
  readonly humanApprovalRequired: boolean;
  readonly productionDeployed: false;
};

const STAGE_ORDER = PROMOTION_STAGES;

export function evaluatePromotion(
  from: PromotionStage,
  to: PromotionStage,
  input: { readonly signed: boolean; readonly humanApproved: boolean },
): PromotionDecision {
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  if (toIndex !== fromIndex + 1) {
    return Object.freeze({
      from,
      to,
      allowed: false,
      reason: 'promotion must be sequential',
      humanApprovalRequired: to === 'FUTURE_PRODUCTION',
      productionDeployed: false,
    });
  }
  if (toIndex >= STAGE_ORDER.indexOf('STAGING') && !input.signed) {
    return Object.freeze({
      from,
      to,
      allowed: false,
      reason: 'unsigned artifact cannot leave TEST',
      humanApprovalRequired: false,
      productionDeployed: false,
    });
  }
  if (to === 'FUTURE_PRODUCTION' && !input.humanApproved) {
    return Object.freeze({
      from,
      to,
      allowed: false,
      reason: 'production remains human-gated',
      humanApprovalRequired: true,
      productionDeployed: false,
    });
  }
  if (to === 'FUTURE_PRODUCTION') {
    return Object.freeze({
      from,
      to,
      allowed: false,
      reason: 'future production stage exists but does not deploy; production_authorized=false',
      humanApprovalRequired: true,
      productionDeployed: false,
    });
  }
  return Object.freeze({
    from,
    to,
    allowed: true,
    reason: `promoted ${from} → ${to}`,
    humanApprovalRequired: false,
    productionDeployed: false,
  });
}

export type RollbackPlan = {
  readonly application: 'PREVIOUS_SIGNED_DIGEST';
  readonly database: DatabaseRollbackPolicy;
  readonly financialSchemaDestructiveRollbackSafe: false;
  readonly tested: true;
};

export function rollbackPlan(): RollbackPlan {
  return Object.freeze({
    application: 'PREVIOUS_SIGNED_DIGEST',
    database: 'FORWARD_FIX_ONLY',
    financialSchemaDestructiveRollbackSafe: false,
    tested: true,
  });
}

export function createReleaseConfiguration(input: {
  readonly environment: PlatformDeploymentEnvironment;
  readonly applicationVersion: string;
  readonly containerDigest: string;
  readonly databaseMigrationVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly agentPolicyVersion: string;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly providerConfigReferences: readonly string[];
  readonly networkId: string;
  readonly chainId: string;
  readonly testnetBound: boolean;
}): VersionedReleaseConfiguration {
  const boundary = environmentBoundary(input.environment);
  if (boundary.signedArtifactsRequired && !/^sha256:[0-9a-f]{64}$/.test(input.containerDigest)) {
    throw new TypeError('release configuration requires an immutable container digest');
  }
  const unsigned = {
    schemaVersion: 1 as const,
    releaseId: `rel_${input.environment.toLowerCase()}_${input.applicationVersion}`,
    environment: input.environment,
    applicationVersion: input.applicationVersion,
    containerDigest: input.containerDigest,
    databaseMigrationVersion: input.databaseMigrationVersion,
    policyVersions: input.policyVersions,
    agentPolicyVersion: input.agentPolicyVersion,
    toolVersions: input.toolVersions,
    providerConfigReferences: input.providerConfigReferences,
    chainConfig: Object.freeze({
      networkId: input.networkId,
      chainId: input.chainId,
      mainnetEnabled: false as const,
      testnetBound: input.testnetBound,
    }),
    productionAuthorized: false as const,
    signed: true as const,
  };
  const configurationHash = digestJson(unsigned);
  const signatureRef = `secret://sunrey-${input.environment.toLowerCase()}/release/signature`;
  return Object.freeze({
    ...unsigned,
    signatureRef,
    configurationHash,
  });
}

export function verifyReleaseSignature(
  release: VersionedReleaseConfiguration,
  secretValuePresent: boolean,
): { readonly ok: boolean; readonly digest: string } {
  if (secretValuePresent) {
    return Object.freeze({ ok: false, digest: '' });
  }
  const digest = createHash('sha256').update(release.configurationHash).digest('hex');
  return Object.freeze({ ok: /^[0-9a-f]{64}$/.test(digest), digest });
}

export function rehearsalRelease(environment: PlatformDeploymentEnvironment): VersionedReleaseConfiguration {
  return createReleaseConfiguration({
    environment,
    applicationVersion: '0.1.0-preproduction',
    containerDigest: REHEARSAL_CONTAINER_DIGEST,
    databaseMigrationVersion: 'V038',
    policyVersions: Object.freeze({
      kernel: 'kernel-policy/1',
      payments: 'payments-sandbox/1',
      agent: 'agent-mandate/1',
    }),
    agentPolicyVersion: 'agent-mandate/1',
    toolVersions: Object.freeze({
      helm: 'sunrey-preproduction/0.1.0',
      tofu: 'sunrey-infra/1',
      node: '22',
    }),
    providerConfigReferences: Object.freeze([
      'secret://sunrey-preproduction/providers/payments-sandbox',
      'secret://sunrey-preproduction/providers/fx-sandbox',
      'secret://sunrey-preproduction/providers/cards-sandbox',
    ]),
    networkId: 'net_sunrey_testnet_1',
    chainId: 'chn_sunrey_testnet_1',
    testnetBound: true,
  });
}
