import {
  OracleObservationDedupe,
  oracleObservationKey,
} from '../../../../events/src/operation/index.ts';

export { OracleObservationDedupe, oracleObservationKey };

/**
 * Oracle collection is read-oriented. Retry/pagination replay must not
 * create a second observation draft for the same
 * (provider, source, feed, sourceObservationId). This is not consensus.
 */
export function admitCollectedObservation(
  ledger: OracleObservationDedupe,
  input: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly feedId: string;
    readonly sourceObservationId: string;
  },
): 'accepted' | 'duplicate' {
  return ledger.admit(input);
}
