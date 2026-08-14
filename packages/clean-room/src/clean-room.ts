import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import {
  assertKernelAuthorization,
  canonicalJson,
  sha256Hex,
  type KernelAuthorization,
} from '@solstice/kernel';
import type { ConsentLedger, ConsentId } from '@solstice/consent';

export type ComputeJobId = string;

export type CleanRoomJob = {
  readonly jobId: ComputeJobId;
  readonly requestId: string;
  readonly consentReferences: readonly ConsentId[];
  readonly purpose: string;
  readonly status: 'COMPLETED' | 'HALTED' | 'REFUSED';
  readonly resultHash?: string;
  readonly recordsConsidered: bigint;
  readonly haltReason?: string;
  readonly authorizationHash: string;
  readonly completedAt: UtcInstant;
};

export type CleanRoomError =
  | { readonly code: 'CONSENT_NOT_ACTIVE'; readonly consentId: string }
  | { readonly code: 'NO_CONSENTS' };

/**
 * Simulated clean room. Accepts consent references only.
 * Output is a completion state and a result hash — never raw records,
 * never individual readings, never reconstructible personal detail.
 */
export class CleanRoom {
  readonly #jobs: CleanRoomJob[] = [];

  /** @kernelGated */
  run(
    authorization: KernelAuthorization,
    input: {
      readonly jobId: ComputeJobId;
      readonly requestId: string;
      readonly consentReferences: readonly ConsentId[];
      readonly purpose: string;
      readonly consentLedger: ConsentLedger;
      readonly at: UtcInstant;
    },
  ): Result<CleanRoomJob, CleanRoomError> {
    assertKernelAuthorization(authorization, 'RUN_CLEAN_ROOM');
    if (input.consentReferences.length === 0) {
      return err({ code: 'NO_CONSENTS' });
    }
    for (const consentId of input.consentReferences) {
      if (!input.consentLedger.isActive(consentId)) {
        const halted: CleanRoomJob = Object.freeze({
          jobId: input.jobId,
          requestId: input.requestId,
          consentReferences: Object.freeze(input.consentReferences.slice()),
          purpose: input.purpose,
          status: 'HALTED',
          recordsConsidered: 0n,
          haltReason: `consent ${consentId} is not active; computation refused`,
          authorizationHash: authorization.permitHash,
          completedAt: input.at,
        });
        this.#jobs.push(halted);
        return err({ code: 'CONSENT_NOT_ACTIVE', consentId });
      }
    }
    const resultHash = sha256Hex(
      canonicalJson({
        jobId: input.jobId,
        requestId: input.requestId,
        consentReferences: input.consentReferences,
        purpose: input.purpose,
        recordsConsidered: String(input.consentReferences.length),
      }),
    );
    const job: CleanRoomJob = Object.freeze({
      jobId: input.jobId,
      requestId: input.requestId,
      consentReferences: Object.freeze(input.consentReferences.slice()),
      purpose: input.purpose,
      status: 'COMPLETED',
      resultHash,
      recordsConsidered: BigInt(input.consentReferences.length),
      authorizationHash: authorization.permitHash,
      completedAt: input.at,
    });
    this.#jobs.push(job);
    return ok(job);
  }

  get(jobId: ComputeJobId): CleanRoomJob | undefined {
    return this.#jobs.find((job) => job.jobId === jobId);
  }

  list(): readonly CleanRoomJob[] {
    return this.#jobs.slice();
  }
}
