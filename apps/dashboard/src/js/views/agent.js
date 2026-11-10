// AI Financial Agent: proposals, approvals and transparent explanations.
// The agent proposes; approving sends your decision to the backend, where the
// Compliance Kernel still evaluates it. Nothing executes from the browser.

import { api } from '../api.js';
import { requireStrong } from '../auth.js';
import { dateTime, humanize, money, shortId } from '../format.js';
import { act, badge, dialog, h, note, panel, table, toast } from '../ui.js';
import { autoKv, items, view } from './common.js';

export function agentView() {
  let actionsPanel;

  function review(action) {
    const approve = h('button', { class: 'btn btn-primary' }, 'Approve');
    const reject = h('button', { class: 'btn btn-danger' }, 'Reject');
    const id = encodeURIComponent(action.id || action.actionId);
    const d = dialog({
      title: humanize(action.kind || action.actionType || 'Proposed action'),
      content: h(
        'div',
        { class: 'stack' },
        action.explanation || action.reason ? h('p', null, action.explanation || action.reason) : null,
        autoKv(action, { skip: ['explanation', 'reason'], limit: 18 }),
        note('Approving records your decision. The Compliance Kernel, Risk Engine and Execution Authority still decide whether anything runs.', 'gold'),
        h('div', { class: 'row' }, reject, approve),
      ),
    });
    approve.onclick = () =>
      act(approve, async () => {
        if (!(await requireStrong('Approving an agent action'))) return;
        await api.post(`/agent/actions/${id}/approve`, {});
        d.close();
        toast('Approval recorded.', 'positive');
        actionsPanel.refresh();
      });
    reject.onclick = () =>
      act(reject, async () => {
        await api.post(`/agent/actions/${id}/reject`, { reason: 'CUSTOMER_REJECTED' });
        d.close();
        toast('Rejected.', 'positive');
        actionsPanel.refresh();
      });
  }

  actionsPanel = panel({
    title: 'Proposed actions',
    subtitle: 'Review, approve or reject',
    wide: true,
    load: () => api.get('/agent/actions'),
    empty: (d) => items(d).length === 0 && 'The agent has no proposals for you right now.',
    render: (d) =>
      table(
        [
          { label: 'Action', render: (a) => humanize(a.kind || a.actionType || a.type) },
          { label: 'Why', render: (a) => a.explanation || a.reason || '—' },
          { label: 'Amount', align: 'right', render: (a) => (a.amount ? money(a.amount) : a.compensation || '—') },
          { label: 'State', render: (a) => badge(a.state || a.status) },
          { label: 'Proposed', render: (a) => dateTime(a.createdAt || a.proposedAt) },
          { label: 'Id', render: (a) => h('span', { class: 'mono' }, shortId(a.id || a.actionId, 12)) },
        ],
        items(d),
        { onRow: review },
      ),
  });

  return view(
    actionsPanel,
    panel({
      title: 'Agent status',
      subtitle: 'As reported by the agent runtime',
      load: () => api.get('/agent'),
      render: (a) => autoKv(a, { limit: 12 }),
    }),
    panel({
      title: 'Permissions',
      subtitle: 'What the agent may and may not do for you',
      load: () => api.get('/agent/settings'),
      render: (s) =>
        h(
          'div',
          { class: 'stack' },
          autoKv(s, { limit: 16 }),
          h(
            'div',
            { class: 'row' },
            h(
              'button',
              {
                class: 'btn btn-sm',
                onclick: (e) =>
                  act(e.currentTarget, async () => {
                    await api.post('/agent/pause', {});
                    toast('Agent paused.', 'positive');
                  }),
              },
              'Pause agent',
            ),
            h(
              'button',
              {
                class: 'btn btn-sm btn-danger',
                onclick: (e) =>
                  act(e.currentTarget, async () => {
                    if (!(await requireStrong('Revoking agent permissions'))) return;
                    await api.post('/agent/revoke', {});
                    toast('Agent permissions revoked.', 'positive');
                  }),
              },
              'Revoke permissions',
            ),
          ),
        ),
    }),
    panel({
      title: 'Escalations',
      subtitle: 'Items the agent handed to you or to human review',
      wide: true,
      load: () => api.get('/agent/escalations'),
      empty: (d) => items(d).length === 0 && 'No escalations.',
      render: (d) => table([{ label: 'Item', render: (x) => humanize(x.kind || x.type) }, { label: 'Detail', render: (x) => x.detail || '—' }, { label: 'State', render: (x) => badge(x.state || x.status) }, { label: 'When', render: (x) => dateTime(x.createdAt) }], items(d)),
    }),
  );
}
