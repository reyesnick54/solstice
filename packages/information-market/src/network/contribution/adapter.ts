import type { Result } from '../../../../domain/src/result.ts';
import { err, ok } from '../../../../domain/src/result.ts';
import { refuseUncontrolledScraping } from '../connectors.ts';
import type { HumanInformationNetworkEngine } from '../engine.ts';
import type { HumanInformationConsentGrantId, HumanInformationAssetDescriptorId } from '../ids.ts';
import type {
  DataAssetContributionProjectionPort,
  HinContributionFailure,
  HumanContributionRecord,
  HumanContributionRegistryPort,
} from './contract.ts';
import { toInformationRightContributionEvidence } from './evidence.ts';
import { HinContributionProjection } from './projection.ts';

export type HinContributionAdapterOptions = {
  readonly engine: HumanInformationNetworkEngine;
  readonly registry: HumanContributionRegistryPort;
  readonly dataAssetProjection?: DataAssetContributionProjectionPort;
};

/**
 * Narrow HIN → Human Contribution Registry adapter.
 *
 * Dependency direction: HIN uses {@link HumanContributionRegistryPort}.
 * The contribution core must not import the HIN engine.
 */
export class HinContributionAdapter {
  readonly engine: HumanInformationNetworkEngine;
  readonly registry: HumanContributionRegistryPort;
  readonly projection = new HinContributionProjection();
  private readonly dataAssetProjection: DataAssetContributionProjectionPort | null;

  constructor(options: HinContributionAdapterOptions) {
    this.engine = options.engine;
    this.registry = options.registry;
    this.dataAssetProjection = options.dataAssetProjection ?? null;
  }

  submitRealizedUse(input: {
    readonly receiptId: string;
  }): Result<HumanContributionRecord, HinContributionFailure> {
    if (this.engine.policy.productionActivated !== false) {
      return err({
        code: 'PRODUCTION_ACTIVATION_FORBIDDEN',
        message: 'HIN contribution integration must not activate production data monetization',
      });
    }
    const evidence = toInformationRightContributionEvidence(this.engine, input.receiptId);
    if (!evidence.ok) {
      return evidence;
    }
    const recorded = this.registry.recordVerifiedContribution(evidence.value, evidence.value.occurredAt);
    if (!recorded.ok) {
      return recorded;
    }
    this.projection.remember(recorded.value);
    if (this.dataAssetProjection) {
      this.dataAssetProjection.attachContributionReference({
        descriptorId: recorded.value.evidence.descriptorId,
        contributionId: recorded.value.contributionId,
        subjectPseudonymousRef: recorded.value.evidence.subjectPseudonymousRef,
        canonicalRefOnly: true,
        rawContentIncluded: false,
      });
    }
    return ok(recorded.value);
  }

  attemptOwnershipContribution(input: {
    readonly descriptorId: HumanInformationAssetDescriptorId;
  }): Result<never, HinContributionFailure> {
    const descriptor = this.engine.store.descriptors.get(input.descriptorId);
    if (!descriptor) {
      return err({ code: 'RIGHT_MISSING', message: 'descriptor is unknown' });
    }
    return err({
      code: 'OWNERSHIP_IS_NOT_CONTRIBUTION',
      message: 'merely owning a data descriptor does not create a verified economic contribution',
    });
  }

  attemptConsentContribution(input: {
    readonly grantId: HumanInformationConsentGrantId;
  }): Result<never, HinContributionFailure> {
    const grant = this.engine.store.grants.get(input.grantId);
    if (!grant) {
      return err({ code: 'CONSENT_MISSING', message: 'consent grant is unknown' });
    }
    return err({
      code: 'CONSENT_IS_NOT_CONTRIBUTION',
      message: 'merely granting consent does not create a SunRey issuance event or verified contribution',
    });
  }

  refuseScrapedContribution(): Result<never, HinContributionFailure> {
    const refused = refuseUncontrolledScraping();
    return err({
      code: 'SCRAPING_FORBIDDEN',
      message: refused.message,
    });
  }

  inspectCompensation(settlementRef: string | null): Result<
    { readonly mintRequested: false; readonly unrestrictedIssuance: false; readonly automaticSunReyMint: false },
    HinContributionFailure
  > {
    if (!settlementRef) {
      return ok({ mintRequested: false, unrestrictedIssuance: false, automaticSunReyMint: false });
    }
    const instruction = [...this.engine.store.compensation.values()].find((row) => row.settlementRef === settlementRef);
    if (!instruction) {
      return ok({ mintRequested: false, unrestrictedIssuance: false, automaticSunReyMint: false });
    }
    if (instruction.mintRequested !== false || instruction.unrestrictedIssuance !== false) {
      return err({
        code: 'HIN_COMPENSATION_CANNOT_MINT',
        message: 'HIN compensation is a settlement instruction, not SunRey issuance',
      });
    }
    return ok({ mintRequested: false, unrestrictedIssuance: false, automaticSunReyMint: false });
  }
}

export function createHinContributionAdapter(options: HinContributionAdapterOptions): HinContributionAdapter {
  return new HinContributionAdapter(options);
}
