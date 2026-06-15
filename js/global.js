// global.js — Dashboard Global para Admin sin zona asignada.
// Consulta las 3 zonas en paralelo y muestra tickets, SLA y comparativa.

var _globalData   = {};
var _globalTimer  = null;
var _globalRunning = false;

function initDashboardGlobal() {
  cargarDashboardGlobal(false);
  clearInterval(_globalTimer);
  _globalTimer = setInterval(function() { cargarDashboardGlobal(false); }, 5 * 60 * 1000);
}

async function cargarDashboardGlobal(forzar) {
  if (_globalRunning) return;
  _globalRunning = true;
  var upd = document.getElementById('global-last-update');
  if (upd) upd.textContent = 'Actualizando...';

  var zonas = Object.keys(ZONAS);
  var promesas = zonas.map(function(z) { return _cargarZona(z, forzar); });
  var resultados = await Promise.allSettled(promesas);
  resultados.forEach(function(r, i) {
    if (r.status === 'fulfilled') _globalData[zonas[i]] = r.value;
  });

  _renderDashboard();
  _globalRunning = false;
  var ahora = new Date();
  if (upd) upd.textContent = 'Última actualización: ' +
    ahora.getHours() + ':' + String(ahora.getMinutes()).padStart(2,'0');
}

async function _cargarZona(zona, forzar) {
  var url = ZONAS[zona] && ZONAS[zona].url;
  if (!url || url.indexOf('PENDIENTE') > -1) {
    return { zona: zona, tickets: [], error: 'URL no configurada' };
  }
  var cacheKey = 'global_' + zona;
  if (!forzar) {
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.data;
    } catch(e) {}
  }
  try {
    var ctrl = new AbortController();
    var to = setTimeout(function(){ ctrl.abort(); }, 30000);
    var r = await fetch(url + '?action=getAll&sheet=SLA', { signal: ctrl.signal });
    clearTimeout(to);
    var d = await r.json();
    var rows = (d.status === 'ok' && Array.isArray(d.rows)) ? d.rows : [];
    // Convertir filas a objetos ticket
    var tickets = rows.map(function(row) {
      return {
        fecha: row[0], hora: row[1], monitor: row[2], cod: row[3],
        bloque: row[4], tipo: row[5], desc: row[6], problema: row[7],
        motivo: row[8], tecnico: row[9], horaFinal: row[10],
        duracion: row[11], ticketExt: row[12], estado: row[13]
      };
    });
    var data = { zona: zona, tickets: tickets, error: null };
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
    return data;
  } catch(e) {
    return { zona: zona, tickets: [], error: e.name === 'AbortError' ? 'Timeout' : e.message };
  }
}

function _renderDashboard() {
  _renderTarjetas();
  _renderGraficas();
}

