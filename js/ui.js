// ui.js

function setSyncStatus(s){
  var dot=document.getElementById('sync-dot'),lbl=document.getElementById('sync-label');
  dot.className='sync-dot';
  if(s==='ok'){dot.classList.add('ok');lbl.textContent='Sincronización en tiempo real';}
  else if(s==='err'){dot.classList.add('err');lbl.textContent='Sin conexión';}
  else if(s==='syncing'){dot.classList.add('syncing');lbl.textContent='Sincronizando...';}
  else lbl.textContent='Sin configurar';
}

// ── SHEETS ──

function renderAll(){updateMetrics();renderOpenCards();renderMonitorHist();renderTecnico();}

function updateMetrics(){
  var vis=getVisibleTickets('monitor');
  var visAll=getVisibleTickets('tecnico');
  var today=todayISO();
  var todayTickets=vis.filter(function(t){return isoFromTicket(t.fecha)===today;});
  var open=vis.filter(function(t){return t.estado==='Abierto';});
  var closed=vis.filter(function(t){return t.estado==='Cerrado';});
  document.getElementById('m-hoy').textContent=todayTickets.length;
  document.getElementById('m-open').textContent=open.length;
  document.getElementById('m-closed').textContent=closed.length;
  document.getElementById('m-total').textContent=todayTickets.length;
  document.getElementById('t-total').textContent=visAll.length;
  document.getElementById('t-pend').textContent=visAll.filter(function(t){return t.estado==='Abierto';}).length;
  document.getElementById('t-res').textContent=visAll.filter(function(t){return t.estado==='Cerrado'&&isoFromTicket(t.fecha)===today;}).length;
  document.getElementById('top-open').textContent=open.length;
  document.getElementById('top-closed').textContent=closed.length;
  var sub=todayTickets.length+' tickets · '+open.length+' activos, '+closed.length+' cerrados';
  document.getElementById('monitor-subtitle').textContent='Hoy: '+sub;
  document.getElementById('tg-all').textContent=vis.length;
  document.getElementById('tg-open').textContent=open.length;
  document.getElementById('tg-closed').textContent=closed.length;
}

