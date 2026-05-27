// sheets.js — v5 no-cors fire-and-forget

// ── COLA OFFLINE ──
var pendingQueue = JSON.parse(localStorage.getItem('inc_queue') || '[]');
function saveQueue() { localStorage.setItem('inc_queue', JSON.stringify(pendingQueue)); }

// ── TOAST ──
(function injectToast() {
  if (document.getElementById('sync-toast')) return;
  var t = document.createElement('div');
  t.id = 'sync-toast';
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;background:#1e293b;color:#fff;padding:12px 18px;border-radius:12px;font-family:Inter,sans-serif;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);transform:translateY(80px);opacity:0;transition:all .3s cubic-bezier(.34,1.56,.64,1);max-width:320px;pointer-events:none';
  document.body.appendChild(t);
})();

var _toastTimer = null;
function showToast(msg, type) {
  var el = document.getElementById('sync-toast');
  if (!el) return;
  var icons = {
    loading: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    ok:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    err:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warn:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };
  if (!document.getElementById('spin-style')) {
    var s = document.createElement('style');
    s.id = 'spin-style';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  el.innerHTML = (icons[type] || '') + '<span>' + msg + '</span>';
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';
  clearTimeout(_toastTimer);
  if (type !== 'loading') {
    _toastTimer = setTimeout(function() {
      el.style.transform = 'translateY(80px)';
      el.style.opacity = '0';
    }, type === 'err' ? 5000 : 3000);
  }
}

// ── FETCH CON LECTURA (para getAll/ping/getBloques) ──
async function sheetFetchRead(params, retries) {
  if (!CFG.url) return null;
  if (retries === undefined) retries = 3;
  var q = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(
      typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k]
    );
  }).join('&');
  for (var i = 0; i < retries; i++) {
    try {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 15000);
      var r = await fetch(CFG.url + '?' + q, { signal: controller.signal });
      clearTimeout(timeout);
      var text = await r.text();
      try { return JSON.parse(text); } catch(e) { return null; }
    } catch(e) {
      if (i < retries - 1) await new Promise(function(res) { setTimeout(res, 1000 * (i+1)); });
    }
  }
  return null;
}

// ── FETCH SIN CORS (para append/update/updateEstado) ──
// Usa no-cors: no podemos leer la respuesta pero SÍ se ejecuta en el servidor
async function sheetFetchWrite(params) {
  if (!CFG.url) return false;
  var q = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(
      typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k]
    );
  }).join('&');
  try {
    await fetch(CFG.url + '?' + q, { mode: 'no-cors' });
    return true; // no-cors siempre "ok" si no hay error de red
  } catch(e) {
    console.warn('sheetFetchWrite error:', e);
    return false;
  }
}

// Alias para compatibilidad
async function sheetFetch(params, retries) {
  return sheetFetchRead(params, retries);
}

// ── TEST CONEXION ──
async function testConnection() {
  if (!CFG.url) { alert('Primero guarda la URL.'); return; }
  setSyncStatus('syncing');
  showToast('Probando conexión...', 'loading');
  var d = await sheetFetchRead({ action: 'ping' });
  if (d && d.status === 'ok') {
    setSyncStatus('ok');
    showToast('Conexión exitosa ✓', 'ok');
  } else {
    setSyncStatus('err');
    showToast('Sin respuesta de Sheets ✗', 'err');
  }
}

// ── APPEND ──
async function appendToSheet(t) {
  if (!CFG.url) return false;
  setSyncStatus('syncing');
  showToast('Guardando en Sheets...', 'loading');
  var row = [
    isoFromTicket(t.fecha), t.hora, t.monitor, t.cod, t.bloque,
    t.tipoInc, t.desc, t.tipo, t.motivo, t.tecnico,
    t.horaFinal, t.duracion, t.ticketExt, t.estado
  ];
  var ok = await sheetFetchWrite({
    action: 'append',
    sheet:  CFG.sheet || 'SLA',
    row:    JSON.stringify(row)
  });
  if (ok) {
    setSyncStatus('ok');
    showToast('Guardado en Google Sheets ✓', 'ok');
    updateEstadoMonitor(t, false);
    setTimeout(flushQueue, 2000);
  } else {
    setSyncStatus('err');
    pendingQueue.push({ type: 'append', ticket: t, ts: Date.now() });
    saveQueue();
    showToast('Sin conexión · Guardado localmente', 'warn');
  }
  return ok;
}