function _renderTarjetas() {
  var cont = document.getElementById('global-cards');
  if (!cont) return;
  var colorZona = { central: '#2563eb', oriental: '#16a34a', occidental: '#d97706' };
  cont.innerHTML = Object.keys(ZONAS).map(function(z) {
    var d = _globalData[z] || {};
    var tickets = d.tickets || [];
    var hoyISO = todayISO();
    var activos  = tickets.filter(function(t){ return t.estado === 'Abierto'; }).length;
    var cerradosHoy = tickets.filter(function(t){
      return t.estado === 'Cerrado' && isoFromTicket(t.fecha) === hoyISO;
    }).length;
    var sla = _calcSLA(tickets);
    var color = colorZona[z] || '#64748b';
    return '<div style="background:var(--white);border:1.5px solid var(--border);border-radius:14px;padding:20px;border-top:4px solid ' + color + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text)">' + ZONAS[z].nombre + '</div>' +
        (d.error ? '<span style="font-size:11px;color:#dc2626;background:#fef2f2;padding:2px 8px;border-radius:20px">' + d.error + '</span>' : '<span style="font-size:11px;color:#16a34a;background:#f0fdf4;padding:2px 8px;border-radius:20px">Conectado</span>') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">' +
        '<div style="text-align:center;background:#fef2f2;border-radius:10px;padding:14px">' +
          '<div style="font-size:28px;font-weight:800;color:#dc2626">' + activos + '</div>' +
          '<div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:2px">Activos</div>' +
        '</div>' +
        '<div style="text-align:center;background:#f0fdf4;border-radius:10px;padding:14px">' +
          '<div style="font-size:28px;font-weight:800;color:#16a34a">' + cerradosHoy + '</div>' +
          '<div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:2px">Cerrados hoy</div>' +
        '</div>' +
      '</div>' +
      '<div style="background:#f8fafc;border-radius:10px;padding:12px">' +
        '<div style="font-size:10px;font-weight:600;color:var(--text3);margin-bottom:4px">SLA PROMEDIO</div>' +
        '<div style="font-size:20px;font-weight:800;color:' + color + '">' + sla.promedio + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + sla.total + ' tickets resueltos · Máx: ' + sla.maximo + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _renderGraficas() {
  var colorZona = { central: '#2563eb', oriental: '#16a34a', occidental: '#d97706' };
  var hoyISO = todayISO();

  // Activos
  _renderBarras('chart-activos', function(z) {
    var t = (_globalData[z] || {}).tickets || [];
    return t.filter(function(x){ return x.estado === 'Abierto'; }).length;
  }, colorZona);

  // Cerrados hoy
  _renderBarras('chart-cerrados', function(z) {
    var t = (_globalData[z] || {}).tickets || [];
    return t.filter(function(x){ return x.estado === 'Cerrado' && isoFromTicket(x.fecha) === hoyISO; }).length;
  }, colorZona);

  // SLA
  var el = document.getElementById('chart-sla');
  if (el) {
    el.innerHTML = Object.keys(ZONAS).map(function(z) {
      var t = (_globalData[z] || {}).tickets || [];
      var sla = _calcSLA(t);
      var color = colorZona[z] || '#64748b';
      return '<div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;padding:14px;text-align:center">' +
        '<div style="font-size:11px;font-weight:700;color:' + color + ';margin-bottom:6px">' + ZONAS[z].nombre.toUpperCase() + '</div>' +
        '<div style="font-size:22px;font-weight:800;color:var(--text)">' + sla.promedio + '</div>' +
        '<div style="font-size:10px;color:var(--text3);margin-top:4px">' + sla.total + ' resueltos</div>' +
      '</div>';
    }).join('');
  }
}

function _renderBarras(id, valFn, colorZona) {
  var el = document.getElementById(id);
  if (!el) return;
  var zonas = Object.keys(ZONAS);
  var valores = zonas.map(valFn);
  var max = Math.max.apply(null, valores) || 1;
  el.innerHTML = zonas.map(function(z, i) {
    var pct = Math.round((valores[i] / max) * 100);
    var color = colorZona[z] || '#64748b';
    return '<div style="margin-bottom:10px">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
        '<span style="font-size:12px;font-weight:600;color:var(--text)">' + ZONAS[z].nombre + '</span>' +
        '<span style="font-size:13px;font-weight:800;color:' + color + '">' + valores[i] + '</span>' +
      '</div>' +
      '<div style="background:#f1f5f9;border-radius:4px;height:10px;overflow:hidden">' +
        '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width .5s ease"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _calcSLA(tickets) {
  var duraciones = [];
  tickets.forEach(function(t) {
    var dur = String(t.duracion || '');
    if (!dur) return;
    var m = dur.match(/(\d+)\s*h\s*(\d+)/);
    if (m) duraciones.push(parseInt(m[1]) * 60 + parseInt(m[2]));
  });
  if (!duraciones.length) return { promedio: '—', maximo: '—', total: 0 };
  var prom = Math.round(duraciones.reduce(function(a,b){return a+b;},0) / duraciones.length);
  var max  = Math.max.apply(null, duraciones);
  function fmt(mins) {
    if (mins < 60) return mins + ' min';
    return Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
  }
  return { promedio: fmt(prom), maximo: fmt(max), total: duraciones.length };
}