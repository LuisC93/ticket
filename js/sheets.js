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

// ── FETCH LECTURA (ping, getAll, getBloques, getMonitoreo) ──
// timeoutMs: cuánto esperamos la respuesta. Por defecto 45s, porque las hojas
// de monitoreo grandes (200+ centros, como la de Jose) tardan más de 8s en
// responder. Con 8s la app cortaba antes de tiempo y mostraba "No se pudo cargar".
async function sheetFetchRead(params, retries, timeoutMs) {
  if (!CFG.url) return null;
  if (retries === undefined) retries = 2;
  if (timeoutMs === undefined) timeoutMs = 45000;
  var q = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  for (var i = 0; i < retries; i++) {
    try {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, timeoutMs);
      var r = await fetch(CFG.url + '?' + q, { signal: controller.signal });
      clearTimeout(timeout);
      return await r.json();
    } catch(e) {
      if (i < retries - 1) await new Promise(function(res) { setTimeout(res, 1000 * (i+1)); });
    }
  }
  return null;
}

// ── FETCH ESCRITURA (append, update, updateEstado, setMonitoreoBatch...) ──
// Usa POST para que el payload vaya en el body (sin límite de tamaño).
// Antes usaba GET con ?payload=..., lo que cortaba arrays largos en el batch.
async function sheetFetchWrite(data) {
  if (!CFG.url) return false;
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 15000);
    var r = await fetch(CFG.url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },  // text/plain evita preflight CORS
      body:    JSON.stringify(data),
      signal:  controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);
    try {
      var text = await r.text();
      if (text && text.indexOf('"status":"ok"') > -1) return true;
      if (text && text.indexOf('"status":"error"') > -1) {
        console.warn('sheetFetchWrite error del servidor:', text.slice(0, 200));
        return false;
      }
      return r.status === 200 || r.status === 302;
    } catch(e) { return true; }
  } catch(e) {
    if (e.name === 'AbortError') console.warn('sheetFetchWrite: timeout');
    else console.warn('sheetFetchWrite: error de red:', e.message);
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
async function loadMonitoreo(monitorApp, fechaISO, forzar) {
  if (!monitorApp) return;
  var sheet = getSheetForMonitor(monitorApp);
  var fechaKey = fechaISO || 'hoy';
  var claveFresca = 'mon_' + sheet + '_' + fechaKey;
  // AHORRO DE CUOTA: si no se fuerza, ya hay datos de este monitor en pantalla,
  // y siguen frescos (<5 min), no volvemos a pedir a Google.
  if (!forzar && _esFresco(claveFresca)
      && monitoreoData && monitoreoData.sheet === sheet
      && monitoreoData.rows && monitoreoData.rows.length) {
    setSyncStatus('ok');
    if (typeof renderMonitoreo === 'function') renderMonitoreo();
    return;
  }
  setSyncStatus('syncing');
  showToast('Cargando centros de ' + monitorApp + '... (puede tardar unos segundos)', 'loading');
  var d = await sheetFetchRead({
    action: 'getMonitoreo',
    sheet:  sheet,
    fecha:  fechaISO || todayISO()
  }, 2, 60000);   // hasta 60s: las hojas grandes (200+ centros) tardan más
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
    _marcarCarga(claveFresca);   // recordar que esta hoja+fecha está fresca
    setSyncStatus('ok');
    if (typeof renderMonitoreo === 'function') renderMonitoreo();
    showToast(d.rows.length + ' centros · ' + (d.dateCol || '') + (d.isToday === false ? ' (último día)' : '') + ' ✓', 'ok');
  } else {
    setSyncStatus('err');
    if (typeof renderMonitoreo === 'function') renderMonitoreo();
    // Si el servidor mandó la lista de pestañas existentes, la mostramos para diagnóstico.
    if (d && d.hojasDisponibles && d.hojasDisponibles.length) {
      console.log('⚠ La pestaña "' + sheet + '" no existe en tu Google Sheet.');
      console.log('📋 Pestañas que SÍ existen:', d.hojasDisponibles.join(', '));
      showToast('No existe la pestaña "' + sheet + '". Revisa la consola (F12) para ver las pestañas reales.', 'err');
    } else {
      showToast('No se pudo cargar la hoja "' + sheet + '" ✗', 'err');
    }
  }
}

