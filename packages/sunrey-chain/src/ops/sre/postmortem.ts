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
      { id: 'impact', prompt: 'What customer, financial-integrity, and operator impact occurred? Use facts, not blame.' },
      { id: 'timeline', prompt: 'UTC timeline from first precursor through CLOSED, including detection and mitigations.' },
      { id: 'root_cause', prompt: 'Which system condition made the impact possible? Name components, not people.' },
      { id: 'contributing_factors', prompt: 'What else narrowed the margin: gaps in telemetry, runbooks, or degraded-mode design?' },
      { id: 'detection', prompt: 'How was it detected? Which alert, SLI, or human observation? What was the detection lag?' },
      { id: 'response', prompt: 'What did responders do? Which kill switch or degraded mode was used? What was refused?' },
      { id: 'corrective_actions', prompt: 'Concrete system changes with owners as roles, not named staff unless the repository already names them.' },
      { id: 'control_improvements', prompt: 'Which Kernel, ledger, backup, or control-room controls should get stricter?' },
    ]),
  });
}
