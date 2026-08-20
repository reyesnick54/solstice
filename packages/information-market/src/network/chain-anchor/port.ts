import type { Result } from '../../../../domain/src/result.ts';
import type {
  HinAnchorFailure,
  HinAnchorRequest,
  HumanInformationAnchorId,
  HumanInformationChainAnchorRecord,
} from './types.ts';

/**
 * Narrow HIN-side chain port.
 *
 * HIN may create, submit, inspect, and reconcile privacy-safe
 * evidence anchors. It does not gain wallet, mint, validator,
 * governance, or arbitrary chain-write authority.
 */
export type HumanInformationChainAnchorPort = {
  createAnchorIntent(
    request: HinAnchorRequest,
  ): Result<HumanInformationChainAnchorRecord, HinAnchorFailure>;
  submitAnchor(
    anchorId: HumanInformationAnchorId | string,
  ): Result<HumanInformationChainAnchorRecord, HinAnchorFailure>;
  anchorStatus(anchorId: HumanInformationAnchorId | string): HumanInformationChainAnchorRecord | undefined;
  reconcileAnchor(
    anchorId: HumanInformationAnchorId | string,
  ): Result<HumanInformationChainAnchorRecord, HinAnchorFailure>;
};
