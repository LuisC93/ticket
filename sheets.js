// ══════════════════════════════════════════
//  sheets.js — Integración con Google Sheets
// ══════════════════════════════════════════

async function appendToSheet(ticket) {
  if (!CFG.url) return false;
  try {
    setSyncStatus('syncing');
    const row = [
      ticket.id, ticket.fecha, ticket.hora, ticket.monitor, ticket.cod,
      ticket.bloque, ticket.tipoInc, ticket.tipo, ticket.desc,
      ticket.tecnico, ticket.motivo, ticket.ticketExt,
      ticket.horaFinal, ticket.duracion, ticket.notas, ticket.estado
    ];
    const res = await fetch(CFG.url, {
      method: 'POST',
      body: JSON.stringify({ action: 'append', sheet: CFG.sheet || 'Incidencias', row })
    });
    const data = await res.json();
    setSyncStatus(data.status === 'ok' ? 'ok' : 'err');
    return data.status === 'ok';
  } catch {
    setSyncStatus('err');
    return false;
  }
}

async function updateRowInSheet(ticket) {
  if (!CFG.url) return false;
  try {
    setSyncStatus('syncing');
    const res = await fetch(CFG.url, {
      method: 'POST',
      body: JSON.stringify({
        action:    'update',
        sheet:     CFG.sheet || 'Incidencias',
        ticketId:  ticket.id,
        horaFinal: ticket.horaFinal,
        duracion:  ticket.duracion,
        motivo:    ticket.motivo,
        notas:     ticket.notas,
        estado:    ticket.estado
      })
    });
    const data = await res.json();
    setSyncStatus(data.status === 'ok' ? 'ok' : 'err');
    return data.status === 'ok';
  } catch {
    setSyncStatus('err');
    return false;
  }
}

async function loadFromSheet() {
  if (!CFG.url) { alert('Configura primero la URL de tu Web App.'); return; }
  setSyncStatus('syncing');
  try {
    const sheetName = encodeURIComponent(CFG.sheet || 'Incidencias');
    const res  = await fetch(`${CFG.url}?action=getAll&sheet=${sheetName}`);
    const data = await res.json();
    if (data.status === 'ok' && Array.isArray(data.rows)) {
      tickets = data.rows.map(r => ({
        id: r[0], fecha: r[1], hora: r[2], monitor: r[3], cod: r[4],
        bloque: r[5], tipoInc: r[6], tipo: r[7], desc: r[8],
        tecnico: r[9], motivo: r[10], ticketExt: r[11],
        horaFinal: r[12], duracion: r[13], notas: r[14], estado: r[15]
      }));
      saveLocal();
      setSyncStatus('ok');
      renderAll();
    } else {
      throw new Error('Respuesta inválida');
    }
  } catch {
    setSyncStatus('err');
    alert('Error al cargar datos desde Sheets. Verifica tu configuración.');
  }
}

async function testConnection() {
  if (!CFG.url) { alert('Primero guarda la URL de tu Web App.'); return; }
  setSyncStatus('syncing');
  try {
    const res  = await fetch(`${CFG.url}?action=ping`);
    const data = await res.json();
    if (data.status === 'ok') {
      setSyncStatus('ok');
      alert('✓ Conexión exitosa con Google Sheets.');
    } else {
      throw new Error();
    }
  } catch {
    setSyncStatus('err');
    alert('✗ No se pudo conectar. Verifica la URL y los permisos de tu Web App.');
  }
}
