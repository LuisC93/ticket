// sheets.js — v7 assume success on redirect

var pendingQueue = JSON.parse(localStorage.getItem('inc_queue') || '[]');
function saveQueue() { localStorage.setItem('inc_queue', JSON.stringify(pendingQueue)); }

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

// ── FETCH LECTURA (ping, getAll, getBloques) ──
async function sheetFetchRead(params, retries) {
  if (!CFG.url) return null;
  if (retries === undefined) retries = 3;
  var q = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  for (var i = 0; i < retries; i++) {
    try {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 15000);
      var r = await fetch(CFG.url + '?' + q, { signal: controller.signal });
      clearTimeout(timeout);
      return await r.json();
    } catch(e) {
      if (i < retries - 1) await new Promise(function(res) { setTimeout(res, 1000 * (i+1)); });
    }
  }
  return null;
}

// ── FETCH ESCRITURA (append, update, updateEstado) ──
// Google redirige las escrituras y el browser no puede leer la respuesta (CORS)
// pero el script SÍ se ejecuta en el servidor. Asumimos éxito si HTTP es 200 o 302.
async function sheetFetchWrite(data) {
  if (!CFG.url) return false;
  var payload = encodeURIComponent(JSON.stringify(data));
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 15000);
    var r = await fetch(CFG.url + '?payload=' + payload, {
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);
    // Si llega aquí sin excepción, el servidor recibió la petición
    // No importa si no podemos leer el JSON — el script ya se ejecutó
    try {
      var text = await r.text();
      if (text && text.indexOf('"status":"ok"') > -1) return true;
      if (text && text.indexOf('"status":"error"') > -1) {
        console.warn('sheetFetchWrite error del servidor:', text.slice(0, 200));
        return false;
      }
      // HTML de redirect = ejecutado pero no podemos leer respuesta = asumir ok
      return true;
    } catch(e) {
      return true; // no podemos leer pero se ejecutó
    }
  } catch(e) {
    // Solo falla si hay error de red real
    if (e.name === 'AbortError') {
      console.warn('sheetFetchWrite: timeout');
    } else {
      console.warn('sheetFetchWrite: error de red:', e.message);
    }
    return false;
  }
}

async function sheetFetch(params, retries) {
  return sheetFetchRead(params, retries);
}

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

async function appendToSheet(t) {
  if (!CFG.url) return false;
  setSyncStatus('syncing');
  showToast('Guardando en Sheets...', 'loading');
  var row = [
    isoFromTicket(t.fecha), t.hora, t.monitor, t.cod, t.bloque,
    t.tipoInc, t.desc, t.tipo, t.motivo, t.tecnico,
    t.horaFinal, t.duracion, t.ticketExt, t.estado
  ];
  var ok = await sheetFetchWrite({ action: 'append', sheet: CFG.sheet || 'SLA', row: row });
  if (ok) {
    setSyncStatus('ok');
    showToast('Guardado en Google Sheets ✓', 'ok');
    updateEstadoMonitor(t, false);
  } else {
    setSyncStatus('err');
    pendingQueue.push({ type: 'append', ticket: t, ts: Date.now() });
    saveQueue();
    showToast('Sin conexión · Guardado localmente', 'warn');
  }
  return ok;
}