// ── UPDATE ──
async function updateRowInSheet(t) {
  if (!CFG.url) return false;
  setSyncStatus('syncing');
  showToast('Actualizando ticket...', 'loading');
  var ok = await sheetFetchWrite({
    action:    'update',
    sheet:     CFG.sheet || 'SLA',
    ticketId:  t.cod,
    horaFinal: t.horaFinal || '',
    duracion:  t.duracion  || '',
    motivo:    t.motivo    || '',
    notas:     t.notas     || '',
    estado:    t.estado    || 'Cerrado'
  });
  if (ok) {
    setSyncStatus('ok');
    showToast('Ticket actualizado en Sheets ✓', 'ok');
    updateEstadoMonitor(t, true);
    setTimeout(flushQueue, 2000);
  } else {
    setSyncStatus('err');
    pendingQueue.push({ type: 'update', ticket: t, ts: Date.now() });
    saveQueue();
    showToast('Sin conexión · Cambio pendiente', 'warn');
  }
  return ok;
}

// ── LOAD FROM SHEET ──
async function loadFromSheet() {
  if (!CFG.url) { toggleConfig(); return; }
  setSyncStatus('syncing');
  showToast('Sincronizando datos...', 'loading');
  var d = await sheetFetchRead({ action: 'getAll', sheet: CFG.sheet || 'SLA' });
  if (d && d.status === 'ok' && Array.isArray(d.rows)) {
    tickets = d.rows.map(function(r) {
      return {
        fecha: fmtFechaDisplay(r[0]), hora: fmtHora(r[1]),
        monitor: r[2], cod: r[3], bloque: r[4], tipoInc: r[5],
        desc: r[6], tipo: r[7], motivo: r[8], tecnico: r[9],
        horaFinal: fmtHora(r[10]), duracion: r[11],
        ticketExt: r[12], estado: r[13] || 'Abierto',
        notas: '', id: r[3] || Date.now()
      };
    });
    saveLocal();
    setSyncStatus('ok');
    renderAll();
    showToast(d.rows.length + ' tickets cargados ✓', 'ok');
  } else {
    setSyncStatus('err');
    showToast('Error al cargar desde Sheets ✗', 'err');
  }
}

// ── COLA OFFLINE: FLUSH ──
async function flushQueue() {
  if (!pendingQueue.length || !CFG.url) return;
  var sent = [];
  for (var i = 0; i < pendingQueue.length; i++) {
    var item = pendingQueue[i];
    var ok = false;
    if (item.type === 'append') {
      var row = [
        isoFromTicket(item.ticket.fecha), item.ticket.hora, item.ticket.monitor,
        item.ticket.cod, item.ticket.bloque, item.ticket.tipoInc, item.ticket.desc,
        item.ticket.tipo, item.ticket.motivo, item.ticket.tecnico,
        item.ticket.horaFinal, item.ticket.duracion, item.ticket.ticketExt, item.ticket.estado
      ];
      ok = await sheetFetchWrite({ action: 'append', sheet: CFG.sheet || 'SLA', row: JSON.stringify(row) });
    } else if (item.type === 'update') {
      var t = item.ticket;
      ok = await sheetFetchWrite({
        action: 'update', sheet: CFG.sheet || 'SLA',
        ticketId: t.cod, horaFinal: t.horaFinal,
        duracion: t.duracion, motivo: t.motivo,
        notas: t.notas, estado: t.estado
      });
    }
    if (ok) sent.push(i);
  }
  if (sent.length) {
    pendingQueue = pendingQueue.filter(function(_, i) { return sent.indexOf(i) === -1; });
    saveQueue();
    showToast(sent.length + ' cambio(s) sincronizado(s) ✓', 'ok');
  }
}

