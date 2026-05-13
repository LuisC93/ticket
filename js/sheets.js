// sheets.js

async function sheetFetch(p){
  if(!CFG.url) return null;
  var q=Object.keys(p).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(p[k]);}).join('&');
  try{var r=await fetch(CFG.url+'?'+q);return await r.json();}catch(e){return null;}
}
async function testConnection(){
  if(!CFG.url){alert('Primero guarda la URL.');return;}
  setSyncStatus('syncing');
  var d=await sheetFetch({action:'ping'});
  if(d&&d.status==='ok'){setSyncStatus('ok');alert('✓ Conexión exitosa');}
  else{setSyncStatus('err');alert('✗ Error: '+(d?JSON.stringify(d):'sin respuesta'));}
}
async function appendToSheet(t){
  if(!CFG.url) return false;
  setSyncStatus('syncing');
  var row=[isoFromTicket(t.fecha),t.hora,t.monitor,t.cod,t.bloque,t.tipoInc,t.desc,t.tipo,t.motivo,t.tecnico,t.horaFinal,t.duracion,t.ticketExt,t.estado];
  var d=await sheetFetch({payload:JSON.stringify({action:'append',sheet:CFG.sheet||'SLA',row:row})});
  setSyncStatus(d&&d.status==='ok'?'ok':'err');
  return d&&d.status==='ok';
}
async function updateRowInSheet(t){
  if(!CFG.url) return false;
  setSyncStatus('syncing');
  var d=await sheetFetch({payload:JSON.stringify({action:'update',sheet:CFG.sheet||'SLA',ticketId:t.cod,horaFinal:t.horaFinal,duracion:t.duracion,motivo:t.motivo,notas:t.notas,estado:t.estado})});
  setSyncStatus(d&&d.status==='ok'?'ok':'err');
  return d&&d.status==='ok';
}
async function loadFromSheet(){
  if(!CFG.url){toggleConfig();return;}
  setSyncStatus('syncing');
  var d=await sheetFetch({action:'getAll',sheet:CFG.sheet||'SLA'});
  if(d&&d.status==='ok'&&Array.isArray(d.rows)){
    tickets=d.rows.map(function(r){return{fecha:fmtFechaDisplay(r[0]),hora:fmtHora(r[1]),monitor:r[2],cod:r[3],bloque:r[4],tipoInc:r[5],desc:r[6],tipo:r[7],motivo:r[8],tecnico:r[9],horaFinal:fmtHora(r[10]),duracion:r[11],ticketExt:r[12],estado:r[13]||'Abierto',notas:'',id:r[3]||Date.now()};});
    saveLocal();setSyncStatus('ok');renderAll();
    showAlert('alert-ok','alert-err',d.rows.length+' tickets cargados ✓');
  } else {setSyncStatus('err');alert('Error: '+(d?JSON.stringify(d):'sin respuesta'));}
}

// ── TICKETS ──
async function crearTicket(){
  var mon=document.getElementById('f-monitor').value;
  var tipo=document.getElementById('f-tipo').value;
  if(!mon||!tipo){showAlert('alert-err','alert-ok','Completa: Monitor y Problema.');return;}
  // Hora automatica de El Salvador al momento de crear el ticket
  var now=svNow();
  var hora=now.h+':'+now.m+' '+now.ampm;
  var t={fecha:fmtFechaDisplay(document.getElementById('f-fecha').value||todayISO()),hora:hora,monitor:mon,cod:document.getElementById('f-cod').value||'—',bloque:document.getElementById('f-bloque').value||'—',tipoInc:document.getElementById('f-tipo-inc').value,desc:document.getElementById('f-desc').value||'—',tipo:tipo,motivo:document.getElementById('f-motivo').value||'—',tecnico:document.getElementById('f-tec').value||'Sin asignar',horaFinal:'',duracion:'',ticketExt:document.getElementById('f-ticket-ext').value||'—',estado:'Abierto',notas:'',id:Date.now()};
  tickets.unshift(t);saveLocal();renderAll();
  var ok=await appendToSheet(t);
  if(ok) showAlert('alert-ok','alert-err','Ticket guardado en Google Sheets ✓');
  else showAlert('alert-err','alert-ok','Sin conexión. Guardado localmente.');
  limpiarForm();
}
async function cerrarTicket(){
  if(activeIdx===null) return;
  var t=tickets[activeIdx];
  if(t.estado==='Cerrado') return;
  // Hora de cierre automatica El Salvador
  var nowC=svNow(); t.horaFinal=nowC.h+':'+nowC.m+' '+nowC.ampm;
  t.motivo=document.getElementById('r-motivo').value;
  t.notas=document.getElementById('r-notas').value;
  t.estado='Cerrado';
  if(t.hora&&t.horaFinal!=='--:--'){
    function toMins(ts){
      var parts=ts.trim().split(' ');
      var hm=parts[0].split(':');
      var h=parseInt(hm[0]), m=parseInt(hm[1]||0);
      var ap=parts[1]||'';
      if(ap==='PM'&&h!==12) h+=12;
      if(ap==='AM'&&h===12) h=0;
      return h*60+m;
    }
    var m=toMins(t.horaFinal)-toMins(t.hora);
    if(m>0) t.duracion=Math.floor(m/60)+' h '+m%60+' min';
  }
  // 1. Cierra inmediatamente en local sin esperar al Sheet
  saveLocal();
  renderAll();
  document.getElementById('resolve-section').style.display='none';
  document.getElementById('closed-msg').style.display='block';
  setTimeout(closeDrawer, 800);
  // 2. Sincroniza con Sheet en segundo plano
  updateRowInSheet(t).then(function(ok){
    if(!ok) console.warn('No se pudo sincronizar con Sheets. Guardado localmente.');
  });
}
function limpiarForm(){
  ['f-monitor','f-cod','f-hora-h','f-hora-m','f-hora-ampm','f-bloque','f-tipo-inc','f-tipo','f-desc','f-tec','f-motivo','f-ticket-ext'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  // Reset fecha y hora a El Salvador actual
  var fd=document.getElementById('f-fecha'); if(fd) fd.value=todayISO();
  var now=svNow();
  var hEl=document.getElementById('f-hora-h'); if(hEl) hEl.value=now.h;
  var mEl=document.getElementById('f-hora-m'); if(mEl) mEl.value=now.m;
  var pEl=document.getElementById('f-hora-ampm'); if(pEl) pEl.value=now.ampm;
  document.getElementById('f-fecha').value=todayISO();
}

// ── RENDER ──

// ui.js — Render, métricas, drawer, filtros y alertas