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
  var vis=getVisibleTickets();
  var today=todayISO();
  var todayTickets=vis.filter(function(t){return isoFromTicket(t.fecha)===today;});
  var open=vis.filter(function(t){return t.estado==='Abierto';});
  var closed=vis.filter(function(t){return t.estado==='Cerrado';});
  document.getElementById('m-hoy').textContent=todayTickets.length;
  document.getElementById('m-open').textContent=open.length;
  document.getElementById('m-closed').textContent=closed.length;
  document.getElementById('m-total').textContent=todayTickets.length;
  document.getElementById('t-total').textContent=vis.length;
  document.getElementById('t-pend').textContent=open.length;
  document.getElementById('t-res').textContent=closed.filter(function(t){return isoFromTicket(t.fecha)===today;}).length;
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
  var vis=getVisibleTickets();
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
  return dates.map(function(date){
    var rows=byDate[date];
    var ab=rows.filter(function(t){return t.estado==='Abierto';}).length;
    var ce=rows.filter(function(t){return t.estado==='Cerrado';}).length;
    var label=date;
    try{var p=date.split('-');var d2=new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2]));label=days[d2.getDay()]+' '+p[2]+'/'+p[1]+'/'+p[0];}catch(e){}
    var ths=['Hora','Monitor','COD','Bloque','Problema','Técnico','Estado',''].map(function(h){
      return '<th>'+h+'</th>';
    }).join('');
    var rowsHtml=rows.map(function(t){
      var idx=tickets.indexOf(t);
      return '<tr onclick="openDrawer('+idx+')">'+
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
  var vis=getVisibleTickets();
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
  var vis=getVisibleTickets();
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
  var titles={monitor:'Tickets del Día',nuevo:'Nueva Incidencia',tecnico:'Panel Técnico'};
  document.getElementById('page-title').textContent=titles[n]||'';
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
function getVisibleTickets() {
  if (!currentUser) return tickets;
  var rol = currentUser.rol;
  // Técnico y Admin ven todo
  if (rol === 'Técnico' || rol === 'Admin') return tickets;
  // Monitor y Monitor/Técnico solo ven sus tickets
  var nombre = currentUser.nombre.trim().toLowerCase();
  return tickets.filter(function(t) {
    return String(t.monitor || '').trim().toLowerCase() === nombre;
  });
}