function renderOpenCards(){
  var el=document.getElementById('open-tickets-list');
  var vis=getVisibleTickets('monitor');
  var list=vis.filter(function(t){return t.estado==='Abierto'&&inRange(t.fecha,dayFilter);});
  if(monFilter==='Cerrado') list=[];
  document.getElementById('open-count').textContent=list.length;
  if(!list.length){
    el.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Sin activos · No hay tickets activos para este periodo.</div>';
    return;
  }
  el.innerHTML=list.map(function(t){
    var idx=tickets.indexOf(t);
    var isInt=t.tipoInc==='Incidencia Interna';
    return '<div class="tc open" onclick="openDrawer('+idx+')">'+
      '<div>'+
        '<div class="tc-top">'+
          '<span class="tc-badge '+(isInt?'int':'ext')+'">'+(isInt?'INT':'EXT')+'</span>'+
          '<span class="tc-monitor">'+t.monitor+'</span>'+
          '<span class="tc-time">'+fmtFechaDisplay(t.fecha)+' · '+fmtHora(t.hora)+'</span>'+
        '</div>'+
        '<div class="tc-problem">'+t.tipo+'</div>'+
        '<div class="tc-desc">'+t.desc+'</div>'+
        '<div class="tc-footer">'+
          '<span class="tc-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+t.tecnico+'</span>'+
          (t.bloque&&t.bloque!=='—'?'<span class="tc-chip">'+t.bloque+'</span>':'')+
          (t.cod&&t.cod!=='—'?'<span class="tc-chip">COD: '+t.cod+'</span>':'')+
        '</div>'+
      '</div>'+
      '<div class="tc-action">'+
        '<div class="status-dot open"></div>'+
        '<div style="display:flex;flex-direction:column;gap:4px">'+
          '<button class="btn-view" onclick="event.stopPropagation();openDrawerReadOnly('+idx+')" style="font-size:12px;padding:5px 12px">Ver</button>'+
          '<button onclick="event.stopPropagation();openEdit('+idx+')" style="padding:5px 10px;border-radius:7px;background:#2563eb;color:#fff;border:none;font-size:11px;font-weight:600;cursor:pointer">✏️ Editar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ── SELECCIÓN MÚLTIPLE (para reasignación masiva) ──
var selectedTickets = new Set();

function buildDayGroups(list, readOnly){
  if(!list.length) return '<div class="empty-state" style="padding:40px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:36px;height:36px;opacity:.3"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>No hay incidencias para mostrar</div>';
  var byDate={};
  list.forEach(function(t){
    var dk=isoFromTicket(t.fecha)||'Sin fecha';
    if(!byDate[dk]) byDate[dk]=[];
    byDate[dk].push(t);
  });
  var dates=Object.keys(byDate).sort(function(a,b){return b.localeCompare(a);});
  var days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var canReassign = currentUser && (currentUser.rol==='Admin' || currentUser.rol==='Técnico' || currentUser.rol==='Monitor/Técnico');
  return dates.map(function(date){
    var rows=byDate[date];
    var ab=rows.filter(function(t){return t.estado==='Abierto';}).length;
    var ce=rows.filter(function(t){return t.estado==='Cerrado';}).length;
    var label=date;
    try{var p=date.split('-');var d2=new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2]));label=days[d2.getDay()]+' '+p[2]+'/'+p[1]+'/'+p[0];}catch(e){}
    var headCols = (canReassign?['<th style="width:34px;text-align:center"><input type="checkbox" class="tk-allcheck" title="Seleccionar todos" onclick="toggleGroupSel(this)"></th>']:[])
      .concat(['Hora','Monitor','COD','Bloque','Problema','Técnico','Estado',''].map(function(h){return '<th>'+h+'</th>';}));
    var ths=headCols.join('');
    var rowsHtml=rows.map(function(t){
      var idx=tickets.indexOf(t);
      var uid=ticketUID(t);
      var checked=selectedTickets.has(uid)?' checked':'';
      var checkCell = canReassign
        ? '<td style="text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="tk-check" data-uid="'+uid+'" onclick="toggleTicketSel(this)"'+checked+'></td>'
        : '';
      return '<tr onclick="openDrawer('+idx+')">'+
        checkCell+
        '<td style="font-family:var(--mono);font-size:12px;color:var(--text3)">'+fmtHora(t.hora)+'</td>'+
        '<td style="font-weight:600">'+t.monitor+'</td>'+
        '<td style="font-family:var(--mono);font-size:12px;color:var(--accent)">'+t.cod+'</td>'+
        '<td>'+t.bloque+'</td><td>'+t.tipo+'</td>'+
        '<td style="color:var(--text2)">'+t.tecnico+'</td>'+
        '<td><span class="badge '+(t.estado==='Abierto'?'badge-open':'badge-closed')+'">'+t.estado+'</span></td>'+
        '<td style="display:flex;gap:4px">'+
        '<button onclick="event.stopPropagation();openEdit('+idx+')" style="padding:4px 10px;border-radius:6px;background:#2563eb;color:#fff;border:none;font-size:11px;font-weight:600;cursor:pointer">✏️</button>'+
        '<button class="btn-view" onclick="event.stopPropagation();'+(readOnly?'openDrawerReadOnly':'openDrawer')+'('+idx+')" style="font-size:11px;padding:4px 10px">Ver</button></td>'+
      '</tr>';
    }).join('');
    return '<div class="day-group">'+
      '<div class="day-group-head">'+
        '<div><span class="day-name">'+label+'</span> <span class="day-count">· '+rows.length+' incidencias</span></div>'+
        '<div class="day-group-chips">'+
          (ab?'<span class="count-chip chip-red">'+ab+' abiertos</span>':'')+
          (ce?'<span class="count-chip chip-green">'+ce+' cerrados</span>':'')+
        '</div>'+
      '</div>'+
      '<div style="overflow-x:auto"><table><thead><tr>'+ths+'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'+
    '</div>';
  }).join('');
}

function renderMonitorHist(){
  var q=(document.getElementById('search-mon').value||'').toLowerCase();
  var selDate=document.getElementById('hist-date').value;
  var vis=getVisibleTickets('monitor');
  var list=vis.filter(function(t){
    var mf=monFilter==='all'||t.estado===monFilter;
    var mq=!q||[t.tipo,t.monitor,t.cod,t.tecnico,t.desc].some(function(v){return String(v).toLowerCase().includes(q);});
    var md=!selDate||(isoFromTicket(t.fecha)===selDate);
    return mf&&mq&&md;
  });
  document.getElementById('all-count').textContent=list.length;
  document.getElementById('historial-body').innerHTML=buildDayGroups(list, true);
}

