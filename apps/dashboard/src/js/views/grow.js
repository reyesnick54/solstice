// Grow My Money: plan, mandate controls, strategies and opportunities.
// Deposits are never shown as performance; no return is promised.

import { api } from '../api.js';
import { money, humanize, dateTime } from '../format.js';
import { badge, h, note, panel, table } from '../ui.js';
import { autoKv, items, view } from './common.js';

export function growView({ navigate }) {
  return view(
    panel({
      title: 'Your Grow plan',
      subtitle: 'Paper and simulated allocation only',
      load: () => api.get('/grow/plan'),
      render: (p) =>
        h(
          'div',
          { class: 'stack' },
          autoKv(p),
          note('Grow never guarantees an outcome. Simulated or paper results are not profits.', 'gold'),
        ),
    }),
    panel({
      title: 'Mandate & controls',
      subtitle: 'Your limits are enforced by the deterministic Risk Engine, not by the AI',
      load: () => api.get('/grow/controls/status'),
      render: (c) => autoKv(c, { limit: 18 }),
    }),
    panel({
      title: 'Active capital',
      subtitle: 'Reserved, allocated and available paper capital',
      load: () => api.get('/grow/active-capital'),
      render: (d) => autoKv(d.activeCapital || d, { limit: 16 }),
    }),
    panel({
      title: 'Results',
      subtitle: 'Recorded observations only',
      load: () => api.get('/grow/results'),
      render: (d) => h('div', { class: 'stack' }, autoKv(d.performance || d, { limit: 16 }), d.disclosure ? autoKv(d.disclosure) : null),
    }),
    panel({
      title: 'Strategies',
      subtitle: 'Strategy Capsules available to your plan',
      wide: true,
      actions: [h('button', { class: 'btn btn-sm', onclick: () => navigate('/helios') }, 'Open Helios desk')],
      load: () => api.get('/grow/strategies'),
      empty: (d) => items(d).length === 0 && 'No strategies are available.',
      render: (d) =>
        table(
          [
            { label: 'Strategy', render: (s) => s.displayName || s.name || s.strategyRef },
            { label: 'Family', render: (s) => humanize(s.strategyFamily) },
            { label: 'Risk', render: (s) => humanize(s.riskLevel || s.riskClass) },
            { label: 'Status', render: (s) => badge(s.status || s.state || s.qualificationState) },
            { label: 'Mode', render: (s) => badge(s.executionMode || s.mode || 'PAPER', 'info') },
          ],
          items(d),
        ),
    }),
    panel({
      title: 'Opportunities',
      subtitle: 'Ranked by the Growth Orchestrator. Proposals, not instructions.',
      wide: true,
      load: () => api.get('/grow/opportunities'),
      empty: (d) => items(d).length === 0 && 'No opportunities right now.',
      render: (d) =>
        table(
          [
            { label: 'Opportunity', render: (o) => o.title || humanize(o.kind || o.category) },
            { label: 'Source of value', render: (o) => humanize(o.valueSource || o.growthSource || o.category) },
            { label: 'Estimated', align: 'right', render: (o) => (o.estimatedValue ? money(o.estimatedValue) : '—') },
            { label: 'Confidence', render: (o) => humanize(o.confidence || o.confidenceBand) },
            { label: 'Generated', render: (o) => dateTime(o.generatedAt || d.generatedAt) },
          ],
          items(d),
        ),
    }),
  );
}
