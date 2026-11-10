import { api } from '../api.js';
import { dateTime, humanize } from '../format.js';
import { badge, h, note, panel, table } from '../ui.js';
import { autoKv, items, view } from './common.js';

// Access entitlements are distinct from token balances and from fiat funds.
export function accessView() {
  return view(
    panel({
      title: 'Access overview',
      subtitle: 'Entitlements and availability reported by SunRey Access',
      wide: true,
      load: () => api.get('/access/overview'),
      render: (o) =>
        h(
          'div',
          { class: 'stack' },
          note('Access rights are not money and not SR/MR balances. Live provider connectivity is off.'),
          autoKv(o, { limit: 14 }),
        ),
    }),
    panel({
      title: 'Entitlements',
      load: () => api.get('/access/entitlements'),
      empty: (d) => items(d).length === 0 && 'No entitlements yet.',
      render: (d) =>
        table(
          [
            { label: 'Entitlement', render: (e) => e.title || e.name || humanize(e.category || e.kind) },
            { label: 'State', render: (e) => badge(e.state || e.status) },
            { label: 'Valid until', render: (e) => dateTime(e.validUntil || e.expiresAt) },
          ],
          items(d),
        ),
    }),
    panel({
      title: 'Reservations',
      load: () => api.get('/access/reservations'),
      empty: (d) => items(d).length === 0 && 'No reservations.',
      render: (d) =>
        table(
          [
            { label: 'Reservation', render: (r) => r.title || humanize(r.kind || r.category) },
            { label: 'State', render: (r) => badge(r.state || r.status) },
            { label: 'When', render: (r) => dateTime(r.startsAt || r.createdAt) },
          ],
          items(d),
        ),
    }),
    panel({
      title: 'Categories',
      wide: true,
      load: () => api.get('/access/categories'),
      empty: (d) => items(d).length === 0 && 'No categories are published.',
      render: (d) => table([{ label: 'Category', render: (c) => c.title || c.name || humanize(c.categoryId || c.id) }, { label: 'Availability', render: (c) => badge(c.availability || c.state || 'SANDBOX') }], items(d)),
    }),
  );
}
