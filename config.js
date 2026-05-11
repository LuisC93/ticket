// ══════════════════════════════════════════
//  config.js — Configuración y persistencia
// ══════════════════════════════════════════

const CONFIG_KEY  = 'incidencias_cfg';
const DATA_KEY    = 'incidencias_data';
const COUNTER_KEY = 'incidencias_counter';

let CFG            = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
let tickets        = JSON.parse(localStorage.getItem(DATA_KEY)   || '[]');
let ticketCounter  = parseInt(localStorage.getItem(COUNTER_KEY)  || '36700');
let activeFilter   = 'all';
let activeTicketIdx = null;

function saveLocal() {
  localStorage.setItem(DATA_KEY,    JSON.stringify(tickets));
  localStorage.setItem(COUNTER_KEY, String(ticketCounter));
}

function saveConfig() {
  CFG.url   = document.getElementById('cfg-url').value.trim();
  CFG.sheet = document.getElementById('cfg-sheet').value.trim() || 'Incidencias';
  localStorage.setItem(CONFIG_KEY, JSON.stringify(CFG));
  setSyncStatus('ok');
  showFormAlert('alert-ok', 'alert-err', 'Configuración guardada correctamente.');
}

function loadConfig() {
  if (CFG.url)   document.getElementById('cfg-url').value   = CFG.url;
  if (CFG.sheet) document.getElementById('cfg-sheet').value = CFG.sheet;
  if (CFG.url)   setSyncStatus('ok');
}

function toggleConfig() {
  const el = document.getElementById('config-section');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
