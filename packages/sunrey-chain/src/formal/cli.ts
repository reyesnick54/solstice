#!/usr/bin/env node
import { exploreModel, requireVerified } from './explore.ts';
import { modelsForProfile } from './models/index.ts';
import { resolveFormalProfile } from './profiles.ts';
import { loadFormalModelRegistry } from './registry.ts';
import { buildFormalVerificationReport, publicAssuranceView, writeFormalVerificationReport } from './report.ts';
import { allDevelopmentTraces } from './traces.ts';
import { checkTraceConformance } from './conformance.ts';
import type { FormalProfileName } from './types.ts';

function usage(): string {
  return [
    'sunrey-formal smoke',
    'sunrey-formal extended',
    'sunrey-formal report',
    'sunrey-formal registry',
    'sunrey-formal traces',
  ].join('\n');
}

function runProfile(name: FormalProfileName): void {
  const profile = resolveFormalProfile(name);
  const results = modelsForProfile(profile).map((model) =>
    exploreModel(model, profile.name, 'sunrey-formal-explicit-state/1'),
  );
  for (const result of results) {
    requireVerified(result);
  }
  const traces = checkTraceConformance(allDevelopmentTraces());
  if (traces.some((row) => !row.aligned)) {
    throw new Error('implementation traces failed formal-model conformance');
  }
  const report = buildFormalVerificationReport(name);
  const path = writeFormalVerificationReport(report);
  console.log(JSON.stringify({ profile: name, path, view: publicAssuranceView(report) }, null, 2));
}

function main(argv: readonly string[]): void {
  const command = argv[0];
  if (command === 'smoke') {
    runProfile('FORMAL_SMOKE');
    return;
  }
  if (command === 'extended') {
    runProfile('FORMAL_EXTENDED');
    return;
  }
  if (command === 'report') {
    const report = buildFormalVerificationReport(resolveFormalProfile().name);
    console.log(JSON.stringify(writeFormalVerificationReport(report)));
    return;
  }
  if (command === 'registry') {
    console.log(JSON.stringify(loadFormalModelRegistry(), null, 2));
    return;
  }
  if (command === 'traces') {
    console.log(JSON.stringify(checkTraceConformance(allDevelopmentTraces()), null, 2));
    return;
  }
  throw new Error(usage());
}

main(process.argv.slice(2));
