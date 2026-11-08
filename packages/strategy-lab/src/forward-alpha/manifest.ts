import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { asForwardAlphaManifestId } from './ids.ts';
import {
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA,
  type ForwardAlphaEvidenceLane,
  type ForwardAlphaStatus,
} from './taxonomy.ts';
import type { ForwardAlphaCampaign, ForwardAlphaEvidence, ForwardAlphaManifest } from './types.ts';

function canonicalManifestPayload(input: {
  readonly campaign: ForwardAlphaCampaign;
  readonly evidenceByLane: Readonly<Partial<Record<ForwardAlphaEvidenceLane, ForwardAlphaEvidence>>>;
  readonly statusesReached: readonly ForwardAlphaStatus[];
  readonly syntheticFixture: boolean;
  readonly qualificationMarker:
    | typeof HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED
    | typeof HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED;
}): string {
  const evidence = Object.fromEntries(
    Object.entries(input.evidenceByLane).map(([lane, row]) => [
      lane,
      row
        ? {
            ...row,
            netEconomicsMinor: row.netEconomicsMinor.toString(),
            tradingCostMinor: row.tradingCostMinor.toString(),
            afterCostsNetMinor: row.afterCostsNetMinor.toString(),
          }
        : null,
    ]),
  );
  return JSON.stringify({
    schemaVersion: HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA,
    campaign: {
      ...input.campaign,
      strategy: {
        ...input.campaign.strategy,
      },
    },
    evidenceByLane: evidence,
    statusesReached: input.statusesReached,
    syntheticFixture: input.syntheticFixture,
    qualificationMarker: input.qualificationMarker,
  });
}

export function buildForwardAlphaManifest(input: {
  readonly campaign: ForwardAlphaCampaign;
  readonly evidenceByLane: Readonly<Partial<Record<ForwardAlphaEvidenceLane, ForwardAlphaEvidence>>>;
  readonly statusesReached: readonly ForwardAlphaStatus[];
  readonly syntheticFixture: boolean;
  readonly qualified: boolean;
  readonly materializedAt: UtcInstant;
}): ForwardAlphaManifest {
  const qualificationMarker = input.qualified
    ? HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED
    : HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED;
  const contentHash = createHash('sha256')
    .update(
      canonicalManifestPayload({
        campaign: input.campaign,
        evidenceByLane: input.evidenceByLane,
        statusesReached: input.statusesReached,
        syntheticFixture: input.syntheticFixture,
        qualificationMarker,
      }),
    )
    .digest('hex');
  const manifestId = asForwardAlphaManifestId(`faman_${contentHash.slice(0, 20)}`);
  return Object.freeze({
    manifestId,
    schemaVersion: HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA,
    campaign: input.campaign,
    evidenceByLane: Object.freeze({ ...input.evidenceByLane }),
    statusesReached: Object.freeze([...input.statusesReached]),
    qualificationMarker,
    contentHash,
    syntheticFixture: input.syntheticFixture,
  });
}

export function aggregateForwardAlphaEvidence(input: {
  readonly evidenceId: import('./ids.ts').ForwardAlphaEvidenceId;
  readonly campaignId: import('./ids.ts').ForwardAlphaCampaignId;
  readonly lane: ForwardAlphaEvidenceLane;
  readonly decisions: readonly import('./types.ts').ForwardAlphaDecision[];
  readonly outcomes: readonly import('./types.ts').ForwardAlphaOutcome[];
  readonly syntheticFixture: boolean;
}): ForwardAlphaEvidence {
  let net = 0n;
  let costs = 0n;
  for (const outcome of input.outcomes) {
    net += outcome.netEconomicsMinor;
    costs += outcome.tradingCostMinor;
  }
  const contentDigest = createHash('sha256')
    .update(
      JSON.stringify({
        lane: input.lane,
        decisionIds: input.decisions.map((row) => row.decisionId),
        net: net.toString(),
        costs: costs.toString(),
      }),
    )
    .digest('hex');
  return Object.freeze({
    evidenceId: input.evidenceId,
    campaignId: input.campaignId,
    lane: input.lane,
    decisionIds: Object.freeze(input.decisions.map((row) => row.decisionId)),
    decisionCount: input.decisions.length,
    netEconomicsMinor: net,
    tradingCostMinor: costs,
    afterCostsNetMinor: net - costs,
    contentDigest,
    syntheticFixture: input.syntheticFixture,
  });
}
