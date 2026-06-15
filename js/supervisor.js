// supervisor.js — Dashboard para Supervisor de zona.
// Ve tickets, monitoreo, SLA y estadísticas por monitor de SU zona.

var _supData   = null;
var _supTimer  = null;
var _supRunning = false;

function initDashboardSupervisor() {
  var titulo = document.getElementById('supervisor-title');
  if (titulo && currentUser && currentUser.zona) {
    titulo.textContent = 'Mi Zona · ' + (ZONAS[currentUser.zona] ? ZONAS[currentUser.zona].nombre : currentUser.zona);
  }
  cargarDashboardSupervisor(false);
  clearInterval(_supTimer);
  _supTimer = setInterval(function() { cargarDashboardSupervisor(false); }, 5 * 60 * 1000);
}

async function cargarDashboardSupervisor(forzar) {
  if (_supRunning || !currentUser) return;
  _supRunning = true;
  var upd = document.getElementById('supervisor-last-update');
  if (upd) upd.textContent = 'Actualizando...';

  var url = currentUser.zona && ZONAS[currentUser.zona] ? ZONAS[currentUser.zona].url : CFG.url;
  if (!url) { _supRunning = false; return; }

  var cacheKey = 'sup_data_' + (currentUser.zona || 'default');
  if (!forzar) {
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) {
        _supData = cached.data;
        _renderSupervisor();
        _supRunning = false;
        if (upd) upd.textContent = 'Última actualización: ' + _fmtHoraAhora();
        return;
      }
    } catch(e) {}
  }

  try {
    var ctrl = new AbortController();
    var to = setTimeout(function(){ ctrl.abort(); }, 30000);
    var r = await fetch(url + '?action=getAll&sheet=SLA', { signal: ctrl.signal });
    clearTimeout(to);
    var d = await r.json();
    var rows = (d.status === 'ok' && Array.isArray(d.rows)) ? d.rows : [];
    var tickets = rows.map(function(row) {
      return {
        fecha: row[0], hora: row[1], monitor: row[2], cod: row[3],
        bloque: row[4], tipo: row[5], desc: row[6], problema: row[7],
        motivo: row[8], tecnico: row[9], horaFinal: row[10],
        duracion: row[11], ticketExt: row[12], estado: row[13]
      };
    });
    _supData = { tickets: tickets, zona: currentUser.zona };
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: _supData })); } catch(e) {}
  } catch(e) {
    if (!_supData) _supData = { tickets: [], zona: currentUser.zona, error: e.message };
  }

  _renderSupervisor();
  _supRunning = false;
  if (upd) upd.textContent = 'Última actualización: ' + _fmtHoraAhora();
}

