// config.js — Estado global, configuración y mapa de bloques

// Usuario activo. Se declara aquí (primer script en cargar) para que cualquier
// render inicial pueda leerlo sin error. auth.js lo asigna tras el login.
var currentUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;

// ── URL DEL SCRIPT (ya configurada, no requiere setup manual) ──
var CFG_DEFAULT = {
  url:   'https://script.google.com/macros/s/AKfycbw9_MGNNS3DEoJGOHb9VclI3LY-ARwILy3GG8ohTGHfFPQ_6IqM8T8imys89w47VY91/exec',
  sheet: 'SLA'
};
var CFG_SAVED = JSON.parse(localStorage.getItem('inc_cfg') || '{}');
// Siempre usa la URL del código, pero respeta si el admin cambió la hoja
var CFG = Object.assign({}, CFG_DEFAULT, CFG_SAVED, { url: CFG_DEFAULT.url });
var tickets = JSON.parse(localStorage.getItem('inc_data') || '[]');
var activeFilter = 'all', monFilter = 'all', dayFilter = 'today', tecDayFilter = 'today';
var ticketMonitorFilter = ''; // filtro de tickets por monitor (solo Admin/Técnico; '' = todos)
var activeIdx = null;

// ── MAPA BLOQUES (código → bloque) ──
var bloquesMap = JSON.parse(localStorage.getItem('inc_bloques') || '{}');

// ── LISTA CENTRAL DE MONITORES (una sola fuente de verdad) ──
// Se usa para: formulario nuevo, modal editar, monitor del día y reasignación masiva.
var MONITORS = ['Jose Luis','Boris','Jimmy','Marta','Luis Yanes','Sandor','Jose Cruz','Jonatan','Linda'];

// ── MAPA MONITOR → PESTAÑA DE DRIVE ──
// La hoja (pestaña) de cada monitor en el Google Sheet de monitoreo.
// Por defecto es el mismo nombre; aquí se corrigen los que difieren.
// ⚠️ EDITA AQUÍ si alguna pestaña se llama distinto al nombre del monitor.
var MONITOR_SHEET_MAP = {
  'Jose Luis':  'Jose Luis',
  'Boris':      'Boris',
  'Jimmy':      'Jimy',          // la pestaña se llama "Jimy"
  'Marta':      'Marta',
  'Luis Yanes': 'Luis Yanes',
  'Sandor':     'Sandor',
  'Jose Cruz':  'Jose Cruz',
  'Jose':       'Jose Cruz',     // alias: usuario "Jose" → pestaña "Jose Cruz"
  'Jonatan':    'Jonatan',
  'Linda':      'Linda Aviles'   // la pestaña se llama "Linda Aviles"
};
function getSheetForMonitor(nombre) {
  return MONITOR_SHEET_MAP[nombre] || nombre;
}

// ── ESTADOS DE MONITOREO (desplegable con colores) ──
// label = texto exacto que se escribe en la hoja. bg/fg = color de la "celda".
// ⚠️ EDITA AQUÍ para agregar, quitar o renombrar estados.
var ESTADOS_MONITOREO = [
  { label: 'Navegación estable',            bg:'#34a853', fg:'#ffffff' },
  { label: 'Corte F.O externa',             bg:'#ea4335', fg:'#ffffff' },
  { label: 'Problema de ancho de banda',    bg:'#f4a3a0', fg:'#5c0a06' },
  { label: 'Saturación',                    bg:'#fbe08a', fg:'#5c4708' },
  { label: 'Latencia',                      bg:'#a7e3ee', fg:'#06414c' },
  { label: 'Problema de cobertura WIFI',    bg:'#bcd9f7', fg:'#0b3a66' },
  { label: 'Problema de navegación',        bg:'#3c4858', fg:'#ffffff' },
  { label: 'Equipo apagado',                bg:'#c0c4cc', fg:'#1f2933' },
  { label: 'AP averiado',                   bg:'#aee0f7', fg:'#07435f' },
  { label: 'Avería en cable UTP',           bg:'#dfe3e8', fg:'#1f2933' },
  { label: 'Avería de Patchcore F.O/Cobre', bg:'#8fd6e0', fg:'#053b43' },
  { label: 'FW averiado',                   bg:'#5b6b7b', fg:'#ffffff' },
  { label: 'PDU averiado',                  bg:'#f6d154', fg:'#4a3c05' },
  { label: 'RT averiado',                   bg:'#e879b9', fg:'#4a0c30' },
  { label: 'SW averiado',                   bg:'#f5a23d', fg:'#4a2c04' },
  { label: 'UPS averiado',                  bg:'#8b5cf6', fg:'#ffffff' },
  { label: 'Problema de usuario',           bg:'#111827', fg:'#ffffff' },
  { label: 'Intervenida',                   bg:'#c0392b', fg:'#ffffff' }
];
function estadoMonitoreoColor(label) {
  for (var i=0;i<ESTADOS_MONITOREO.length;i++){
    if (ESTADOS_MONITOREO[i].label === label) return ESTADOS_MONITOREO[i];
  }
  return { label: label||'', bg:'#ffffff', fg:'#9ca3af' };
}

