// ══════════════════════════════════════════
//  app.js — Punto de entrada, inicialización
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Fecha de hoy por defecto en el form
  const fechaInput = document.getElementById('f-fecha');
  if (fechaInput) fechaInput.value = todayISO();

  // Cargar config guardada
  loadConfig();

  // Render inicial
  renderAll();
});