function _renderSupervisor() {
  if (!_supData) return;
  var tickets = _supData.tickets || [];
  var hoyISO  = todayISO();

  // ── MÉTRICAS PRINCIPALES ──
  var activos     = tickets.filter(function(t){ return t.estado === 'Abierto'; }).length;
  var cerradosHoy = tickets.filter(function(t){ return t.estado === 'Cerrado' && isoFromTicket(t.fecha) === hoyISO; }).length;
  var enProgreso  = tickets.filter(function(t){ return t.estado === 'En Progreso'; }).length;
  var total       = tickets.length;
  var sla         = _calcSLASup(tickets);

  var metricas = document.getElementById('supervisor-metrics');
  if (metricas) {
    metricas.innerHTML = [
      { label:'Activos',       val: activos,     color:'#dc2626', bg:'#fef2f2' },
      { label:'Cerrados hoy',  val: cerradosHoy, color:'#16a34a', bg:'#f0fdf4' },
      { label:'Total',         val: total,        color:'#2563eb', bg:'#eff6ff' },
      { label:'SLA Prom.',     val: sla.promedio, color:'#7c3aed', bg:'#f5f3ff' }
    ].map(function(m) {
      return '<div style="background:' + m.bg + ';border-radius:12px;padding:16px;text-align:center">' +
        '<div style="font-size:26px;font-weight:800;color:' + m.color + '">' + m.val + '</div>' +
        '<div style="font-size:11px;font-weight:600;color:' + m.color + ';margin-top:4px">' + m.label + '</div>' +
      '</div>';
    }).join('');
  }

  // ── ESTADÍSTICAS POR MONITOR ──
  var porMonitor = {};
  tickets.forEach(function(t) {
    var mon = (t.monitor || 'Sin asignar').trim();
    if (!porMonitor[mon]) porMonitor[mon] = { activos: 0, cerrados: 0, total: 0 };
    porMonitor[mon].total++;
    if (t.estado === 'Abierto')  porMonitor[mon].activos++;
    if (t.estado === 'Cerrado')  porMonitor[mon].cerrados++;
  });
  var monitores = Object.keys(porMonitor).sort(function(a,b){
    return porMonitor[b].activos - porMonitor[a].activos; // orden por activos desc
  });
  var maxActivos = Math.max.apply(null, monitores.map(function(m){ return porMonitor[m].activos; })) || 1;
  var elMon = document.getElementById('supervisor-por-monitor');
  if (elMon) {
    if (!monitores.length) {
      elMon.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px">Sin datos</div>';
    } else {
      elMon.innerHTML = monitores.map(function(mon) {
        var d = porMonitor[mon];
        var pct = Math.round((d.activos / maxActivos) * 100);
        var initials = mon.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">' + initials + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">' + mon + '</div>' +
            '<div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">' +
              '<div style="width:' + pct + '%;height:100%;background:#2563eb;border-radius:4px;transition:width .5s"></div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            '<span style="font-size:15px;font-weight:800;color:#dc2626">' + d.activos + '</span>' +
            '<span style="font-size:11px;color:var(--text3);margin-left:6px">/ ' + d.total + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // ── SLA ──
  var elSLA = document.getElementById('supervisor-sla');
  if (elSLA) {
    elSLA.innerHTML =
      '<div style="margin-bottom:12px">' +
        '<div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:2px">PROMEDIO</div>' +
        '<div style="font-size:28px;font-weight:800;color:#7c3aed">' + sla.promedio + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div style="background:#f8fafc;border-radius:8px;padding:10px">' +
          '<div style="font-size:10px;color:var(--text3);font-weight:600">MÍNIMO</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--text)">' + sla.minimo + '</div>' +
        '</div>' +
        '<div style="background:#f8fafc;border-radius:8px;padding:10px">' +
          '<div style="font-size:10px;color:var(--text3);font-weight:600">MÁXIMO</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--text)">' + sla.maximo + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:12px;color:var(--text3)">' + sla.total + ' tickets con tiempo registrado</div>';
  }

  // ── MONITOREO (info básica — centros con estado disponible) ──
  var elMoni = document.getElementById('supervisor-monitoreo');
  if (elMoni) {
    // Usamos los datos de monitoreo local si están disponibles
    if (monitoreoData && monitoreoData.rows && monitoreoData.rows.length) {
      var rows = monitoreoData.rows;
      var ok      = rows.filter(function(r){ return r.estadoHoy === 'Navegación estable'; }).length;
      var problema= rows.filter(function(r){ return r.estadoHoy && r.estadoHoy !== 'Navegación estable'; }).length;
      var sinDato = rows.filter(function(r){ return !r.estadoHoy; }).length;
      var total   = rows.length;
      var pctOk   = total ? Math.round((ok/total)*100) : 0;
      elMoni.innerHTML =
        '<div style="margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
            '<span style="font-size:12px;font-weight:600;color:#16a34a">Estables</span>' +
            '<span style="font-size:13px;font-weight:800;color:#16a34a">' + ok + ' (' + pctOk + '%)</span>' +
          '</div>' +
          '<div style="background:#f1f5f9;border-radius:4px;height:10px;overflow:hidden">' +
            '<div style="width:' + pctOk + '%;height:100%;background:#16a34a;border-radius:4px"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">' +
          '<div style="background:#fef2f2;border-radius:8px;padding:10px;text-align:center">' +
            '<div style="font-size:20px;font-weight:800;color:#dc2626">' + problema + '</div>' +
            '<div style="font-size:10px;color:#dc2626;font-weight:600">Con problema</div>' +
          '</div>' +
          '<div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center">' +
            '<div style="font-size:20px;font-weight:800;color:var(--text3)">' + sinDato + '</div>' +
            '<div style="font-size:10px;color:var(--text3);font-weight:600">Sin dato</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:10px;font-size:11px;color:var(--text3)">' + total + ' centros · <a href="#" onclick="switchTab(\'monitoreo\',document.querySelector(\'.sidebar-item[onclick*=\\\"monitoreo\\\"]\'));return false" style="color:#2563eb">Ver monitoreo →</a></div>';
    } else {
      elMoni.innerHTML =
        '<div style="text-align:center;padding:20px;color:var(--text3)">' +
          '<div style="font-size:13px;margin-bottom:8px">Sin datos de monitoreo</div>' +
          '<button onclick="initMonitoreoPanel();switchTab(\'monitoreo\',document.querySelector(\'.sidebar-item[onclick*=\\\"monitoreo\\\"]\'))" class="btn btn-ghost btn-sm">Cargar monitoreo</button>' +
        '</div>';
    }
  }
}

function _calcSLASup(tickets) {
  var duraciones = [];
  tickets.forEach(function(t) {
    var dur = String(t.duracion || '');
    var m = dur.match(/(\d+)\s*h\s*(\d+)/);
    if (m) duraciones.push(parseInt(m[1]) * 60 + parseInt(m[2]));
  });
  if (!duraciones.length) return { promedio:'—', minimo:'—', maximo:'—', total:0 };
  var sum  = duraciones.reduce(function(a,b){return a+b;},0);
  var prom = Math.round(sum / duraciones.length);
  var min  = Math.min.apply(null, duraciones);
  var max  = Math.max.apply(null, duraciones);
  function fmt(m) {
    if (m < 60) return m + ' min';
    return Math.floor(m/60) + 'h ' + (m%60) + 'm';
  }
  return { promedio: fmt(prom), minimo: fmt(min), maximo: fmt(max), total: duraciones.length };
}

function _fmtHoraAhora() {
  var n = new Date();
  return n.getHours() + ':' + String(n.getMinutes()).padStart(2,'0');
}