function renderTecnico(){
  var q=(document.getElementById('search-tec').value||'').toLowerCase();
  var selDate=(document.getElementById('tec-hist-date')||{value:''}).value;
  var vis=getVisibleTickets('tecnico');
  var openList=vis.filter(function(t){return t.estado==='Abierto'&&inRange(t.fecha,tecDayFilter);});
  document.getElementById('tec-open-count').textContent=openList.length;
  var openEl=document.getElementById('tec-open-list');
  if(!openList.length){
    openEl.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>✓ No hay tickets pendientes</div>';
  } else {
    openEl.innerHTML=openList.map(function(t){
      var idx=tickets.indexOf(t);
      var isInt=t.tipoInc==='Incidencia Interna';
      return '<div class="tc open" onclick="openDrawer('+idx+')">'+
        '<div>'+
          '<div class="tc-top"><span class="tc-badge '+(isInt?'int':'ext')+'">'+(isInt?'INT':'EXT')+'</span><span class="tc-monitor">'+t.monitor+'</span><span class="tc-time">'+t.fecha+' · '+t.hora+'</span></div>'+
          '<div class="tc-problem">'+t.tipo+'</div>'+
          '<div class="tc-desc">'+t.desc+'</div>'+
          '<div class="tc-footer"><span class="tc-chip">'+t.tecnico+'</span>'+(t.bloque&&t.bloque!=='—'?'<span class="tc-chip">'+t.bloque+'</span>':'')+(t.cod&&t.cod!=='—'?'<span class="tc-chip">COD: '+t.cod+'</span>':'')+'</div>'+
        '</div>'+
        '<div class="tc-action"><div class="status-dot open"></div><button class="btn-resolve" onclick="event.stopPropagation();openDrawer('+idx+')">Resolver</button></div>'+
      '</div>';
    }).join('');
  }
  var allF=vis.filter(function(t){
    var mf=activeFilter==='all'||t.estado===activeFilter;
    var mq=!q||[t.tipo,t.monitor,t.cod,t.tecnico,t.bloque,t.desc].some(function(v){return String(v).toLowerCase().includes(q);});
    var md=!selDate||(isoFromTicket(t.fecha)===selDate);
    return mf&&mq&&md;
  });
  document.getElementById('tec-hist-count').textContent=allF.length;
  document.getElementById('tec-historial-body').innerHTML=buildDayGroups(allF, false);
}

