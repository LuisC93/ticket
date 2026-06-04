// tickets.js — utilidades de fecha/hora y selección de tickets.
// (Reconstruido: este archivo se había corrompido con una copia de sheets.js)

// Normaliza cualquier fecha a ISO yyyy-mm-dd.
// Acepta "2026-06-02", "02/06/2026", o cadenas con hora al final.
function isoFromTicket(v) {
  var s = String(v == null ? '' : v).trim();
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
  if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
    var p = s.split('/');
    return p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2);
  }
  return s.slice(0, 10);
}

// Fecha para mostrar en pantalla, formato dd/mm/aaaa.
function fmtFechaDisplay(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  // Si viene ISO yyyy-mm-dd → a dd/mm/aaaa
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  // Si ya viene dd/mm/aaaa la dejamos igual
  if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) return s.split(' ')[0];
  return s;
}

// Hora para mostrar; si viene vacía o como guion, devuelve "--:--".
function fmtHora(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s || s === '—' || s === '-') return '--:--';
  return s;
}

// ¿La fecha del ticket cae dentro del rango del filtro de día?
// filtros: 'today', 'yesterday', '3days', 'week', 'all'
function inRange(fecha, filtro) {
  if (!filtro || filtro === 'all') return true;
  var iso = isoFromTicket(fecha);
  if (!iso) return false;
  // "hoy" en horario El Salvador (UTC-6)
  var svMs = new Date().getTime() - (6 * 60 * 60 * 1000);
  var hoy = new Date(svMs);
  var hoyISO = hoy.toISOString().slice(0, 10);
  if (filtro === 'today') return iso === hoyISO;
  // Días de diferencia entre la fecha del ticket y hoy
  var d1 = new Date(iso + 'T00:00:00Z').getTime();
  var d0 = new Date(hoyISO + 'T00:00:00Z').getTime();
  var diffDias = Math.round((d0 - d1) / (24 * 60 * 60 * 1000));
  if (filtro === 'yesterday') return diffDias === 1;
  if (filtro === '3days') return diffDias >= 0 && diffDias <= 2;
  if (filtro === 'week')  return diffDias >= 0 && diffDias <= 6;
  return true;
}

// Identificador estable de un ticket (sobrevive a re-renders y sincronizaciones).
// No usamos el índice del arreglo porque cambia al recargar desde Sheets.
function ticketUID(t) {
  return isoFromTicket(t.fecha) + '|' + (t.hora || '') + '|' + (t.cod || '') + '|' + (t.tipo || '');
}