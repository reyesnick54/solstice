/**
 * HELIOS EARN12 — platform co-located smoke (core pipeline without subprocess gates).
 */

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import { runEarningsIntelligencePipeline } from './pipeline.ts';

const NOW = asUtcInstant('2026-11-04T07:00:00.000Z');
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('HELIOS EARN12 earnings intelligence (core pipeline)', () => {
  it('runs EARN01–EARN11 fixture pipeline with chronology gate', () => {
    const pipeline = runEarningsIntelligencePipeline(
      {
        qualifiedAt: NOW,
        gitSha: 'earn12_platform_smoke',
        root: REPO_ROOT,
      },
      Object.freeze({
        aafV2Qualified: true,
        strategyLabQualified: true,
        executionTwinQualified: true,
      }),
    );
    const failed = pipeline.stages.filter((row) => !row.ok);
    assert.equal(failed.length, 0, JSON.stringify(failed));
    assert.ok(pipeline.validationReport);
  });
});
