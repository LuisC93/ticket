// DEBUG_TOOLS.js - Herramientas de diagnóstico para conexión a Google Sheets

// ── VALIDAR CONFIGURACIÓN ──
function validateConfig() {
  console.log('═══ VALIDACIÓN DE CONFIGURACIÓN ═══');
  console.log('CFG.url:', CFG.url ? '✓ Configurada' : '✗ NO configurada');
  console.log('CFG.sheet:', CFG.sheet || 'SLA');
  console.log('');
}

// ── TEST DETALLADO DE CONEXIÓN ──
async function testConnectionDetailed() {
  console.log('═══ TEST DETALLADO DE CONEXIÓN ═══');
  
  if (!CFG.url) {
    console.error('ERROR: URL no configurada');
    return;
  }
  
  // Test 1: Ping
  console.log('Test 1: PING');
  try {
    var controller = new AbortController();
    var timeout = setTimeout(() => controller.abort(), 5000);
    var response = await fetch(CFG.url + '?action=ping', { signal: controller.signal });
    clearTimeout(timeout);
    
    console.log('  Status HTTP:', response.status);
    var data = await response.json();
    console.log('  Response:', data);
    console.log('  ✓ PING OK');
  } catch(e) {
    console.error('  ✗ PING FALLÓ:', e.message);
  }
  console.log('');
  
  // Test 2: GetAll (lectura)
  console.log('Test 2: GET ALL (lectura)');
  try {
    var controller = new AbortController();
    var timeout = setTimeout(() => controller.abort(), 5000);
    var response = await fetch(CFG.url + '?action=getAll&sheet=SLA', { signal: controller.signal });
    clearTimeout(timeout);
    
    console.log('  Status HTTP:', response.status);
    var data = await response.json();
    console.log('  Registros encontrados:', data.rows ? data.rows.length : 0);
    console.log('  ✓ GET ALL OK');
  } catch(e) {
    console.error('  ✗ GET ALL FALLÓ:', e.message);
  }
  console.log('');
  
  // Test 3: Write simulado (APPEND sin datos reales)
  console.log('Test 3: WRITE (append de prueba)');
  try {
    var testPayload = {
      action: 'append',
      sheet: 'SLA',
      row: ['2026-05-27', '12:00 PM', 'Test', '00000', 'TEST', 'Incidencia Interna', 'Ticket de prueba', 'Test', '—', 'Test', '', '', '', 'Abierto']
    };
    
    var encoded = encodeURIComponent(JSON.stringify(testPayload));
    var controller = new AbortController();
    var timeout = setTimeout(() => controller.abort(), 5000);
    var response = await fetch(CFG.url + '?payload=' + encoded, { signal: controller.signal });
    clearTimeout(timeout);
    
    console.log('  Status HTTP:', response.status);
    var data = await response.json();
    console.log('  Response:', data);
    console.log('  ✓ WRITE OK');
  } catch(e) {
    console.error('  ✗ WRITE FALLÓ:', e.message);
  }
  console.log('');
  console.log('═══ FIN DE TESTS ═══');
}

// ── MONITOREAR PETICIONES FETCH ──
var originalFetch = window.fetch;
var fetchLog = [];

window.fetch = function(...args) {
  var url = args[0];
  var init = args[1] || {};
  var timestamp = new Date().toLocaleTimeString();
  
  console.log(`[${timestamp}] FETCH → ${url.substring(0, 80)}...`);
  
  return originalFetch.apply(window, args)
    .then(response => {
      console.log(`[${timestamp}] FETCH ← Status ${response.status}`);
      fetchLog.push({ url, status: response.status, timestamp });
      return response;
    })
    .catch(error => {
      console.error(`[${timestamp}] FETCH ERROR: ${error.message}`);
      fetchLog.push({ url, error: error.message, timestamp });
      throw error;
    });
};

// ── EXPORTAR LOG DE FETCH ──
function exportFetchLog() {
  console.table(fetchLog);
  console.log('Copia este JSON para compartir:');
  console.log(JSON.stringify(fetchLog, null, 2));
}

// ── HELPER: Mostrar logs en toast ──
function showLogs() {
  var logs = document.querySelectorAll('*'); // dummy
  alert('Revisa la consola (F12) para ver todos los logs.\nUsa: exportFetchLog() para ver el historial de peticiones.');
}

// ── EXPORT PARA USO EN CONSOLA ──
window.DEBUG = {
  validateConfig: validateConfig,
  testConnection: testConnectionDetailed,
  exportLog: exportFetchLog,
  showLogs: showLogs
};

console.log('╔═══════════════════════════════════════════╗');
console.log('║  HERRAMIENTAS DE DEBUG CARGADAS          ║');
console.log('║  Escribe en la consola:                  ║');
console.log('║  - DEBUG.validateConfig()                ║');
console.log('║  - DEBUG.testConnection()                ║');
console.log('║  - DEBUG.exportLog()                     ║');
console.log('╚═══════════════════════════════════════════╝');
