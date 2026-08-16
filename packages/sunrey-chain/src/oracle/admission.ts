import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { PublicKeyDescriptor } from '../../../security/src/index.ts';
import { schemaAllowsUnit } from './schemas.ts';
import { verifyObservationSignature, type OracleCryptoPorts } from './crypto.ts';
import { meterOracleSubmission, type OracleResourcePolicy } from './resources.ts';
import type {
  OracleFeedDefinition,
  OracleObservation,
  OracleProviderRecord,
  OracleRejection,
} from './types.ts';

export type AdmissionContext = {
  readonly networkId: string;
  readonly chainId: string;
  readonly nowUnix: bigint;
  readonly height: number;
  readonly lastSequence: bigint | null;
  readonly provider: OracleProviderRecord | null;
  readonly feed: OracleFeedDefinition | null;
  readonly publicKey: PublicKeyDescriptor | null;
};

export function admitObservation(
  observation: OracleObservation,
  context: AdmissionContext,
  ports: OracleCryptoPorts,
  resourcePolicy: OracleResourcePolicy,
): Result<true, OracleRejection> {
  const metered = meterOracleSubmission(observation, resourcePolicy);
  if (!metered.ok) {
    return metered;
  }
  if (observation.networkId !== context.networkId) {
    return err({ code: 'ORACLE_WRONG_NETWORK', detail: 'observation network does not match' });
  }
  if (observation.chainId !== context.chainId) {
    return err({ code: 'ORACLE_WRONG_CHAIN', detail: 'observation chain does not match' });
  }
  if (observation.schemaVersion !== 1) {
    return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'unsupported observation schema' });
  }
  if (!context.provider) {
    return err({ code: 'ORACLE_UNREGISTERED', detail: `oracle ${observation.oracleId} is not registered` });
  }
  const provider = context.provider;
  if (provider.status === 'SUSPENDED' || provider.status === 'REVOKED') {
    return err({
      code: provider.status === 'SUSPENDED' ? 'ORACLE_PROVIDER_SUSPENDED' : 'ORACLE_INACTIVE',
      detail: `oracle ${provider.oracleId} status ${provider.status}`,
    });
  }
  if (provider.status !== 'ACTIVE') {
    return err({ code: 'ORACLE_INACTIVE', detail: `oracle ${provider.oracleId} is not active` });
  }
  if (context.height < provider.activationHeight) {
    return err({ code: 'ORACLE_INACTIVE', detail: 'provider not yet activated' });
  }
  if (provider.expirationHeight !== null && context.height >= provider.expirationHeight) {
    return err({ code: 'ORACLE_INACTIVE', detail: 'provider expired' });
  }
  if (!context.feed) {
    return err({ code: 'ORACLE_WRONG_FEED', detail: `feed ${observation.feedId} is not registered` });
  }
  const feed = context.feed;
  if (feed.status !== 'ACTIVE' || context.height < feed.activationHeight) {
    return err({ code: 'ORACLE_FEED_INACTIVE', detail: `feed ${feed.feedId} is not active` });
  }
  if (observation.feedId !== feed.feedId) {
    return err({ code: 'ORACLE_WRONG_FEED', detail: 'observation feed does not match' });
  }
  if (!provider.authorizedFeedTypes.includes(feed.factType)) {
    return err({
      code: 'ORACLE_NOT_AUTHORIZED_FOR_FEED',
      detail: `${provider.oracleId} is not authorized for ${feed.factType}`,
    });
  }
  if (observation.value.unit !== feed.measurementUnit || observation.value.scale !== feed.quantityScale) {
    return err({
      code: 'ORACLE_WRONG_UNIT',
      detail: `expected ${feed.measurementUnit} scale ${feed.quantityScale}`,
    });
  }
  if (!schemaAllowsUnit(feed.factType, observation.value.unit)) {
    return err({ code: 'ORACLE_WRONG_UNIT', detail: 'unit not allowed for fact type' });
  }
  if (
    observation.value.mantissa < feed.minValue ||
    observation.value.mantissa > feed.maxValue
  ) {
    return err({ code: 'ORACLE_OUT_OF_BOUNDS', detail: 'observation value outside feed bounds' });
  }
  if (
    observation.measurementStartUnix > observation.measurementEndUnix ||
    observation.observationTimeUnix < observation.measurementStartUnix ||
    observation.observationTimeUnix > observation.measurementEndUnix
  ) {
    return err({ code: 'ORACLE_INVALID_TIME_WINDOW', detail: 'invalid measurement window' });
  }
  if (observation.validUntilUnix <= observation.observationTimeUnix) {
    return err({ code: 'ORACLE_INVALID_TIME_WINDOW', detail: 'valid_until must be after observation time' });
  }
  if (context.nowUnix > observation.validUntilUnix) {
    return err({ code: 'ORACLE_STALE_OBSERVATION', detail: 'observation valid_until has passed' });
  }
  if (context.nowUnix - observation.observationTimeUnix > BigInt(feed.maximumAgeSeconds)) {
    return err({ code: 'ORACLE_STALE_OBSERVATION', detail: 'observation exceeds feed maximum age' });
  }
  if (feed.requireGeography && observation.geography.region.length === 0) {
    return err({ code: 'ORACLE_GEOGRAPHY_REQUIRED', detail: 'feed requires geography' });
  }
  if (context.lastSequence !== null && observation.sequence <= context.lastSequence) {
    return err({ code: 'ORACLE_DUPLICATE_SEQUENCE', detail: 'sequence must increase per oracle and feed' });
  }
  if (observation.cryptoSuite !== provider.cryptoSuite) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: 'observation suite does not match provider record' });
  }
  if (!context.publicKey) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: 'provider public key missing' });
  }
  if (observation.publicKeyHex !== provider.publicKeyHex) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: 'observation key does not match registry' });
  }
  return verifyObservationSignature(ports, observation, context.publicKey, feed.requireHybridSignature);
}