// ── ESCRIBIR estado del día de UN centro ──
// Para aguantar carga masiva (20+ monitores trabajando a la vez), no mandamos
// cada cambio al instante. Lo ponemos en la cola y un temporizador de 2s lo manda
// junto con los demás cambios pendientes (debounce + batching automático).
// Así si alguien cambia 5 estados seguidos, van todos en 1 petición.
var _monDebounceTimer = null;
async function setEstadoMonitoreo(cod, estado) {
  if (!monitoreoData) return false;
  var fecha = monitoreoData.dateISO || todayISO();
  // Siempre va a la cola (nunca directo), para poder agrupar con otros cambios.
  monQueue.push({ sheet: monitoreoData.sheet, cod: cod, fecha: fecha, estado: estado, ts: Date.now(), attempts: 0 });
  saveMonQueue();
  // Debounce: espera 2s de "silencio" antes de mandar. Si llega otro cambio en ese
  // tiempo, reinicia el contador. Cuando nadie toca nada en 2s, manda todo junto.
  clearTimeout(_monDebounceTimer);
  _monDebounceTimer = setTimeout(function() { flushMonQueue(); }, 2000);
  return true;   // optimista: el flush se encarga de reintentar si falla
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

  // AGRUPAR: combinar todos los items con el mismo sheet+fecha+estado en un batch.
  // Así si hay 10 cambios pendientes del mismo monitor, van en 1 petición.
  var grupos = {}; // clave: sheet|fecha|estado → {batch:true, cods:[...], indices:[...]}
  for (var i = 0; i < monQueue.length; i++) {
    var it = monQueue[i];
    it.attempts = (it.attempts || 0) + 1;
    if (it.attempts > 3) { sent.push(i); continue; }
    if (it.batch) {
      // Ya es batch: mandarlo directo
      var ok = await sheetFetchWrite({ action: 'setMonitoreoBatch', sheet: it.sheet, cods: it.cods, fecha: it.fecha, estado: it.estado });
      if (ok) sent.push(i);
    } else {
      // Agrupar con otros del mismo sheet+fecha+estado
      var key = it.sheet + '|' + it.fecha + '|' + it.estado;
      if (!grupos[key]) grupos[key] = { sheet: it.sheet, fecha: it.fecha, estado: it.estado, cods: [], indices: [] };
      grupos[key].cods.push(it.cod);
      grupos[key].indices.push(i);
    }
  }

  // Mandar los grupos agrupados
  for (var key in grupos) {
    var g = grupos[key];
    var ok;
    if (g.cods.length === 1) {
      ok = await sheetFetchWrite({ action: 'setMonitoreo', sheet: g.sheet, cod: g.cods[0], fecha: g.fecha, estado: g.estado });
    } else {
      ok = await sheetFetchWrite({ action: 'setMonitoreoBatch', sheet: g.sheet, cods: g.cods, fecha: g.fecha, estado: g.estado });
    }
    if (ok) sent = sent.concat(g.indices);
  }

  if (sent.length) {
    monQueue = monQueue.filter(function(_, i){ return sent.indexOf(i) === -1; });
    saveMonQueue();
    if (monQueue.length === 0) showToast('Monitoreo sincronizado ✓', 'ok');
  }
  _monFlushRunning = false;
}

