// ══════════════════════════════════════════
//  tickets.js — Lógica de tickets (CRUD)
// ══════════════════════════════════════════

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function crearTicket() {
  const monitor = document.getElementById('f-monitor').value;
  const hora    = document.getElementById('f-hora').value;
  const tipo    = document.getElementById('f-tipo').value;

  if (!monitor || !hora || !tipo) {
    showFormAlert('alert-err', 'alert-ok', 'Completa los campos obligatorios: Monitor, Hora de inicio y Problema.');
    return;
  }

  ticketCounter++;

  const ticket = {
    id:        ticketCounter,
    fecha:     document.getElementById('f-fecha').value     || todayISO(),
    hora,
    monitor,
    cod:       document.getElementById('f-cod').value       || '—',
    bloque:    document.getElementById('f-bloque').value    || '—',
    tipoInc:   document.getElementById('f-tipo-inc').value,
    tipo,
    desc:      document.getElementById('f-desc').value      || '—',
    tecnico:   document.getElementById('f-tec').value       || 'Sin asignar',
    motivo:    document.getElementById('f-motivo').value    || '—',
    ticketExt: document.getElementById('f-ticket-ext').value|| '—',
    horaFinal: '',
    duracion:  '',
    notas:     '',
    estado:    'Abierto'
  };

  tickets.unshift(ticket);
  saveLocal();
  renderAll();

  const ok = await appendToSheet(ticket);
  if (ok) {
    showFormAlert('alert-ok', 'alert-err', `Ticket #${ticket.id} guardado en Google Sheets ✓`);
  } else {
    showFormAlert('alert-err', 'alert-ok', 'Guardado localmente. Sin conexión a Sheets.');
  }

  limpiarForm();
}

async function cerrarTicket() {
  if (activeTicketIdx === null) return;
  const t = tickets[activeTicketIdx];
  if (t.estado === 'Cerrado') return;

  t.horaFinal = document.getElementById('r-hora').value || '--:--';
  t.motivo    = document.getElementById('r-motivo').value;
  t.notas     = document.getElementById('r-notas').value;
  t.estado    = 'Cerrado';

  // Calcular duración
  if (t.hora && t.horaFinal && t.horaFinal !== '--:--') {
    const [h1, m1] = t.hora.split(':').map(Number);
    const [h2, m2] = t.horaFinal.split(':').map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins > 0) t.duracion = `${Math.floor(mins / 60)} h ${mins % 60} min`;
  }

  saveLocal();
  renderAll();

  const ok = await updateRowInSheet(t);

  const alertOk  = document.getElementById('d-alert-ok');
  const alertErr = document.getElementById('d-alert-err');
  if (ok) { alertOk.classList.add('show');  alertErr.classList.remove('show'); }
  else    { alertErr.classList.add('show'); alertOk.classList.remove('show'); }

  document.getElementById('resolve-section').style.display = 'none';
  document.getElementById('closed-msg').style.display      = 'block';

  setTimeout(closeDrawer, 2000);
}

function limpiarForm() {
  const ids = ['f-monitor','f-cod','f-hora','f-bloque','f-tipo-inc',
                'f-tipo','f-desc','f-tec','f-motivo','f-ticket-ext'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-fecha').value = todayISO();
}
