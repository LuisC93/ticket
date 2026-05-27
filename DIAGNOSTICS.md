# Análisis Detallado: Frontend ↔ Apps Script Communication

## 🔴 Problemas Identificados

### 1. **updateEstadoMonitor intenta actualizar hojas que pueden no existir**
**El Apps Script hace esto:**
```javascript
var sheet = ss.getSheetByName(nombreHoja);  // Busca hoja con nombre = "Jose Luis"
```
**Problema:** Si no existe una hoja individual para cada monitor, esto falla.

**Solución:** Cambié el frontend para que sea **no-bloqueante** (no detiene la creación del ticket si falla).

---

### 2. **El payload se envía correctamente pero podría haber ambigüedad**

**Frontend envía:**
```javascript
// Datos codificados así:
var payload = encodeURIComponent(JSON.stringify(data));
var url = CFG.url + '?payload=' + payload;
```

**Apps Script recibe:**
```javascript
const payload = e.parameter.payload || '';
const data = JSON.parse(decodeURIComponent(payload));
```

✅ **Esto está correcto**, pero el orden de parámetros en `sheetFetchWrite` es importante.

---

### 3. **Las columnas esperadas en handleAppend()**

El Apps Script espera 14 columnas en este ORDEN:
```
1. Fecha (ISO)
2. Hora
3. Monitor
4. COD (Código)
5. Bloque
6. Tipo Incidencia
7. Descripción
8. Tipo
9. Motivo
10. Técnico
11. Hora Final
12. Duración
13. Ticket Externo
14. Estado
```

**Frontend envía exactamente esto:**
```javascript
var row = [
  isoFromTicket(t.fecha),      // 1. Fecha
  t.hora,                      // 2. Hora
  t.monitor,                   // 3. Monitor
  t.cod,                       // 4. COD
  t.bloque,                    // 5. Bloque
  t.tipoInc,                   // 6. Tipo Incidencia
  t.desc,                      // 7. Descripción
  t.tipo,                       // 8. Tipo
  t.motivo,                    // 9. Motivo
  t.tecnico,                   // 10. Técnico
  t.horaFinal,                 // 11. Hora Final
  t.duracion,                  // 12. Duración
  t.ticketExt,                 // 13. Ticket Externo
  t.estado                     // 14. Estado
];
```

✅ **Esto está correcto.**

---

## 🔧 Cambios Realizados

### 1. `updateEstadoMonitor` ahora es NO-BLOQUEANTE
**Antes:**
```javascript
updateEstadoMonitor(t, false);  // Espera a que termine
```

**Ahora:**
```javascript
updateEstadoMonitor(t, false).catch(function(e) {
  console.warn('updateEstadoMonitor falló (no bloquea), continuando:', e);
});
```

✅ **Impacto:** Aunque la actualización del estado del monitor falle, el ticket SE GUARDARÁ correctamente.

### 2. Mejorado `sheetFetchWrite()` con reintentos
- 3 intentos por defecto
- 2 intentos para updateEstadoMonitor (menos crítico)
- Timeouts de 12 segundos
- Mejor logging

---

## 🧪 Cómo Diagnosticar

### 1. **Abre la Consola del Navegador (F12)**

### 2. **Crea un Ticket de Prueba**
- Monitor: Jose Luis
- Código: 12345
- Problema: Error de usuario
- Haz clic en "Registrar incidencia"

### 3. **Revisa los logs en la Consola:**

**Busca esto:**
```
updateEstadoMonitor iniciado para: {cod: "12345", monitor: "Jose Luis", ...}
```

**Si ves esto, todo funcionó:**
```
updateEstadoMonitor éxito: Jose Luis
```

**Si ves esto, el ticket se guardó pero el estado del monitor falló (NORMAL):**
```
updateEstadoMonitor falló (será reintentos automáticos): Jose Luis
```

**Si ves esto, el ticket NO se guardó (PROBLEMA):**
```
sheetFetchWrite: Falló después de 3 intentos
```

---

## 📋 Checklist para Verificar el Apps Script

El usuario debe verificar que en Google Apps Script:

- [ ] **El Script ID sea:** `AKfycbw9_MGNNS3DEoJGOHb9VclI3LY-ARwILy3GG8ohTGHfFPQ_6IqM8T8imys89w47VY91`
- [ ] **El SHEET_ID sea:** `1T9z7zVtb4CV-uH8uP5EL54FwyWeie8GKoxP0yAQkMhY`
- [ ] **Las hojas existan:**
  - [ ] 'Loocker Studio' (Monitoreo)
  - [ ] 'base general' (Base de datos)
  - [ ] 'SLA' (Tickets)
  - [ ] 'CFO SLA GENERAL' (CFO)
  - [ ] Hojas individuales para cada monitor (Jose Luis, Boris, etc.)
- [ ] **El Script esté publicado** (Deploy → New deployment)
- [ ] **CORS esté permitido** (en Apps Script settings)

---

## 🚀 Próximos Pasos

1. Abre F12 en tu navegador
2. Ve a "Nuevo"
3. Crea un ticket de prueba
4. Comparte aquí los logs que veas en la consola
5. Así podré ver exactamente dónde está el problema
