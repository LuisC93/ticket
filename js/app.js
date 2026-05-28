// app.js — Inicialización

(function(){
  var days   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  var months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  // Etiqueta de fecha de hoy (fecha local del navegador)
  var hoy = new Date();
  var lbl = document.getElementById('today-label');
  if (lbl) lbl.textContent = days[hoy.getDay()] + ', ' + hoy.getDate() + ' ' + months[hoy.getMonth()] + ' ' + hoy.getFullYear();

  // Fecha del formulario nuevo
  var fFecha = document.getElementById('f-fecha');
  if (fFecha) fFecha.value = todayISO();

  // Hora actual de El Salvador en el formulario
  var sv  = svNow();
  var hEl = document.getElementById('f-hora-h');
  var mEl = document.getElementById('f-hora-m');
  var pEl = document.getElementById('f-hora-ampm');
  if (hEl) hEl.value = sv.h;
  if (mEl) mEl.value = sv.m;
  if (pEl) pEl.value = sv.ampm;

  loadConfig();

  // Monitor del día + selects de monitores (la lista central vive en config.js)
  if (typeof populateMonitorSelects === 'function') populateMonitorSelects();
  if (typeof renderMonitorDiaBanner === 'function') renderMonitorDiaBanner();
  if (typeof updateBulkBar === 'function') updateBulkBar();

  renderAll();
})();
