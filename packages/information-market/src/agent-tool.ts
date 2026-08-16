import { err, type Result } from '../../domain/src/result.ts';
import type { InformationMarketFailure } from './types.ts';

/**
 * Subject-scoped Personal Economy Agent surface. Structural refusal — the
 * agent cannot execute, mint, settle, or modify beneficiaries.
 */
export class SubjectScopedInformationMarketTool {
  publishRequest(): Result<never, InformationMarketFailure> {
    return err({
      code: 'AGENT_CANNOT_EXECUTE',
      message: 'Personal Economy Agent cannot publish or operate the information market',
    });
  }

  mint(): Result<never, InformationMarketFailure> {
    return err({
      code: 'AGENT_CANNOT_MINT',
      message: 'Personal Economy Agent cannot mint SunRey Coin',
    });
  }

  addBeneficiary(): Result<never, InformationMarketFailure> {
    return err({
      code: 'AGENT_CANNOT_MODIFY_BENEFICIARY',
      message: 'agents have no capability to add or modify a beneficiary',
    });
  }

  sellRawRecords(): Result<never, InformationMarketFailure> {
    return err({
      code: 'RAW_EXPORT_DENIED',
      message: 'raw vault records are not a marketplace product',
    });
  }
}
