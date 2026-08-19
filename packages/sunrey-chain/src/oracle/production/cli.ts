import { defaultOracleSuiteId } from '../crypto.ts';
import { OracleCollector, engineSubmissionPort } from './collector.ts';
import { attachOnboardingEvidence, createOnboardingDraft, emptyOnboardingEvidence, transitionOnboarding } from './onboarding.ts';
import { collectorIdentityFor, createProductionPlane, developmentProductionFeed, planePublicFeeds, planeReadiness } from './plane.ts';
import { SoftwareDevelopmentSigner } from './signing.ts';
import { LocalProviderSimulator } from './simulator.ts';
import { validateExternalRecord } from './schema.ts';
import { isOnboardingStatus } from './types.ts';
import { enforceFeedDefinitionMapping } from '../source-taxonomy/onboarding.ts';

export type CliResult = {
  readonly ok: boolean;
  readonly output: string;
};

function json(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2);
}

export function runSunreyOracle(argv: readonly string[]): CliResult {
  const plane = createProductionPlane();
  const command = argv[0];
  const subject = argv[1];
  try {
    if (command === 'provider' && subject === 'onboard') {
      const providerId = argv[2] ?? 'oracle_energy-d';
      const signer = SoftwareDevelopmentSigner.fromLabel(providerId, defaultOracleSuiteId());
      if (!signer.ok) {
        return { ok: false, output: signer.error.detail };
      }
      const draft = createOnboardingDraft({
        providerId,
        legalEntityReference: null,
        controllerReference: `controller_${providerId}`,
        dataCategories: ['energy'],
        feeds: [plane.feed.feedId],
        authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
        signingKey: {
          schemaVersion: 1,
          keyId: `key_${providerId}`,
          keyVersion: 1,
          publicKeyHex: signer.value.publicKey().publicKeyHex,
          cryptoSuite: defaultOracleSuiteId(),
          signerKind: 'SOFTWARE_DEVELOPMENT',
          rotatedFromKeyId: null,
          active: true,
        },
        cryptoSuite: defaultOracleSuiteId(),
        infrastructureRegion: 'sim-lab',
        sourceRelationships: [],
        onboardingEvidence: emptyOnboardingEvidence(),
        securityReviewStatus: 'NOT_REVIEWED',
        commercialAgreementEvidenceReference: null,
      });
      if (!draft.ok) {
        return { ok: false, output: draft.error.detail };
      }
      plane.onboarding.put(draft.value);
      return { ok: true, output: json({ providerId, status: draft.value.status, productionEligibility: false }) };
    }
    if (command === 'provider' && subject === 'status') {
      const providerId = argv[2] ?? plane.providers[0]!.providerId;
      const record = plane.onboarding.get(providerId);
      if (!record) {
        return { ok: false, output: `unknown provider ${providerId}` };
      }
      return {
        ok: true,
        output: json({
          providerId: record.providerId,
          status: record.status,
          productionEligibility: record.productionEligibility,
          commercialAgreementState: record.onboardingEvidence.commercialAgreementState,
        }),
      };
    }
    if (command === 'provider' && subject === 'suspend') {
      const providerId = argv[2] ?? plane.providers[0]!.providerId;
      const incident = plane.incidents.apply({
        incidentId: `inc_suspend_${providerId}`,
        providerId,
        action: 'PROVIDER_SUSPENSION',
        actorKind: 'HUMAN',
        actorId: 'operator.sim',
        evidenceRef: 'evidence.suspend.sim',
        atUnix: 1_700_000_000n,
      });
      if (!incident.ok) {
        return { ok: false, output: incident.error.detail };
      }
      return { ok: true, output: json({ providerId, status: plane.onboarding.get(providerId)?.status, incident: incident.value.incidentId }) };
    }
    if (command === 'feed' && subject === 'create') {
      const feed = developmentProductionFeed(argv[2] ?? 'feed_energy_production_sim');
      const mapped = enforceFeedDefinitionMapping(feed, 'energy');
      if (!mapped.ok) {
        return { ok: false, output: json(mapped.error) };
      }
      return { ok: true, output: json({ feedId: feed.feedId, version: feed.version, productionEligible: feed.productionEligible }) };
    }
    if (command === 'feed' && subject === 'validate') {
      const mapped = enforceFeedDefinitionMapping(plane.feed, 'energy');
      if (!mapped.ok) {
        return { ok: false, output: json(mapped.error) };
      }
      const checked = validateExternalRecord(plane.feed.schema, {
        identifier: 'plant_sim_1',
        numericValue: '100',
        unit: 'MWh',
        sourceTimestampUnix: '1700000000',
        schemaId: plane.feed.schema.schemaId,
        schemaVersion: plane.feed.schema.version,
      });
      return { ok: checked.ok, output: json(checked.ok ? { valid: true } : checked.error) };
    }
    if (command === 'source' && subject === 'health') {
      return { ok: true, output: json(plane.health.list()) };
    }
    if (command === 'readiness') {
      const readiness = planeReadiness();
      return {
        ok: true,
        output: json({
          ...readiness,
          publicFeeds: planePublicFeeds(plane, undefined, 1_700_000_000n),
        }),
      };
    }
    if (command === 'collector' && subject === 'run') {
      const sourceId = argv[2] ?? 'src_energy-a';
      const signer = SoftwareDevelopmentSigner.fromLabel('energy-a', defaultOracleSuiteId());
      if (!signer.ok) {
        return { ok: false, output: signer.error.detail };
      }
      const collector = new OracleCollector(
        plane.onboarding,
        plane.sources,
        new LocalProviderSimulator(
          {
            category: 'energy',
            identifier: 'plant_sim_1',
            healthyValue: '100',
            unit: 'MWh',
            schemaId: 'energy.resource.v1',
            schemaVersion: 1,
          },
          'HEALTHY',
          1_700_000_000n,
        ),
        signer.value,
        plane.secrets,
        engineSubmissionPort(plane.engines[0]!),
      );
      const ran = collector.run({
        identity: collectorIdentityFor(plane, sourceId, 1_700_000_000n),
        sourceId,
        feed: plane.feed,
        subject: 'plant_sim_1',
        sequence: 1n,
        nowUnix: 1_700_000_000n,
        networkId: plane.engines[0]!.networkId,
        chainId: plane.engines[0]!.chainId,
      });
      if (!ran.ok) {
        return { ok: false, output: ran.error.detail };
      }
      return { ok: true, output: json({ observationId: ran.value.observation.observationId, submitted: true }) };
    }
    if (command === 'provider' && subject && isOnboardingStatus(subject)) {
      return { ok: false, output: 'use provider onboard|status|suspend' };
    }
    return {
      ok: false,
      output:
        'sunrey-oracle provider onboard|status|suspend | feed create|validate | source health | readiness | collector run',
    };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runSunreyOracle(process.argv.slice(2));
  process.stdout.write(`${result.output}\n`);
  process.exit(result.ok ? 0 : 1);
}

void attachOnboardingEvidence;
void transitionOnboarding;