// ── FILTERS ──
function setTicketMonitorFilter(val){
  ticketMonitorFilter = val || '';
  var a = document.getElementById('ticket-mon-filter'); if (a) a.value = ticketMonitorFilter;
  var b = document.getElementById('tec-mon-filter');    if (b) b.value = ticketMonitorFilter;
  renderAll();
}
function setDayFilter(f,btn){dayFilter=f;document.querySelectorAll('#day-filters .fpill').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');renderOpenCards();}
function setTecDayFilter(f,btn){tecDayFilter=f;document.querySelectorAll('#tec-day-filters .fpill').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');renderTecnico();}
function setFilter(f,btn){activeFilter=f;document.querySelectorAll('#tec-historial-body').length;document.querySelectorAll('.fpill').forEach(function(b){if(b.closest('#tec-day-filters')) return;b.classList.remove('active');});btn.classList.add('active');renderTecnico();}
function setMonFilter(f,btn){monFilter=f;document.querySelectorAll('.tg-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');renderOpenCards();renderMonitorHist();}

// ── DRAWER ──
function openDrawerReadOnly(idx){
  openDrawer(idx);
  // Hide resolve section for monitors - read only view
  document.getElementById('resolve-section').style.display='none';
  document.getElementById('closed-msg').style.display='none';
  // Show a read-only notice instead
  var box=document.getElementById('readonly-notice');
  if(box) box.style.display='block';
}
function openDrawer(idx){
  activeIdx=idx;var t=tickets[idx];
  document.getElementById('d-monitor').textContent=t.monitor;
  document.getElementById('d-fecha').textContent=t.fecha+' '+t.hora;
  document.getElementById('d-bloque').textContent=t.bloque;
  document.getElementById('d-cod').textContent=t.cod;
  document.getElementById('d-tipo-inc').textContent=t.tipoInc;
  document.getElementById('d-estado').textContent=t.estado;
  document.getElementById('d-tipo').textContent=t.tipo;
  document.getElementById('d-desc').textContent=t.desc;
  document.getElementById('d-alert-ok').classList.remove('show');
  document.getElementById('d-alert-err').classList.remove('show');
  // Show current SV time as preview for closing hour
  var prev=document.getElementById('hora-cierre-preview');
  if(prev){var nc=svNow();prev.textContent=nc.h+':'+nc.m+' '+nc.ampm;}
  var rn=document.getElementById('readonly-notice'); if(rn) rn.style.display='none';
  if(t.motivo&&t.motivo!=='—') document.getElementById('r-motivo').value=t.motivo;
  document.getElementById('resolve-section').style.display=t.estado==='Cerrado'?'none':'block';
  document.getElementById('closed-msg').style.display=t.estado==='Cerrado'?'block':'none';
  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}
function closeDrawer(){document.getElementById('overlay').classList.remove('open');document.getElementById('drawer').classList.remove('open');activeIdx=null;}

// ── TABS ──
function switchTab(n,btn){
  document.querySelectorAll('.sidebar-item').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('panel-'+n).classList.add('active');
  var titles={monitor:'Tickets del Día',nuevo:'Nueva Incidencia',tecnico:'Panel Técnico',monitoreo:'Monitoreo Rutinario'};
  document.getElementById('page-title').textContent=titles[n]||'';
  if (n === 'monitoreo' && typeof initMonitoreoPanel === 'function') {
    if (typeof clearSelection === 'function') clearSelection();
    initMonitoreoPanel();
  } else if (typeof clearMonSelection === 'function') {
    clearMonSelection();
  }
}

function showAlert(showId,hideId,msg){
  var s=document.getElementById(showId),h=document.getElementById(hideId);
  if(s){s.classList.add('show');var sp=s.querySelector('span');if(sp&&msg)sp.textContent=msg;}
  if(h)h.classList.remove('show');
  setTimeout(function(){if(s)s.classList.remove('show');},4000);
}

// ── INIT ──

// app.js — Inicialización
var editIdx = null;

function openEdit(idx) {
  editIdx = idx;
  var t = tickets[idx];
  document.getElementById('e-monitor').value  = t.monitor  || '';
  document.getElementById('e-cod').value      = t.cod !== '—' ? t.cod : '';
  document.getElementById('e-bloque').value   = t.bloque   || '';
  document.getElementById('e-tipo-inc').value = t.tipoInc  || 'Incidencia Interna';
  document.getElementById('e-tipo').value     = t.tipo     || '';
  document.getElementById('e-tec').value      = t.tecnico  || '';
  document.getElementById('e-motivo').value   = t.motivo !== '—' ? t.motivo : '';
  document.getElementById('e-desc').value     = t.desc !== '—' ? t.desc : '';
  document.getElementById('e-estado').value   = t.estado   || 'Abierto';
  document.getElementById('edit-overlay').style.display = 'block';
  document.getElementById('edit-modal').style.display   = 'block';
}

function closeEdit() {
  document.getElementById('edit-overlay').style.display = 'none';
  document.getElementById('edit-modal').style.display   = 'none';
  editIdx = null;
}

function guardarEdit() {
  if (editIdx === null) return;
  var t = tickets[editIdx];
  var codVal = document.getElementById('e-cod').value;
  // Validar 5 digitos
  if (!codVal || codVal.length !== 5 || isNaN(codVal)) {
    alert('El código debe tener exactamente 5 dígitos numéricos.');
    document.getElementById('e-cod').focus();
    return;
  }
  t.monitor  = document.getElementById('e-monitor').value;
  t.cod      = codVal || '—';
  t.bloque   = document.getElementById('e-bloque').value   || '—';
  t.tipoInc  = document.getElementById('e-tipo-inc').value;
  t.tipo     = document.getElementById('e-tipo').value;
  t.tecnico  = document.getElementById('e-tec').value      || 'Sin asignar';
  t.motivo   = document.getElementById('e-motivo').value   || '—';
  t.desc     = document.getElementById('e-desc').value     || '—';
  t.estado   = document.getElementById('e-estado').value;
  saveLocal();
  renderAll();
  closeEdit();
  // Sync with sheet in background
  if (typeof updateRowInSheet === 'function') {
    updateRowInSheet(t).then(function(ok) {
      if (!ok) console.warn('No se pudo sincronizar edición con Sheets.');
    });
  }
  showAlert('alert-ok', 'alert-err', 'Ticket actualizado ✓');
}

function validarCod(input) {
  var v = input.value.trim();
  if (v && v.length !== 5) {
    input.style.borderColor = '#dc2626';
    input.style.boxShadow = '0 0 0 3px rgba(220,38,38,.15)';
    input.title = 'Debe tener exactamente 5 dígitos';
  } else {
    input.style.borderColor = '';
    input.style.boxShadow = '';
    input.title = '';
  }
}
// ── AUTO BLOQUE ──
function autoBloque(cod) {
  if (cod.length !== 5) return;
  var bloque = getBloqueFromCod(cod);
  var el = document.getElementById('f-bloque');
  if (el && bloque) {
    el.value = bloque;
    // feedback visual breve
    el.style.borderColor = '#16a34a';
    el.style.background = '#f0fdf4';
    setTimeout(function() {
      el.style.borderColor = '';
      el.style.background = '';
    }, 1500);
  }
}

function autoBloqueEdit(cod) {
  if (cod.length !== 5) return;
  var bloque = getBloqueFromCod(cod);
  var el = document.getElementById('e-bloque');
  if (el && bloque) {
    el.value = bloque;
    el.style.borderColor = '#16a34a';
    el.style.background = '#f0fdf4';
    setTimeout(function() {
      el.style.borderColor = '';
      el.style.background = '';
    }, 1500);
  }
}
// ── FILTRO POR ROL/USUARIO ──
// Admin y Técnico ven todos los tickets, pero pueden filtrar por un monitor.
// Monitor/Técnico ve ÚNICAMENTE los suyos (sus códigos), sin importar el filtro.
function getVisibleTickets(panel) {
  if (!currentUser) return tickets;
  var rol = currentUser.rol;
  if (rol === 'Admin' || rol === 'Técnico') {
    if (ticketMonitorFilter) {
      var f = ticketMonitorFilter.trim().toLowerCase();
      return tickets.filter(function(t) {
        return String(t.monitor || '').trim().toLowerCase() === f;
      });
    }
    return tickets;
  }
  // Monitor/Técnico → solo los suyos
  var nombre = currentUser.nombre.trim().toLowerCase();
  return tickets.filter(function(t) {
    return String(t.monitor || '').trim().toLowerCase() === nombre;
  });
}
// ════════════════════════════════════════════════
//  MONITOR DEL DÍA  (autocompletar + banner)
// ════════════════════════════════════════════════
function renderMonitorDiaBanner() {
  var el = document.getElementById('monitor-dia-name');
  if (el) {
    var n = getMonitorDia();
    el.textContent = n || '— sin asignar —';
    el.style.color = n ? 'var(--purple)' : 'var(--text3)';
  }
}
function toggleMonitorDiaEdit(show) {
  var box = document.getElementById('monitor-dia-edit');
  var btn = document.getElementById('monitor-dia-btn');
  if (box) box.style.display = show ? 'flex' : 'none';
  if (btn) btn.style.display = show ? 'none' : 'inline-flex';
}
function guardarMonitorDia() {
  var sel = document.getElementById('monitor-dia-select');
  var nombre = sel ? sel.value : '';
  setMonitorDia(nombre);
  renderMonitorDiaBanner();
  toggleMonitorDiaEdit(false);
  var f = document.getElementById('f-monitor');
  if (f) f.value = nombre;
  if (typeof showToast === 'function') showToast('Monitor del día: ' + (nombre || 'sin asignar'), 'ok');
}

// Llena los <select> de monitores desde la lista central y autocompleta el del día.
function populateMonitorSelects() {
  var md = getMonitorDia();
  fillSelect('f-monitor', MONITORS, { placeholder: 'Seleccionar...' });
  fillSelect('e-monitor', MONITORS, {});
  fillSelect('monitor-dia-select', MONITORS, { placeholder: 'Seleccionar...', preselect: md });
  fillSelect('bulk-monitor', MONITORS, { placeholder: 'Reasignar a...' });

  // Filtro de tickets por monitor — solo visible para Admin/Técnico
  var verTodos = currentUser && (currentUser.rol === 'Admin' || currentUser.rol === 'Técnico');
  ['ticket-mon-filter', 'tec-mon-filter'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todos los monitores</option>' +
        MONITORS.map(function(m){ return '<option>' + m + '</option>'; }).join('');
      el.value = ticketMonitorFilter || '';
    }
    var wrap = document.getElementById(id + '-wrap');
    if (wrap) wrap.style.display = verTodos ? 'flex' : 'none';
  });

  var f = document.getElementById('f-monitor');
  if (f && md) {
    if (MONITORS.indexOf(md) === -1) { var o = document.createElement('option'); o.text = md; f.add(o); }
    f.value = md;
  }
}