// ── DATOS DE MONITOREO (cache local por monitor) ──
// { monitorApp: nombre, sheet: pestaña, dateCol: 'd/m', rows: [...] }
var monitoreoData = JSON.parse(localStorage.getItem('inc_monitoreo') || 'null');
function saveMonitoreoLocal() { localStorage.setItem('inc_monitoreo', JSON.stringify(monitoreoData)); }

// ── MONITOR DEL DÍA ──
// Se guarda por día. Si cambia el turno durante el día, se actualiza y los
// tickets nuevos se autocompletan con el nuevo monitor.
function getMonitorDia() {
  try {
    var raw = JSON.parse(localStorage.getItem('inc_monitor_dia') || 'null');
    if (raw && raw.fecha === todayISO() && raw.nombre) return raw.nombre;
  } catch (e) {}
  // Default del día: si el usuario es Monitor/Técnico, su propio nombre.
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'Monitor/Técnico') {
    return currentUser.nombre || '';
  }
  return '';
}
function setMonitorDia(nombre) {
  localStorage.setItem('inc_monitor_dia', JSON.stringify({ fecha: todayISO(), nombre: nombre || '' }));
}

// ── HELPER: llenar un <select> desde un arreglo ──
function fillSelect(id, items, opts) {
  opts = opts || {};
  var el = document.getElementById(id);
  if (!el) return;
  var current = el.value;
  var html = '';
  if (opts.placeholder) html += '<option value="">' + opts.placeholder + '</option>';
  // Asegura que el valor preseleccionado exista aunque no esté en la lista
  var list = items.slice();
  if (opts.preselect && list.indexOf(opts.preselect) === -1) list.unshift(opts.preselect);
  html += list.map(function(v){ return '<option>' + v + '</option>'; }).join('');
  el.innerHTML = html;
  if (opts.preselect) el.value = opts.preselect;
  else if (current) el.value = current;
}

function saveLocal() { localStorage.setItem('inc_data', JSON.stringify(tickets)); }

// ── DATE HELPERS ──
function todayISO() {
  var sv = new Date(new Date().getTime() - (6 * 60 * 60 * 1000));
  return sv.toISOString().slice(0, 10);
}
function svNow() {
  var sv = new Date(new Date().getTime() - (6 * 60 * 60 * 1000));
  var h = sv.getUTCHours(), m = sv.getUTCMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return { h: String(h), m: String(m).padStart(2, '0'), ampm: ampm };
}

// ── BLOQUE AUTO ──
function getBloqueFromCod(cod) {
  if (!cod || cod.length !== 5) return '';
  return bloquesMap[cod] || '';
}

// ── CARGA BLOQUES DESDE SHEETS ──
async function cargarBloques() {
  if (!CFG.url) return;
  try {
    var q = 'action=getBloques';
    var r = await fetch(CFG.url + '?' + q);
    var d = await r.json();
    if (d && d.status === 'ok' && d.map) {
      bloquesMap = d.map;
      localStorage.setItem('inc_bloques', JSON.stringify(bloquesMap));
      console.log('Bloques cargados: ' + Object.keys(bloquesMap).length);
    }
  } catch (e) {
    console.warn('No se pudieron cargar los bloques:', e);
  }
}

// ── CONFIG ──
function saveConfig() {
  CFG.url = document.getElementById('cfg-url').value.trim();
  CFG.sheet = document.getElementById('cfg-sheet').value.trim() || 'SLA';
  localStorage.setItem('inc_cfg', JSON.stringify(CFG));
  setSyncStatus('ok');
  showAlert('alert-ok', 'alert-err', 'Configuración guardada ✓');
  cargarBloques(); // carga bloques al guardar config
}
function loadConfig() {
  var urlEl = document.getElementById('cfg-url');
  var sheetEl = document.getElementById('cfg-sheet');
  if (urlEl) urlEl.value = CFG.url || CFG_DEFAULT.url;
  if (sheetEl) sheetEl.value = CFG.sheet || 'SLA';
  if (CFG.url) { setSyncStatus('ok'); cargarBloques(); }
}
function toggleConfig() {
  var el = document.getElementById('config-section');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}