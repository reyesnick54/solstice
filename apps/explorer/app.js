const app = document.getElementById('app');
const buttons = [...document.querySelectorAll('nav button')];

const pages = {
  home: renderHome,
  blocks: () => renderList('/v1/blocks', ['height', 'blockId', 'proposer', 'transactionCount', 'stateRoot']),
  transactions: () => renderList('/v1/transactions', ['transactionId', 'type', 'actor', 'status', 'height', 'fee']),
  accounts: () => renderList('/v1/accounts', ['address', 'accountClass', 'nonce', 'authorizationPolicy']),
  assets: () => renderList('/v1/assets', ['assetId', 'displayName', 'publicTickerStatus', 'circulating', 'supplyLabel']),
  validators: () => renderList('/v1/validators', ['validatorId', 'status', 'votingPower', 'epoch', 'blocksProposed']),
  governance: () => renderList('/v1/governance', ['proposalId', 'upgradeKind', 'status', 'activationHeight']),
  oracles: () => renderList('/v1/oracles', ['factId', 'factType', 'quality', 'aggregationMethod', 'artifactKind']),
  productive: renderProductive,
  moonrey: () => renderList('/v1/moonrey', ['issuanceId', 'productiveCategory', 'contributionId', 'issuedQuantity', 'formulaVersion']),
  'dual-economy': renderDualEconomy,
  machines: () => renderList('/v1/machines', ['machineId', 'machineType', 'serviceOffer', 'settledQuantity']),
  interop: renderInterop,
};

let current = 'home';

function select(page) {
  current = page;
  for (const button of buttons) {
    button.setAttribute('aria-current', button.dataset.page === page ? 'page' : 'false');
  }
  pages[page]();
}

async function get(path) {
  const response = await fetch(path);
  return response.json();
}

function lagLine(payload) {
  return `<p class="live">indexed_finalized_height=${payload.indexed_finalized_height} chain_finalized_height=${payload.chain_finalized_height} index_lag=${payload.index_lag}</p>`;
}

async function renderHome() {
  const home = await get('/v1/home');
  app.innerHTML = `
    ${lagLine(home)}
    <div class="grid">
      <div class="card"><h3>Latest finalized height</h3><div>${home.latestFinalizedHeight}</div></div>
      <div class="card"><h3>Latest block</h3><div>${home.latestBlock?.blockId ?? '—'}</div></div>
      <div class="card"><h3>Transaction activity</h3><div>${home.transactionActivity}</div></div>
      <div class="card"><h3>Validators</h3><div>${home.validatorCount}</div></div>
      <div class="card"><h3>Protocol version</h3><div>${home.activeProtocolVersion}</div></div>
      <div class="card"><h3>SunRey development/testnet supply</h3><div>${home.sunreyDevelopmentSupply}</div></div>
      <div class="card"><h3>MoonRey development/testnet supply</h3><div>${home.moonreyDevelopmentSupply}</div></div>
      <div class="card"><h3>Productive contributions</h3><div>${home.productiveContributionCount}</div></div>
      <div class="card"><h3>Interop clients</h3><div>${home.interopClientCount}</div></div>
    </div>
    <p>Ticker status remains NOT_ASSIGNED. Development/testnet quantities are not market capitalization.</p>
    <h2>Latest oracle facts</h2>
    <pre>${JSON.stringify(home.latestOracleFacts, null, 2)}</pre>
  `;
}

async function renderList(path, columns) {
  const payload = await get(path);
  const rows = payload.items ?? [];
  app.innerHTML = `
    ${lagLine(payload)}
    <table>
      <thead><tr>${columns.map((col) => `<th>${col}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col])}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>
  `;
}

async function renderProductive() {
  const payload = await get('/v1/productive');
  app.innerHTML = `
    ${lagLine(payload.objects)}
    <h2>Registered productive objects</h2>
    <pre>${JSON.stringify(payload.objects.items, null, 2)}</pre>
    <h2>Verified contributions</h2>
    <pre>${JSON.stringify(payload.contributions.items, null, 2)}</pre>
  `;
}

async function renderDualEconomy() {
  const payload = await get('/v1/dual-economy');
  app.innerHTML = `
    <p><strong>SIMULATION</strong> — development-only dual-economy view. Not a price forecast.</p>
    ${lagLine(payload)}
    <div class="grid">
      <div class="card"><h3>SunRey development supply</h3><div>${payload.sunreySupply}</div></div>
      <div class="card"><h3>MoonRey development supply</h3><div>${payload.moonreySupply}</div></div>
    </div>
    <pre>${JSON.stringify(payload, null, 2)}</pre>
  `;
}

async function renderInterop() {
  const payload = await get('/v1/interop');
  app.innerHTML = `
    <p>Development-only interoperability. External chains are not SunRey economic truth.</p>
    ${lagLine(payload.clients)}
    <h2>Light clients</h2>
    <pre>${JSON.stringify(payload.clients.items, null, 2)}</pre>
    <h2>Packets</h2>
    <pre>${JSON.stringify(payload.packets.items, null, 2)}</pre>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

document.getElementById('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const q = document.getElementById('search').value;
  const payload = await get(`/v1/search?q=${encodeURIComponent(q)}`);
  app.innerHTML = `<h2>Search</h2><pre>${JSON.stringify(payload, null, 2)}</pre>`;
});

for (const button of buttons) {
  button.addEventListener('click', () => select(button.dataset.page));
}

const events = new EventSource('/v1/events');
events.addEventListener('NEW_BLOCK', () => {
  if (current === 'home' || current === 'blocks') {
    pages[current]();
  }
});
events.addEventListener('NEW_TRANSACTION', () => {
  if (current === 'transactions') {
    pages[current]();
  }
});
events.addEventListener('GOVERNANCE', () => {
  if (current === 'governance') {
    pages[current]();
  }
});
events.addEventListener('ORACLE', () => {
  if (current === 'oracles' || current === 'home') {
    pages[current]();
  }
});
events.addEventListener('MOONREY_ISSUANCE', () => {
  if (current === 'moonrey') {
    pages[current]();
  }
});

select('home');