// ════════════════════════════════════════════════
//  SELECCIÓN MÚLTIPLE + REASIGNACIÓN MASIVA
// ════════════════════════════════════════════════
function toggleTicketSel(cb) {
  var uid = cb.getAttribute('data-uid');
  if (cb.checked) selectedTickets.add(uid); else selectedTickets.delete(uid);
  updateBulkBar();
}
function toggleGroupSel(cb) {
  var table = cb.closest('table');
  if (!table) return;
  table.querySelectorAll('.tk-check').forEach(function (c) {
    c.checked = cb.checked;
    var uid = c.getAttribute('data-uid');
    if (cb.checked) selectedTickets.add(uid); else selectedTickets.delete(uid);
  });
  updateBulkBar();
}
function clearSelection() {
  selectedTickets.clear();
  document.querySelectorAll('.tk-check, .tk-allcheck').forEach(function (c) { c.checked = false; });
  updateBulkBar();
}
function updateBulkBar() {
  var bar = document.getElementById('bulk-bar');
  if (!bar) return;
  var n = selectedTickets.size;
  var c = document.getElementById('bulk-count');
  if (c) c.textContent = n;
  bar.classList.toggle('show', n > 0);
}
async function aplicarReasignacion() {
  var sel = document.getElementById('bulk-monitor');
  var nuevo = sel ? sel.value : '';
  if (!nuevo) { showToast('Elige a quién reasignar.', 'err'); return; }
  if (!selectedTickets.size) return;
  var uids = Array.from(selectedTickets);
  var afectados = tickets.filter(function (t) { return uids.indexOf(ticketUID(t)) > -1; });
  if (!afectados.length) return;
  if (!confirm('¿Reasignar ' + afectados.length + ' ticket(s) a "' + nuevo + '"?')) return;

  afectados.forEach(function (t) { t.monitor = nuevo; });
  saveLocal();
  renderAll();

  if (CFG.url) {
    setSyncStatus('syncing');
    showToast('Reasignando ' + afectados.length + ' ticket(s)...', 'loading');
    for (var i = 0; i < afectados.length; i++) {
      var ok = await reassignInSheet(afectados[i]);
      if (!ok) { pendingQueue.push({ type: 'reassign', ticket: afectados[i], ts: Date.now() }); saveQueue(); }
    }
    setSyncStatus('ok');
  }
  clearSelection();
  showToast(afectados.length + ' ticket(s) reasignado(s) a ' + nuevo + ' ✓', 'ok');
}

