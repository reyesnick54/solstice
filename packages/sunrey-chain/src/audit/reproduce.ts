import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { generateAuditBundle, verifyAuditBundle } from './bundle.ts';
import { controlsLinkedToTests } from './controls.ts';
import { applyFindingTransition, receiveFinding } from './findings.ts';
import { requiredLockfilesPresent } from './reproducibility.ts';
import { SANITIZED_SAMPLE_CONFIG, secretExclusionFindings } from './secrets.ts';
import { scopeIsComplete } from './scope.ts';

export type ReproduceStep = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ReproduceResult = {
  readonly ok: boolean;
  readonly usedTestOnlyKeys: true;
  readonly isolated: true;
  readonly steps: readonly ReproduceStep[];
};

const FULL_COMMANDS = [
  ['npm', 'run', 'test:fuzz-smoke'],
  ['npm', 'run', 'sunrey-range', '--', 'campaign', '--smoke'],
  ['npm', 'run', 'sunrey-bench', '--', 'sanity'],
] as const;

export function reproduceCritical(root: string, options: { readonly full?: boolean } = {}): ReproduceResult {
  const steps: ReproduceStep[] = [];
  steps.push({
    id: 'lockfiles',
    ok: requiredLockfilesPresent(root),
    detail: 'package-lock and Cargo.lock pins',
  });
  steps.push({
    id: 'scope',
    ok: scopeIsComplete(),
    detail: 'sixteen review domains',
  });
  steps.push({
    id: 'control-tests',
    ok: controlsLinkedToTests(),
    detail: 'every control has a test reference',
  });
  const generated = generateAuditBundle(root, {
    sourceCommit: 'reproduce-local',
    outDir: join(root, 'dist', 'sunrey-audit-reproduce'),
  });
  const verified = verifyAuditBundle(generated.outDir);
  steps.push({ id: 'bundle-generate', ok: generated.secretFindings.length === 0, detail: 'secret-free bundle' });
  steps.push({ id: 'bundle-verify', ok: verified.ok, detail: verified.ok ? 'hashes matched' : 'verify failed' });
  steps.push({
    id: 'sample-config',
    ok: secretExclusionFindings(JSON.stringify(SANITIZED_SAMPLE_CONFIG)).length === 0,
    detail: 'sanitized reviewer config',
  });

  const received = receiveFinding({
    finding_id: 'FND-REPRO-1',
    reviewer_reference: 'repro',
    title: 'lifecycle probe',
    description: 'AI must not resolve',
    affected_component: 'packages/sunrey-chain/src/audit',
    reviewer_severity: 'reviewer-high',
  });
  let aiBlocked = false;
  try {
    applyFindingTransition(received, {
      from: 'RECEIVED',
      to: 'TRIAGED',
      actor: 'AI',
      humanApprovalReference: null,
    });
    applyFindingTransition(
      {
        ...received,
        sunrey_triage_status: 'READY_FOR_RETEST',
        resolution_status: 'READY_FOR_RETEST',
      },
      {
        from: 'READY_FOR_RETEST',
        to: 'VERIFIED_RESOLVED',
        actor: 'AI',
        humanApprovalReference: null,
      },
    );
  } catch (error) {
    aiBlocked = error instanceof Error && error.message.includes('AI cannot mark');
  }
  steps.push({ id: 'ai-authority', ok: aiBlocked, detail: 'AI cannot mark VERIFIED_RESOLVED' });

  if (options.full) {
    for (const command of FULL_COMMANDS) {
      const result = spawnSync(command[0]!, command.slice(1), { cwd: root, encoding: 'utf8' });
      steps.push({
        id: `full:${command.join(' ')}`,
        ok: result.status === 0,
        detail: result.status === 0 ? 'ok' : (result.stderr || result.stdout || 'failed').slice(0, 400),
      });
    }
  }

  return {
    ok: steps.every((row) => row.ok),
    usedTestOnlyKeys: true,
    isolated: true,
    steps,
  };
}

export const QUICKSTART_STEPS = [
  'verify bundle',
  'inspect architecture',
  'run critical test suite',
  'run formal smoke',
  'run fuzz smoke',
  'run adversarial smoke',
  'launch seven-validator development network',
  'perform native transfer',
  'inspect Explorer',
  'verify release artifact',
] as const;
