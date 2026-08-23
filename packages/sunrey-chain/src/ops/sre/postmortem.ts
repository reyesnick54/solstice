export const POSTMORTEM_SECTIONS = [
  'impact',
  'timeline',
  'root_cause',
  'contributing_factors',
  'detection',
  'response',
  'corrective_actions',
  'control_improvements',
] as const;
export type PostmortemSection = (typeof POSTMORTEM_SECTIONS)[number];

export type PostmortemTemplate = {
  readonly title: string;
  readonly blame: false;
  readonly focus: 'systems';
  readonly sections: readonly {
    readonly id: PostmortemSection;
    readonly prompt: string;
  }[];
  readonly path: 'docs/productization/SUNREY_POSTMORTEM_TEMPLATE.md';
};

export function postmortemTemplate(): PostmortemTemplate {
  return Object.freeze({
    title: 'SunRey incident postmortem',
    blame: false,
    focus: 'systems',
    path: 'docs/productization/SUNREY_POSTMORTEM_TEMPLATE.md',
    sections: Object.freeze([
      { id: 'impact' as const, prompt: 'What customer, financial-integrity, and operator impact occurred? Use facts, not blame.' },
      { id: 'timeline' as const, prompt: 'UTC timeline from first precursor through CLOSED, including detection and mitigations.' },
      { id: 'root_cause' as const, prompt: 'Which system condition made the impact possible? Name components, not people.' },
      { id: 'contributing_factors' as const, prompt: 'What else narrowed the margin: gaps in telemetry, runbooks, or degraded-mode design?' },
      { id: 'detection' as const, prompt: 'How was it detected? Which alert, SLI, or human observation? What was the detection lag?' },
      { id: 'response' as const, prompt: 'What did responders do? Which kill switch or degraded mode was used? What was refused?' },
      { id: 'corrective_actions' as const, prompt: 'Concrete system changes with owners as roles, not named staff unless the repository already names them.' },
      { id: 'control_improvements' as const, prompt: 'Which Kernel, ledger, backup, or control-room controls should get stricter?' },
    ]),
  });
}