// ════════════════════════════════════════════════
//  PANEL MONITOREO RUTINARIO
// ════════════════════════════════════════════════
var monSelected = new Set();        // cods seleccionados para acción masiva
var monFilters = { q:'', depto:'', distrito:'', red:'', bloque:'', estado:'' };

// Abre el panel: decide qué hoja cargar según el rol.
function initMonitoreoPanel() {
  var sel = document.getElementById('mon-monitor-select');
  var wrap = document.getElementById('mon-monitor-wrap');
  if (!currentUser) return;
  if (currentUser.rol === 'Monitor/Técnico') {
    // Carga su propia hoja, sin selector
    if (wrap) wrap.style.display = 'none';
    var ya = monitoreoData && monitoreoData.monitorApp === currentUser.nombre;
    if (ya) {
      renderMonitoreo();   // muestra al instante SU caché
    } else {
      // La caché es de otro monitor (o no hay): descártala para no mostrar hoja ajena
      monitoreoData = null;
      monSelected.clear();
      saveMonitoreoLocal();
      renderMonitoreo();   // pinta vacío con "cargando..."
    }
    // Refresca desde el servidor si no hay caché propia o si tiene más de 60s
    var fresco = ya && (Date.now() - (monitoreoData.ts || 0) < 60000);
    if (!fresco && typeof loadMonitoreo === 'function') loadMonitoreo(currentUser.nombre);
  } else {
    // Admin / Técnico: elige qué monitor ver
    if (wrap) wrap.style.display = 'flex';
    if (sel && !sel.options.length) {
      sel.innerHTML = '<option value="">Elegir monitor...</option>' +
        MONITORS.map(function(m){ return '<option>'+m+'</option>'; }).join('');
    }
    renderMonitoreo();
  }
}
function cargarMonitoreoSeleccionado() {
  var sel = document.getElementById('mon-monitor-select');
  if (sel && sel.value && typeof loadMonitoreo === 'function') {
    monSelected.clear();
    loadMonitoreo(sel.value);
  }
}

// Cambiar el día que se está viendo (recarga ese día de la hoja del monitor actual)
function cambiarDiaMon(fechaISO) {
  if (!monitoreoData || !monitoreoData.monitorApp) return;
  monSelected.clear();
  loadMonitoreo(monitoreoData.monitorApp, fechaISO);
}

function uniqueVals(rows, key) {
  var s = {};
  rows.forEach(function(r){ if (r[key]) s[r[key]] = 1; });
  return Object.keys(s).sort();
}

