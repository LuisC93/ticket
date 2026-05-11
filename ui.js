// ══════════════════════════════════════════
//  ui.js — Render, métricas, drawer, alerts
// ══════════════════════════════════════════

// ── SYNC STATUS ──
function setSyncStatus(state) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  dot.className = 'dot';
  if (state === 'ok')      { dot.classList.add('ok');      lbl.textContent = 'Conectado'; }
  else if (state === 'err'){ dot.classList.add('err');     lbl.textContent = 'Sin conexión'; }
  else if (state === 'syncing'){ dot.classList.add('syncing'); lbl.textContent = 'Sincronizando...'; }
  else                     { lbl.textContent = 'Sin configurar'; }
}

// ── ALERTS ──
function showFormAlert(showId, hideId, msg) {
  const show = document.getElementById(showId);
  const hide = document.getElementById(hideId);
  if (show) {
    show.classList.add('show');
    // update message text inside span if it exists
    const span = show.querySelector('span');
    if (span && msg) span.textContent = msg;
  }
  if (hide) hide.classList.remove('show');
  setTimeout(() => { if (show) show.classList.remove('show'); }, 4500);
}

// ── METRICS ──
function updateMetrics() {
  const today = todayISO();
  document.getElementById('m-hoy').textContent    = tickets.filter(t => t.fecha === today).length;
  document.getElementById('m-total').textContent  = tickets.length;
  document.getElementById('m-open').textContent   = tickets.filter(t => t.estado === 'Abierto').length;
  document.getElementById('m-closed').textContent = tickets.filter(t => t.estado === 'Cerrado').length;
  document.getElementById('t-total').textContent  = tickets.length;
  document.getElementById('t-pend').textContent   = tickets.filter(t => t.estado === 'Abierto').length;
  document.getElementById('t-res').textContent    = tickets.filter(t => t.estado === 'Cerrado' && t.fecha === today).length;
}

// ── RENDER MONITOR TABLE ──
function renderMonitor() {
  const tbody = document.getElementById('tbl-monitor');
  if (!tickets.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No hay incidencias registradas aún</td></tr>';
    return;
  }
  tbody.innerHTML = tickets.map(t => `
    <tr>
      <td class="ticket-id">#${t.id}</td>
      <td>${t.fecha}</td>
      <td>${t.hora}</td>
      <td>${t.monitor}</td>
      <td>${t.bloque}</td>
      <td><span class="badge ${t.tipoInc === 'Incidencia Interna' ? 'badge-int' : 'badge-ext'}">${t.tipoInc === 'Incidencia Interna' ? 'INT' : 'EXT'}</span></td>
      <td>${t.tipo}</td>
      <td>${t.tecnico}</td>
      <td><span class="badge ${t.estado === 'Abierto' ? 'badge-open' : 'badge-closed'}">${t.estado}</span></td>
    </tr>
  `).join('');
}

// ── RENDER TÉCNICO TABLE ──
function renderTecnico() {
  const q    = (document.getElementById('search-tec').value || '').toLowerCase();
  const list = tickets.filter(t => {
    const matchF = activeFilter === 'all' || t.estado === activeFilter;
    const matchQ = !q || [t.tipo, t.monitor, String(t.id), t.tecnico, t.bloque]
                           .some(v => v.toLowerCase().includes(q));
    return matchF && matchQ;
  });

  const tbody = document.getElementById('tbl-tecnico');
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No hay tickets que coincidan</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(t => {
    const idx = tickets.indexOf(t);
    return `<tr>
      <td class="ticket-id">#${t.id}</td>
      <td>${t.fecha}</td>
      <td>${t.hora}</td>
      <td>${t.monitor}</td>
      <td>${t.bloque}</td>
      <td>${t.tipo}</td>
      <td>${t.tecnico}</td>
      <td><span class="badge ${t.estado === 'Abierto' ? 'badge-open' : 'badge-closed'}">${t.estado}</span></td>
      <td><button class="btn btn-sm" onclick="openDrawer(${idx})">${t.estado === 'Abierto' ? 'Resolver' : 'Ver'}</button></td>
    </tr>`;
  }).join('');
}

// ── DRAWER ──
function openDrawer(idx) {
  activeTicketIdx = idx;
  const t = tickets[idx];

  document.getElementById('d-id').textContent       = '#' + t.id;
  document.getElementById('d-monitor').textContent  = t.monitor;
  document.getElementById('d-fecha').textContent    = `${t.fecha}  ${t.hora}`;
  document.getElementById('d-bloque').textContent   = t.bloque;
  document.getElementById('d-cod').textContent      = t.cod;
  document.getElementById('d-tipo-inc').textContent = t.tipoInc;
  document.getElementById('d-estado').textContent   = t.estado;
  document.getElementById('d-tipo').textContent     = t.tipo;
  document.getElementById('d-desc').textContent     = t.desc;

  // Reset alerts
  document.getElementById('d-alert-ok').classList.remove('show');
  document.getElementById('d-alert-err').classList.remove('show');

  // Pre-fill motivo if set
  if (t.motivo && t.motivo !== '—') {
    document.getElementById('r-motivo').value = t.motivo;
  }

  const resolveSection = document.getElementById('resolve-section');
  const closedMsg      = document.getElementById('closed-msg');

  if (t.estado === 'Cerrado') {
    resolveSection.style.display = 'none';
    closedMsg.style.display      = 'block';
  } else {
    resolveSection.style.display = 'block';
    closedMsg.style.display      = 'none';
  }

  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  activeTicketIdx = null;
}

// ── FILTERS ──
function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTecnico();
}

// ── TABS ──
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + tabName).classList.add('active');
}

// ── RENDER ALL ──
function renderAll() {
  updateMetrics();
  renderMonitor();
  renderTecnico();
}