async function updateRowInSheet(t) {
  if (!CFG.url) return false;
  setSyncStatus('syncing');
  showToast('Actualizando ticket...', 'loading');
  var ok = await sheetFetchWrite({
    action:    'update',
    sheet:     CFG.sheet || 'SLA',
    ticketId:  t.cod,
    fecha:     isoFromTicket(t.fecha),   // afina la fila correcta (el cod se repite)
    hora:      t.hora || '',
    tecnico:   t.tecnico   || '',
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
  } else {
    setSyncStatus('err');
    pendingQueue.push({ type: 'update', ticket: t, ts: Date.now() });
    saveQueue();
    showToast('Sin conexión · Cambio pendiente', 'warn');
  }
  return ok;
}

// ── REASIGNAR MONITOR (un ticket) ──
// Identifica la fila por fecha + hora + cod (más preciso que solo el código,
// que puede repetirse) y cambia la columna "monitor".
async function reassignInSheet(t) {
  if (!CFG.url) return false;
  return await sheetFetchWrite({
    action:   'reassign',
    sheet:    CFG.sheet || 'SLA',
    ticketId: t.cod,
    fecha:    isoFromTicket(t.fecha),
    hora:     t.hora || '',
    monitor:  t.monitor || ''
  });
}

// ════════════════════════════════════════════════
//  MONITOREO RUTINARIO
// ════════════════════════════════════════════════

// Cola offline específica de monitoreo
var monQueue = JSON.parse(localStorage.getItem('inc_mon_queue') || '[]');
function saveMonQueue() { localStorage.setItem('inc_mon_queue', JSON.stringify(monQueue)); }

// ── CARGAR centros + estado de hoy de un monitor ──
async function loadMonitoreo(monitorApp, fechaISO) {
  if (!monitorApp) return;
  var sheet = getSheetForMonitor(monitorApp);
  setSyncStatus('syncing');
  showToast('Cargando centros de ' + monitorApp + '...', 'loading');
  var d = await sheetFetchRead({
    action: 'getMonitoreo',
    sheet:  sheet,
    fecha:  fechaISO || todayISO()
  });
  if (d && d.status === 'ok' && Array.isArray(d.rows)) {
    monitoreoData = {
      monitorApp:     monitorApp,
      sheet:          sheet,
      dateCol:        d.dateCol || '',
      dateISO:        d.dateISO || todayISO(),
      isToday:        d.isToday !== false,
      availableDates: d.availableDates || [],
      rows:           d.rows,
      ts:             Date.now()
    };
    saveMonitoreoLocal();
    setSyncStatus('ok');
    if (typeof renderMonitoreo === 'function') renderMonitoreo();
    showToast(d.rows.length + ' centros · ' + (d.dateCol || '') + (d.isToday === false ? ' (último día)' : '') + ' ✓', 'ok');
  } else {
    setSyncStatus('err');
    if (typeof renderMonitoreo === 'function') renderMonitoreo();
    showToast('No se pudo cargar la hoja "' + sheet + '" ✗', 'err');
  }
}

// ── ESCRIBIR estado del día de UN centro ──
async function setEstadoMonitoreo(cod, estado) {
  if (!monitoreoData) return false;
  var fecha = monitoreoData.dateISO || todayISO();
  var ok = false;
  if (CFG.url) {
    ok = await sheetFetchWrite({
      action: 'setMonitoreo',
      sheet:  monitoreoData.sheet,
      cod:    cod,
      fecha:  fecha,
      estado: estado
    });
  }
  if (!ok) {
    monQueue.push({ sheet: monitoreoData.sheet, cod: cod, fecha: fecha, estado: estado, ts: Date.now(), attempts: 0 });
    saveMonQueue();
  }
  return ok;
}

// ── ESCRIBIR estado del día de VARIOS centros en UNA sola petición ──
// Mucho más rápido: 1 request escribe toda la columna en el servidor.
async function setEstadoMonitoreoBatch(cods, estado) {
  if (!monitoreoData || !cods || !cods.length) return false;
  var fecha = monitoreoData.dateISO || todayISO();
  var ok = false;
  if (CFG.url) {
    ok = await sheetFetchWrite({
      action: 'setMonitoreoBatch',
      sheet:  monitoreoData.sheet,
      cods:   cods,
      fecha:  fecha,
      estado: estado
    });
  }
  if (!ok) {
    monQueue.push({ batch: true, sheet: monitoreoData.sheet, cods: cods, fecha: fecha, estado: estado, ts: Date.now(), attempts: 0 });
    saveMonQueue();
  }
  return ok;
}

// ── FLUSH de la cola de monitoreo ──
var _monFlushRunning = false;
async function flushMonQueue() {
  if (_monFlushRunning || !monQueue.length || !CFG.url) return;
  _monFlushRunning = true;
  var sent = [];
  for (var i = 0; i < monQueue.length; i++) {
    var it = monQueue[i];
    it.attempts = (it.attempts || 0) + 1;
    if (it.attempts > 3) { sent.push(i); continue; }
    var ok;
    if (it.batch) {
      ok = await sheetFetchWrite({ action: 'setMonitoreoBatch', sheet: it.sheet, cods: it.cods, fecha: it.fecha, estado: it.estado });
    } else {
      ok = await sheetFetchWrite({ action: 'setMonitoreo', sheet: it.sheet, cod: it.cod, fecha: it.fecha, estado: it.estado });
    }
    if (ok) sent.push(i);
  }
  if (sent.length) {
    monQueue = monQueue.filter(function(_, i){ return sent.indexOf(i) === -1; });
    saveMonQueue();
    if (monQueue.length === 0) showToast('Monitoreo sincronizado ✓', 'ok');
  }
  _monFlushRunning = false;
}

async function loadFromSheet() {
  if (!CFG.url) { toggleConfig(); return; }
  setSyncStatus('syncing');
  showToast('Sincronizando datos...', 'loading');
  var params = { action: 'getAll', sheet: CFG.sheet || 'SLA' };
  // Monitor/Técnico solo descarga sus propias filas. Técnico y Admin descargan todo.
  if (currentUser && currentUser.rol === 'Monitor/Técnico') {
    params.monitor = currentUser.nombre;
  }
  var d = await sheetFetchRead(params);
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
var _flushRunning = false;
async function flushQueue() {
  if (_flushRunning || !pendingQueue.length || !CFG.url) return;
  _flushRunning = true;
  var sent = [];
  for (var i = 0; i < pendingQueue.length; i++) {
    var item = pendingQueue[i];
    // Si el item lleva más de 3 intentos, descartarlo
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts > 3) { sent.push(i); continue; }
    var ok = false;
    if (item.type === 'append') {
      var row = [
        isoFromTicket(item.ticket.fecha), item.ticket.hora, item.ticket.monitor,
        item.ticket.cod, item.ticket.bloque, item.ticket.tipoInc, item.ticket.desc,
        item.ticket.tipo, item.ticket.motivo, item.ticket.tecnico,
        item.ticket.horaFinal, item.ticket.duracion, item.ticket.ticketExt, item.ticket.estado
      ];
      ok = await sheetFetchWrite({ action: 'append', sheet: CFG.sheet || 'SLA', row: row });
    } else if (item.type === 'update') {
      var t = item.ticket;
      ok = await sheetFetchWrite({
        action: 'update', sheet: CFG.sheet || 'SLA',
        ticketId: t.cod, fecha: isoFromTicket(t.fecha), hora: t.hora || '',
        tecnico: t.tecnico || '', horaFinal: t.horaFinal,
        duracion: t.duracion, motivo: t.motivo,
        notas: t.notas || '', estado: t.estado
      });
    } else if (item.type === 'reassign') {
      var tr = item.ticket;
      ok = await sheetFetchWrite({
        action: 'reassign', sheet: CFG.sheet || 'SLA',
        ticketId: tr.cod, fecha: isoFromTicket(tr.fecha),
        hora: tr.hora || '', monitor: tr.monitor || ''
      });
    }
    if (ok) sent.push(i);
  }
  if (sent.length) {
    pendingQueue = pendingQueue.filter(function(_, i) { return sent.indexOf(i) === -1; });
    saveQueue();
    if (pendingQueue.length === 0) showToast('Cambios sincronizados ✓', 'ok');
  }
  _flushRunning = false;
}

window.addEventListener('online', function() {
  showToast('Conexión restaurada · Sincronizando...', 'warn');
  setTimeout(flushQueue, 1500);
  setTimeout(flushMonQueue, 2000);
});
window.addEventListener('offline', function() {
  setSyncStatus('err');
  showToast('Sin conexión a internet', 'err');
});

// ── AUTO-SYNC cada 1 minuto ──
function autoSync() {
  if (!CFG.url || !currentUser) return;
  if (document.hidden) return;
  loadFromSheet();
}

// Cada 1 minuto
setInterval(autoSync, 60 * 1000);

// ── CARGA INICIAL AL INICIAR SESIÓN ──
// Trae TODO de una vez (tickets + monitoreo), en orden para no chocar con el
// límite de "una petición a la vez" de Apps Script. El usuario no toca nada.
var _preloadRunning = false;
async function preloadAtLogin() {
  if (_preloadRunning || !CFG.url || !currentUser) return;
  _preloadRunning = true;
  try {
    // 1) Tickets (SLA)
    if (typeof loadFromSheet === 'function') await loadFromSheet();
    // 2) Monitoreo del propio monitor (dispara también el arrastre del día)
    if (currentUser.rol === 'Monitor/Técnico' && typeof loadMonitoreo === 'function') {
      await loadMonitoreo(currentUser.nombre);
    }
    // 3) Reintenta cualquier cambio que quedó pendiente sin conexión
    if (typeof flushQueue === 'function')    flushQueue();
    if (typeof flushMonQueue === 'function') flushMonQueue();
  } catch (e) {
    console.warn('preloadAtLogin error:', e);
  }
  _preloadRunning = false;
}

async function crearTicket() {
  // El monitor es SIEMPRE el dueño de la cuenta (no se elige). Admin/Técnico usan el del día.
  var mon = (currentUser && currentUser.rol === 'Monitor/Técnico')
    ? currentUser.nombre
    : (document.getElementById('f-monitor').value || getMonitorDia());
  var tipo = document.getElementById('f-tipo').value;
  if (!mon)  { showToast('No se pudo determinar el monitor.', 'err'); return; }
  if (!tipo) { showToast('Selecciona el Problema.', 'err'); return; }
  var codVal = document.getElementById('f-cod').value;
  if (!codVal || codVal.length !== 5) { showToast('El código debe tener exactamente 5 dígitos.', 'err'); return; }
  var now = svNow();
  var t = {
    fecha:     fmtFechaDisplay(document.getElementById('f-fecha').value || todayISO()),
    hora:      now.h + ':' + now.m + ' ' + now.ampm,
    monitor:   mon, cod: codVal,
    bloque:    document.getElementById('f-bloque').value    || '—',
    tipoInc:   document.getElementById('f-tipo-inc').value,
    desc:      document.getElementById('f-desc').value      || '—',
    tipo:      tipo,
    motivo:    '—',                 // el motivo se define al resolver
    tecnico:   'Sin asignar',       // el técnico se asigna al resolver
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

async function cerrarTicket() {
  if (activeIdx === null) return;
  var t = tickets[activeIdx];
  if (t.estado === 'Cerrado') return;
  var nowC = svNow();
  t.horaFinal = nowC.h + ':' + nowC.m + ' ' + nowC.ampm;
  t.motivo    = document.getElementById('r-motivo').value;
  t.notas     = document.getElementById('r-notas').value;
  // Técnico asignado al cerrar (si se eligió uno, reemplaza al anterior)
  var rtec = document.getElementById('r-tecnico');
  if (rtec && rtec.value) t.tecnico = rtec.value;
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

function limpiarForm() {
  ['f-cod','f-bloque','f-tipo-inc','f-tipo','f-desc','f-ticket-ext']
    .forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var fd = document.getElementById('f-fecha'); if (fd) fd.value = todayISO();
  // Reestablece el monitor: si es Monitor/Técnico, su propio nombre; si no, el del día
  var fm = document.getElementById('f-monitor');
  if (fm) fm.value = (currentUser && currentUser.rol === 'Monitor/Técnico') ? currentUser.nombre : getMonitorDia();
  var now = svNow();
  var hEl = document.getElementById('f-hora-h'); if (hEl) hEl.value = now.h;
  var mEl = document.getElementById('f-hora-m'); if (mEl) mEl.value = now.m;
  var pEl = document.getElementById('f-hora-ampm'); if (pEl) pEl.value = now.ampm;
}

async function updateEstadoMonitor(t, cerrar) {
  if (!CFG.url || !t.cod || !t.monitor) return;
  try {
    await sheetFetchWrite({
      action:   'updateEstado',
      cod:      t.cod,
      monitor:  t.monitor,
      problema: t.tipo || '',        // ← el "Problema" del ticket (lo que se mapea)
      tipoInc:  t.tipoInc || '',     // se manda también por compatibilidad
      fecha:    isoFromTicket(t.fecha),
      cerrar:   cerrar ? 'true' : 'false'
    });
  } catch(e) {
    console.warn('updateEstadoMonitor error:', e);
  }
}