function renderMonitoreo() {
  var head = document.getElementById('mon-head-info');
  var body = document.getElementById('mon-body');
  if (!body) return;

  if (!monitoreoData || !monitoreoData.rows || !monitoreoData.rows.length) {
    if (head) head.textContent = '';
    body.innerHTML = '<div class="empty-state" style="padding:50px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:40px;height:40px;opacity:.3"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>Sin centros cargados. ' +
      (currentUser && currentUser.rol!=='Monitor/Técnico' ? 'Elige un monitor arriba.' : 'Pulsa ↻ para sincronizar tu hoja.') + '</div>';
    actualizarFiltrosMon();
    updateMonBulkBar();
    return;
  }

  var rows = monitoreoData.rows;
  var sinCol = !monitoreoData.dateCol;
  if (head) {
    if (sinCol) {
      head.innerHTML = '<span style="color:var(--danger);font-weight:600">⚠ La hoja <strong>' +
        monitoreoData.sheet + '</strong> no tiene columnas de fecha. Revisa la fila 3 en Drive.</span>';
    } else {
      // Selector de fecha (días disponibles ≤ hoy)
      var avail = monitoreoData.availableDates || [];
      var selHtml = '';
      if (avail.length) {
        selHtml = ' · <select id="mon-date-select" onchange="cambiarDiaMon(this.value)" ' +
          'style="width:auto;display:inline-block;height:28px;padding:2px 8px;font-size:12px;border:1.5px solid var(--border2);border-radius:7px;vertical-align:middle">' +
          avail.map(function(a){
            return '<option value="' + a.iso + '"' + (a.iso === monitoreoData.dateISO ? ' selected' : '') + '>' + a.label + '</option>';
          }).join('') + '</select>';
      }
      var aviso = monitoreoData.isToday ? '' :
        ' <span style="color:var(--purple);font-weight:600">· mostrando último día disponible</span>';
      head.innerHTML = 'Hoja <strong>' + monitoreoData.sheet + '</strong> · día' + selHtml +
        ' · ' + rows.length + ' centros' + aviso;
    }
  }

  // Aplicar filtros
  var q = monFilters.q.toLowerCase();
  var list = rows.filter(function(r){
    if (monFilters.depto    && r.departamento !== monFilters.depto) return false;
    if (monFilters.distrito && r.distrito     !== monFilters.distrito) return false;
    if (monFilters.red      && r.red          !== monFilters.red) return false;
    if (monFilters.bloque   && r.bloque       !== monFilters.bloque) return false;
    if (monFilters.estado   && (r.estadoHoy||'') !== monFilters.estado) return false;
    if (q) {
      var hay = [r.cod, r.centro, r.departamento, r.distrito, r.red, r.bloque]
        .some(function(v){ return String(v||'').toLowerCase().indexOf(q) > -1; });
      if (!hay) return false;
    }
    return true;
  });

  var cnt = document.getElementById('mon-count');
  if (cnt) cnt.textContent = list.length;

  var optionsHtml = function(sel){
    var opts = '<option value="">—</option>';
    ESTADOS_MONITOREO.forEach(function(e){
      opts += '<option value="'+e.label+'"'+(e.label===sel?' selected':'')+'>'+e.label+'</option>';
    });
    return opts;
  };

  var rowsHtml = list.map(function(r){
    var checked = monSelected.has(r.cod) ? ' checked' : '';
    var c = estadoMonitoreoColor(r.estadoHoy);
    var styleSel = r.estadoHoy ? ('background:'+c.bg+';color:'+c.fg+';border-color:'+c.bg) : '';
    return '<tr>'+
      '<td style="text-align:center"><input type="checkbox" class="mon-check" data-cod="'+r.cod+'" onclick="toggleMonSel(this)"'+checked+'></td>'+
      '<td style="font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:600">'+r.cod+'</td>'+
      '<td style="font-weight:600;max-width:280px">'+(r.centro||'')+'</td>'+
      '<td style="color:var(--text2)">'+(r.departamento||'')+'</td>'+
      '<td style="color:var(--text2)">'+(r.distrito||'')+'</td>'+
      '<td>'+(r.red||'')+'</td>'+
      '<td>'+(r.bloque||'')+'</td>'+
      '<td><select class="mon-estado-sel" data-cod="'+r.cod+'" style="'+styleSel+'"'+(sinCol?' disabled':'')+' onchange="cambiarEstadoMon(this)">'+optionsHtml(r.estadoHoy||'')+'</select></td>'+
    '</tr>';
  }).join('');

  body.innerHTML =
    '<div style="overflow-x:auto"><table>'+
      '<thead><tr>'+
        '<th style="width:34px;text-align:center"><input type="checkbox" id="mon-allcheck" onclick="toggleMonAll(this)"></th>'+
        '<th>COD</th><th>Centro Escolar</th><th>Departamento</th><th>Distrito</th><th>Red</th><th>Bloque</th><th>Estado de hoy</th>'+
      '</tr></thead>'+
      '<tbody>'+(rowsHtml||'<tr><td colspan="8"><div class="empty-state">Sin resultados con esos filtros</div></td></tr>')+'</tbody>'+
    '</table></div>';

  actualizarFiltrosMon();
  updateMonBulkBar();
}

