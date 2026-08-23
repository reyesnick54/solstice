import type { SubjectRef } from '../ids.ts';
import { HIN_ECONOMIC_VALUE_INPUT_UNIT } from './types.ts';
import type {
  HinContributionRecord,
  HinCustomerContributionView,
  HinCustomerSummary,
  HinEconomicValueInput,
} from './types.ts';

function toView(record: HinContributionRecord, valueInput: HinEconomicValueInput | undefined): HinCustomerContributionView {
  return Object.freeze({
    contributionId: record.contributionId,
    category: record.category,
    verification: record.verification,
    observedAt: record.observedAt,
    quantity: record.quantity.toString(),
    unit: record.unit,
    economicValueInput: valueInput ? valueInput.normalizedValue.toString() : null,
    issuancePromised: false,
  });
}

export function customerHinSummary(input: {
  readonly subject: SubjectRef;
  readonly records: readonly HinContributionRecord[];
  readonly valueInputs: readonly HinEconomicValueInput[];
}): HinCustomerSummary {
  const owned = input.records.filter((row) => row.subject === input.subject);
  const byId = new Map(input.valueInputs.map((row) => [row.contributionId, row]));
  const views = owned.map((row) => toView(row, byId.get(row.contributionId)));
  const verified = views.filter((row) => row.verification === 'SYSTEM_VERIFIED' || row.verification === 'SOURCE_VERIFIED');
  const pending = views.filter(
    (row) => row.verification === 'UNVERIFIED' || row.verification === 'SELF_DECLARED' || row.verification === 'DISPUTED',
  );
  const rights = [...new Set(owned.map((row) => row.rightsReference).filter((row): row is string => row !== null))];
  return Object.freeze({
    schema: 'sunrey.hin.customer-summary.v1',
    subject: input.subject,
    contributions: Object.freeze(views),
    verified: Object.freeze(verified),
    pending: Object.freeze(pending),
    economicValueInputs: Object.freeze(
      input.valueInputs
        .filter((row) => owned.some((record) => record.contributionId === row.contributionId))
        .map((row) =>
          Object.freeze({
            valueInputId: row.valueInputId,
            contributionId: row.contributionId,
            normalizedValue: row.normalizedValue.toString(),
            denomination: HIN_ECONOMIC_VALUE_INPUT_UNIT,
            isMintAmount: false as const,
          }),
        ),
    ),
    dataRights: Object.freeze(rights),
    compensation: Object.freeze({
      present: false,
      mintRequested: false,
      issuancePromised: false,
      note: 'Compensation, if any, is a settlement instruction. Token issuance is not promised unless authorized protocol policy defines it.',
    }),
    history: Object.freeze(views),
    issuancePromised: false,
    productionActivated: false,
  });
}