async function loadFromSheet(forzar) {
  if (!CFG.url) { toggleConfig(); return; }
  // Muestra YA lo último guardado (no espera al servidor) para no dejar la
  // pantalla vacía/pegada si Google tarda o no responde.
  if (typeof renderAll === 'function') renderAll();
  // AHORRO DE CUOTA: si no se fuerza y lo guardado sigue fresco (<5 min),
  // usamos lo local y NO pedimos a Google. El botón Sync llama con forzar=true.
  if (!forzar && _esFresco('tickets') && tickets && tickets.length) {
    setSyncStatus('ok');
    return;
  }
  setSyncStatus('syncing');
  showToast('Sincronizando datos...', 'loading');
  var params = { action: 'getAll', sheet: CFG.sheet || 'SLA' };
  var d = await sheetFetchRead(params);   // tiene su propio timeout/reintentos
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
    _marcarCarga('tickets');   // recordar que los tickets están frescos ahora
    setSyncStatus('ok');
    renderAll();
    var visibles = (typeof getVisibleTickets === 'function') ? getVisibleTickets('monitor').length : d.rows.length;
    showToast(visibles + ' tickets cargados ✓', 'ok');
  } else {
    // El servidor no respondió: conservamos lo local y avisamos, sin quedar pegado.
    setSyncStatus('err');
    if (typeof renderAll === 'function') renderAll();
    showToast('Sin respuesta de Sheets · mostrando últimos datos guardados', 'warn');
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

// ── CONTROL DE FRESCURA (ahorro de peticiones a Google) ──
// Idea: guardamos CUÁNDO se cargó por última vez cada cosa. Si se pide de nuevo
// antes de que pase FRESCURA_MS, usamos lo que ya está guardado y NO molestamos a
// Google. Esto reduce muchísimo las peticiones a Apps Script (su cuota es limitada).
var FRESCURA_MS = 2 * 60 * 1000;   // 2 minutos (varios monitores a la vez)

function _marcarCarga(clave) {
  try { localStorage.setItem('inc_last_' + clave, String(Date.now())); } catch (e) {}
}
function _esFresco(clave) {
  try {
    var t = parseInt(localStorage.getItem('inc_last_' + clave) || '0', 10);
    return t && (Date.now() - t) < FRESCURA_MS;
  } catch (e) { return false; }
}

// ── AUTO-SYNC (espaciado, para no saturar la cuota de Apps Script) ──
function autoSync() {
  if (!CFG.url || !currentUser) return;
  if (document.hidden) return;          // si la pestaña no está visible, no pedir
  if (!_esFresco('tickets')) loadFromSheet();   // tickets, si ya no están frescos
  // Si el panel de monitoreo está abierto y mostrando datos, también lo refrescamos
  // (respeta la frescura interna, así que no pide si aún está fresco).
  try {
    var panel = document.getElementById('panel-monitoreo');
    var visible = panel && panel.classList.contains('active');
    if (visible && monitoreoData && monitoreoData.monitorApp && typeof loadMonitoreo === 'function') {
      loadMonitoreo(monitoreoData.monitorApp, monitoreoData.dateISO);
    }
  } catch (e) {}
}

// Cada 2 minutos: como varios monitores trabajan a la vez, esto asegura ver los
// cambios de otros en máximo ~2 min. La frescura evita peticiones repetidas dentro
// de esa ventana, así que aun con auto-refresco no se satura la cuota.
setInterval(autoSync, 2 * 60 * 1000);

// ── CARGA INICIAL AL INICIAR SESIÓN ──
// Trae TODO de una vez (tickets + monitoreo), en orden para no chocar con el
// límite de "una petición a la vez" de Apps Script. El usuario no toca nada.
var _preloadRunning = false;
async function preloadAtLogin() {
  if (_preloadRunning || !CFG.url || !currentUser) return;
  _preloadRunning = true;
  // 1) Tickets (SLA) — si falla, no debe trabar nada más
  try {
    if (typeof loadFromSheet === 'function') await loadFromSheet();
  } catch (e) { console.warn('preload tickets error:', e); }

  // 2) Monitoreo del propio monitor — en segundo plano, SIN await, para que
  //    aunque la hoja no exista o tarde, NUNCA deje la pantalla en "Sincronizando".
  try {
    if (currentUser.rol === 'Monitor/Técnico' && typeof loadMonitoreo === 'function') {
      loadMonitoreo(currentUser.nombre); // sin await: corre aparte
    }
  } catch (e) { console.warn('preload monitoreo error:', e); }

  // 3) Reintentos pendientes (también en segundo plano)
  try { if (typeof flushQueue === 'function')    flushQueue(); } catch (e) {}
  try { if (typeof flushMonQueue === 'function') flushMonQueue(); } catch (e) {}

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
  t.horaFinal   = nowC.h + ':' + nowC.m + ' ' + nowC.ampm;
  t.fechaCierre = isoFromTicket(new Date().toISOString().slice(0,10)); // fecha de cierre
  t.motivo    = document.getElementById('r-motivo').value;
  t.notas     = document.getElementById('r-notas').value;
  // Técnico que resolvió = usuario actual (automático). Respaldo por si el hidden viene vacío.
  var rtec = document.getElementById('r-tecnico');
  var tecVal = (rtec && rtec.value) ? rtec.value : (currentUser ? currentUser.nombre : '');
  if (tecVal) t.tecnico = tecVal;
  t.estado    = 'Cerrado';
  // ── Calcular duración real ──
  // Usamos fechas completas para que funcione aunque el ticket dure varios días
  // (ej. abierto el viernes, cerrado el lunes).
  if (t.hora && t.horaFinal !== '--:--') {
    try {
      function toMins(ts) {
        var parts = ts.trim().split(' ');
        var hm = parts[0].split(':');
        var h = parseInt(hm[0]), mm = parseInt(hm[1] || 0);
        var ap = parts[1] || '';
        if (ap === 'PM' && h !== 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return h * 60 + mm;
      }
      var fechaAp  = isoFromTicket(t.fecha);                         // "2026-06-06"
      var fechaCi  = isoFromTicket(t.fechaCierre || new Date().toISOString().slice(0,10));
      var msAp     = new Date(fechaAp  + 'T00:00:00').getTime() + toMins(t.hora)      * 60000;
      var msCi     = new Date(fechaCi  + 'T00:00:00').getTime() + toMins(t.horaFinal) * 60000;
      var diffMins = Math.round((msCi - msAp) / 60000);
      if (diffMins > 0) {
        var hh = Math.floor(diffMins / 60);
        var mm2 = diffMins % 60;
        t.duracion = hh + ' h ' + mm2 + ' min';
      }
    } catch (eD) { /* si algo falla, dejamos duracion vacío */ }
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