// Rellena los <select> de filtros con los valores disponibles
function actualizarFiltrosMon() {
  var rows = (monitoreoData && monitoreoData.rows) || [];
  function fill(id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    var cur = el.value;
    var vals = uniqueVals(rows, key);
    var label = id.replace('mon-f-','');
    el.innerHTML = '<option value="">Todos</option>' + vals.map(function(v){ return '<option>'+v+'</option>'; }).join('');
    el.value = cur;
  }
  fill('mon-f-depto','departamento');
  fill('mon-f-distrito','distrito');
  fill('mon-f-red','red');
  fill('mon-f-bloque','bloque');
  var est = document.getElementById('mon-f-estado');
  if (est && !est.dataset.filled) {
    est.innerHTML = '<option value="">Todos</option>' + ESTADOS_MONITOREO.map(function(e){ return '<option>'+e.label+'</option>'; }).join('');
    est.dataset.filled = '1';
  }
}

function setMonFilter(key, val) { monFilters[key] = val; renderMonitoreo(); }
function limpiarFiltrosMon() {
  monFilters = { q:'', depto:'', distrito:'', red:'', bloque:'', estado:'' };
  ['mon-search','mon-f-depto','mon-f-distrito','mon-f-red','mon-f-bloque','mon-f-estado'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value='';
  });
  renderMonitoreo();
}

// ── Cambiar estado de UN centro ──
async function cambiarEstadoMon(sel) {
  var cod = sel.getAttribute('data-cod');
  var estado = sel.value;
  var c = estadoMonitoreoColor(estado);
  sel.style.background = estado ? c.bg : '';
  sel.style.color = estado ? c.fg : '';
  sel.style.borderColor = estado ? c.bg : '';
  // Actualiza cache
  if (monitoreoData) {
    monitoreoData.rows.forEach(function(r){ if (r.cod === cod) r.estadoHoy = estado; });
    saveMonitoreoLocal();
  }
  var ok = await setEstadoMonitoreo(cod, estado);
  showToast(ok ? 'Estado guardado ✓' : 'Sin conexión · guardado pendiente', ok ? 'ok' : 'warn');
}

// ── Selección múltiple ──
function toggleMonSel(cb) {
  var cod = cb.getAttribute('data-cod');
  if (cb.checked) monSelected.add(cod); else monSelected.delete(cod);
  updateMonBulkBar();
}
function toggleMonAll(cb) {
  document.querySelectorAll('.mon-check').forEach(function(c){
    c.checked = cb.checked;
    var cod = c.getAttribute('data-cod');
    if (cb.checked) monSelected.add(cod); else monSelected.delete(cod);
  });
  updateMonBulkBar();
}
function clearMonSelection() {
  monSelected.clear();
  document.querySelectorAll('.mon-check').forEach(function(c){ c.checked=false; });
  var all = document.getElementById('mon-allcheck'); if (all) all.checked=false;
  updateMonBulkBar();
}
function updateMonBulkBar() {
  var bar = document.getElementById('mon-bulk-bar');
  if (!bar) return;
  var n = monSelected.size;
  var c = document.getElementById('mon-bulk-count');
  if (c) c.textContent = n;
  bar.classList.toggle('show', n > 0);
}

// ── Aplicar estado a varios centros ──
async function aplicarEstadoMasivo() {
  if (monitoreoData && !monitoreoData.dateCol) { showToast('Hoy no tiene columna en la hoja. Agrégala primero.', 'err'); return; }
  var sel = document.getElementById('mon-bulk-estado');
  var estado = sel ? sel.value : '';
  if (!estado) { showToast('Elige un estado.', 'err'); return; }
  if (!monSelected.size) return;
  var cods = Array.from(monSelected);
  if (!confirm('¿Marcar ' + cods.length + ' centro(s) como "' + estado + '" para hoy?')) return;

  // Actualiza cache + UI
  if (monitoreoData) {
    monitoreoData.rows.forEach(function(r){ if (cods.indexOf(r.cod) > -1) r.estadoHoy = estado; });
    saveMonitoreoLocal();
  }
  renderMonitoreo();

  setSyncStatus('syncing');
  showToast('Guardando ' + cods.length + ' estado(s)...', 'loading');
  // Una sola petición por lote (grupos de 150 para no exceder el largo de la URL).
  var CHUNK = 150, fails = 0;
  for (var i = 0; i < cods.length; i += CHUNK) {
    var grupo = cods.slice(i, i + CHUNK);
    var ok = await setEstadoMonitoreoBatch(grupo, estado);
    if (!ok) fails += grupo.length;
  }
  setSyncStatus(fails ? 'err' : 'ok');
  clearMonSelection();
  showToast(fails ? ((cods.length-fails)+' guardados, '+fails+' pendientes') : (cods.length + ' centros marcados ✓'), fails ? 'warn' : 'ok');
}