// ── AUTO-RETRY ──
window.addEventListener('online', function() {
  showToast('Conexión restaurada · Sincronizando...', 'warn');
  setTimeout(flushQueue, 1500);
});
window.addEventListener('offline', function() {
  setSyncStatus('err');
  showToast('Sin conexión a internet', 'err');
});

// ── CREAR TICKET ──
async function crearTicket() {
  var mon  = document.getElementById('f-monitor').value;
  var tipo = document.getElementById('f-tipo').value;
  if (!mon || !tipo) { showToast('Completa: Monitor y Problema.', 'err'); return; }
  var codVal = document.getElementById('f-cod').value;
  if (!codVal || codVal.length !== 5) { showToast('El código debe tener exactamente 5 dígitos.', 'err'); return; }
  var now = svNow();
  var hora = now.h + ':' + now.m + ' ' + now.ampm;
  var t = {
    fecha:     fmtFechaDisplay(document.getElementById('f-fecha').value || todayISO()),
    hora:      hora, monitor: mon, cod: codVal,
    bloque:    document.getElementById('f-bloque').value    || '—',
    tipoInc:   document.getElementById('f-tipo-inc').value,
    desc:      document.getElementById('f-desc').value      || '—',
    tipo:      tipo,
    motivo:    document.getElementById('f-motivo').value    || '—',
    tecnico:   document.getElementById('f-tec').value       || 'Sin asignar',
    horaFinal: '', duracion: '',
    ticketExt: document.getElementById('f-ticket-ext').value || '—',
    estado: 'Abierto', notas: '', id: Date.now()
  };
  tickets.unshift(t);
  saveLocal();
  renderAll();
  await appendToSheet(t);
  limpiarForm();
}

// ── CERRAR TICKET ──
async function cerrarTicket() {
  if (activeIdx === null) return;
  var t = tickets[activeIdx];
  if (t.estado === 'Cerrado') return;
  var nowC = svNow();
  t.horaFinal = nowC.h + ':' + nowC.m + ' ' + nowC.ampm;
  t.motivo    = document.getElementById('r-motivo').value;
  t.notas     = document.getElementById('r-notas').value;
  t.estado    = 'Cerrado';
  if (t.hora && t.horaFinal !== '--:--') {
    function toMins(ts) {
      var parts = ts.trim().split(' ');
      var hm = parts[0].split(':');
      var h = parseInt(hm[0]), m = parseInt(hm[1] || 0);
      var ap = parts[1] || '';
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    var m = toMins(t.horaFinal) - toMins(t.hora);
    if (m > 0) t.duracion = Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }
  saveLocal();
  renderAll();
  document.getElementById('resolve-section').style.display = 'none';
  document.getElementById('closed-msg').style.display = 'block';
  setTimeout(closeDrawer, 800);
  updateRowInSheet(t);
}

// ── LIMPIAR FORM ──
function limpiarForm() {
  ['f-monitor','f-cod','f-bloque','f-tipo-inc','f-tipo','f-desc','f-tec','f-motivo','f-ticket-ext']
    .forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var fd = document.getElementById('f-fecha'); if (fd) fd.value = todayISO();
  var now = svNow();
  var hEl = document.getElementById('f-hora-h'); if (hEl) hEl.value = now.h;
  var mEl = document.getElementById('f-hora-m'); if (mEl) mEl.value = now.m;
  var pEl = document.getElementById('f-hora-ampm'); if (pEl) pEl.value = now.ampm;
}

// ── UPDATE ESTADO MONITOR ──
async function updateEstadoMonitor(t, cerrar) {
  if (!CFG.url || !t.cod || !t.monitor) return;
  try {
    await sheetFetchWrite({
      action:  'updateEstado',
      cod:     t.cod,
      monitor: t.monitor,
      tipoInc: t.tipoInc || t.tipo || '',
      fecha:   isoFromTicket(t.fecha),
      cerrar:  cerrar ? 'true' : 'false'
    });
  } catch(e) {
    console.warn('updateEstadoMonitor error:', e);
  }
}