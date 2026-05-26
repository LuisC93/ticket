// config.js — Estado global, configuración y mapa de bloques

var CFG = JSON.parse(localStorage.getItem('inc_cfg') || '{}');
var tickets = JSON.parse(localStorage.getItem('inc_data') || '[]');
var activeFilter = 'all', monFilter = 'all', dayFilter = 'today', tecDayFilter = 'today';
var activeIdx = null;

// ── MAPA BLOQUES (código → bloque) ──
var bloquesMap = JSON.parse(localStorage.getItem('inc_bloques') || '{}');

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
  if (CFG.url) document.getElementById('cfg-url').value = CFG.url;
  if (CFG.sheet) document.getElementById('cfg-sheet').value = CFG.sheet;
  if (CFG.url) { setSyncStatus('ok'); cargarBloques(); }
}
function toggleConfig() {
  var el = document.getElementById('config-section');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}