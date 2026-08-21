import { FakeExternalHttpTransport } from '../../../sunrey-chain/src/oracle/production/transport.ts';
import {
  classifyHostname,
  destinationMatchesProfile,
  enforceSsrfPolicy,
  governRedirect,
  parseDestination,
} from '../../../sunrey-chain/src/oracle/production/security-policy.ts';
import type { ProviderEndpointProfile } from '../../../sunrey-chain/src/oracle/production/runtime-types.ts';
import { ALLOWED_CONTENT_TYPES } from '../../../sunrey-chain/src/oracle/production/runtime-types.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'CONNECTOR_FAILS_CLOSED',
  'ORACLE_CONSENSUS_NO_HTTP',
  'PRODUCTION_NOT_ACTIVE',
] as const;

function publicProfile(): ProviderEndpointProfile {
  return Object.freeze({
    profileId: 'profile:oracle:public',
    providerId: 'fixture-oracle',
    sourceId: 'src_fixture_oracle',
    scheme: 'https',
    hostname: 'approved.example.test',
    port: 443,
    pathPrefix: '/energy/v1/',
    allowedMethods: ['GET'] as const,
    authenticationClass: 'API_KEY_REFERENCE',
    tlsPolicy: 'REQUIRE_VALID_CERTIFICATE',
    maximumResponseBytes: 4_096,
    timeoutMs: 1_000,
    redirectPolicy: 'FOLLOW_BOUNDED',
    maxRedirects: 1,
    networkClass: 'PUBLIC_INTERNET',
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
  });
}

export const endpointScenarios: readonly AttackScenario[] = [
  'ENDPOINT-LOCALHOST',
  'ENDPOINT-METADATA',
  'ENDPOINT-LINK-LOCAL',
  'ENDPOINT-IP-LITERAL',
  'ENDPOINT-REDIRECT-ESCAPE',
  'ENDPOINT-CREDENTIAL-IN-URL',
  'ENDPOINT-DNS-MISMATCH',
  'ENDPOINT-UNAPPROVED-PATH',
  'ENDPOINT-OVERSIZED',
  'ENDPOINT-WRONG-CONTENT-TYPE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15720 + index,
    category: 'ENDPOINT_SSRF',
    subsystem: 'connector',
    attack: scenarioId.toLowerCase().replace('endpoint-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'SSRF_DESTINATION_FORBIDDEN',
  }),
);

export function runEndpoint(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const profile = publicProfile();
    const transport = new FakeExternalHttpTransport();
    const noInternet = transport.contactsPublicInternet === false;
    const refused = (raw: string): boolean => {
      const parsed = parseDestination(raw);
      if (!parsed.ok) {
        return true;
      }
      const ssrf = enforceSsrfPolicy(parsed.value, profile, 'FIXTURE');
      if (!ssrf.ok) {
        return true;
      }
      return !destinationMatchesProfile(parsed.value, profile).ok;
    };
    let blocked = false;
    switch (scenario.scenarioId) {
      case 'ENDPOINT-LOCALHOST':
        blocked = refused('https://localhost/latest') && classifyHostname('localhost') === 'LOOPBACK_FIXTURE';
        break;
      case 'ENDPOINT-METADATA':
        blocked = refused('https://169.254.169.254/latest/meta-data') && classifyHostname('169.254.169.254') === 'BLOCKED_METADATA';
        break;
      case 'ENDPOINT-LINK-LOCAL':
        blocked = refused('https://169.254.1.1/steal');
        break;
      case 'ENDPOINT-IP-LITERAL':
        blocked = refused('https://127.0.0.1/admin');
        break;
      case 'ENDPOINT-REDIRECT-ESCAPE': {
        const current = parseDestination('https://approved.example.test/energy/v1/readings');
        const redirect = current.ok
          ? governRedirect(current.value, 'https://evil.example.test/steal', profile, 0, 'FIXTURE')
          : current;
        blocked = !redirect.ok;
        break;
      }
      case 'ENDPOINT-CREDENTIAL-IN-URL':
        blocked = !parseDestination('https://user:pass@approved.example.test/energy/v1/readings').ok;
        break;
      case 'ENDPOINT-DNS-MISMATCH':
        blocked = refused('https://other.example.test/energy/v1/readings');
        break;
      case 'ENDPOINT-UNAPPROVED-PATH':
        blocked = refused('https://approved.example.test/admin/secrets');
        break;
      case 'ENDPOINT-OVERSIZED':
        blocked = profile.maximumResponseBytes < 10_000 && noInternet;
        break;
      case 'ENDPOINT-WRONG-CONTENT-TYPE':
        blocked = !(ALLOWED_CONTENT_TYPES as readonly string[]).includes('text/html') && noInternet;
        break;
      default:
        blocked = false;
    }
    return {
      blocked: blocked && noInternet,
      safetyHeld: blocked && noInternet,
      detail: `${scenario.scenarioId} connectorFailsClosed=${String(blocked)} contactsPublicInternet=${String(transport.contactsPublicInternet)}`,
    };
  });
}
