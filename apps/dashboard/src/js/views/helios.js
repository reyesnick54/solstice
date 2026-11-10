// Helios AI trading desk. A read surface over the existing Helios / Growth
// Orchestrator binding. Agents propose Action Intents; the Compliance Kernel,
// Risk Engine and Execution Authority decide. Paper results are labelled.

import { api } from '../api.js';
import { dateTime, humanize, money, relative } from '../format.js';
import { badge, h, note, panel, table } from '../ui.js';
import { autoKv, items, view } from './common.js';

export function heliosView() {
  return view(
    panel({
      title: 'Desk status',
      subtitle: 'Helios cycle and consumer state',
      wide: true,
      load: () => api.get('/grow/overview'),
      render: (o) =>
        h(
          'div',
          { class: 'stack' },
          note('Paper trading and simulation only. Real-money execution needs a licensed broker, an approved mandate, the Compliance Kernel, the Risk Engine and a signed Execution Authority, and is switched off.', 'gold'),
          autoKv(o, { skip: ['customerId', 'subjectId'], limit: 20 }),
        ),
    }),
    panel({
      title: 'Specialist agents',
      subtitle: 'What the agents are doing and why',
      wide: true,
      load: () => api.get('/grow/agent-state'),
      render: (s) =>
        h(
          'div',
          { class: 'stack' },
          s.summary ? h('p', { class: 'muted' }, s.summary) : null,
          Array.isArray(s.agents)
            ? h(
                'ul',
                { class: 'agents' },
                s.agents.map((a) =>
                  h(
                    'li',
                    { class: 'agent' },
                    h('div', { class: 'agent-top' }, h('strong', null, a.name), badge(a.status)),
                    h('p', { class: 'muted small' }, a.role),
                    h('p', { class: 'agent-task' }, a.currentTask),
                    a.lastProposalAt ? h('p', { class: 'muted small' }, `Last proposal ${relative(a.lastProposalAt)}`) : null,
                  ),
                ),
              )
            : autoKv(s, { skip: ['summary', 'customerId'], limit: 14 }),
        ),
    }),
    panel({
      title: 'Strategy ranking',
      subtitle: 'Strategy Capsules with backtest and paper evidence',
      wide: true,
      load: () => api.get('/grow/strategies'),
      empty: (d) => items(d).length === 0 && 'No qualified strategies.',
      render: (d) =>
        table(
          [
            { label: 'Rank', render: (s) => s.rank ?? '—' },
            { label: 'Strategy', render: (s) => s.displayName || s.name || s.strategyRef },
            { label: 'Markets', render: (s) => (s.markets || s.assetClasses || []).map(humanize).join(', ') || '—' },
            { label: 'Evidence', render: (s) => humanize(s.evidenceState || s.qualificationState || s.status) },
            { label: 'Allocation', align: 'right', render: (s) => (s.allocation ? money(s.allocation) : '—') },
            { label: 'Realised (paper)', align: 'right', render: (s) => (s.realisedPnl ? money(s.realisedPnl) : '—') },
            { label: 'Worst drawdown', align: 'right', render: (s) => (s.maxDrawdown ? money(s.maxDrawdown) : '—') },
            { label: 'Trades', align: 'right', render: (s) => s.trades ?? '—' },
            { label: 'Mode', render: (s) => badge(s.executionMode || s.mode || 'PAPER', 'info') },
          ],
          items(d),
        ),
    }),
    panel({
      title: 'Open positions',
      subtitle: 'Paper positions with realised and unrealised P&L kept apart',
      wide: true,
      load: () => api.get('/grow/positions'),
      empty: (d) => items(d).length === 0 && 'No open positions.',
      render: (d) =>
        table(
          [
            { label: 'Instrument', render: (p) => p.symbol || p.instrument || p.instrumentId },
            { label: 'Strategy', render: (p) => p.strategy || '—' },
            { label: 'Quantity', align: 'right', render: (p) => p.quantity },
            { label: 'Cost basis', align: 'right', render: (p) => money(p.costBasis) },
            { label: 'Market value', align: 'right', render: (p) => money(p.marketValue) },
            { label: 'Unrealised', align: 'right', render: (p) => money(p.unrealizedPnl || p.unrealisedPnl) },
            { label: 'Realised', align: 'right', render: (p) => money(p.realizedPnl || p.realisedPnl) },
            { label: 'Mode', render: (p) => badge(p.executionMode || 'PAPER', 'info') },
          ],
          items(d),
        ),
    }),
    panel({
      title: 'Capital',
      subtitle: 'Available vs allocated paper capital',
      load: () => api.get('/grow/active-capital'),
      render: (d) => autoKv(d.activeCapital || d, { limit: 14 }),
    }),
    panel({
      title: 'Performance & risk',
      subtitle: 'Recorded observations: drawdown, exposure, costs',
      load: () => api.get('/grow/results'),
      render: (d) => h('div', { class: 'stack' }, autoKv(d.performance || d, { limit: 16 }), d.risk ? autoKv(d.risk) : null),
    }),
    panel({
      title: 'Research & activity',
      subtitle: 'Agent research, proposed order intents and approvals',
      wide: true,
      load: () => api.get('/grow/activity'),
      empty: (d) => items(d).length === 0 && 'No activity recorded yet.',
      render: (d) =>
        table(
          [
            { label: 'When', render: (a) => dateTime(a.occurredAt || a.createdAt) },
            { label: 'Event', render: (a) => humanize(a.kind || a.type || a.event) },
            { label: 'Detail', render: (a) => a.detail || '—' },
            { label: 'State', render: (a) => badge(a.state || a.status || 'RECORDED') },
          ],
          items(d),
        ),
    }),
  );
}
