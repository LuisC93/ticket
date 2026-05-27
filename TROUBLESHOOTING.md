# Guía de Resolución de Problemas - Conexión Google Sheets

## ✅ Cambios Realizados

### 1. Eliminado archivo duplicado (auth.js)
- **Problema**: auth.js se cargaba al final y sobrescribía las funciones de sheets.js con código antiguo
- **Solución**: Removido de index.html

### 2. Mejorada función de escritura a Google Sheets
- **Problema**: sheetFetchWrite() no reintentaba en caso de fallo
- **Solución**: Ahora tiene:
  - Reintentos automáticos (3 intentos)
  - Timeout de 12 segundos por intento
  - Mejor manejo de errores

### 3. Corregido formulario de código
- **Problema**: Había dos atributos `oninput` conflictivos
- **Solución**: Consolidados en un solo atributo

## 🔍 Cómo Verificar que Funciona

### Paso 1: Abre el navegador (F12) → Consola
1. Ve a la página
2. Presiona F12 para abrir Developer Tools
3. Ve a la pestaña "Console"

### Paso 2: Prueba la conexión
1. Haz clic en "⚙ Configurar" en la página
2. Verifica que la URL de Google Sheets esté configurada
3. Haz clic en "Probar" para probar la conexión
4. Deberías ver: **"Conexión exitosa ✓"**

### Paso 3: Crea un ticket de prueba
1. Ve a "Nuevo" en el menú
2. Completa los campos:
   - **Monitor**: Jose Luis (o cualquiera)
   - **Código**: 12345 (exactamente 5 dígitos)
   - **Problema**: Selecciona uno
3. Haz clic en "Registrar incidencia"
4. Deberías ver: **"Guardado en Google Sheets ✓"**

## ⚠️ Si Aún Hay Errores

### Error: "Sin conexión"
**Causas posibles:**
1. URL de Google Sheets no está configurada
2. Google Apps Script está deshabilitado
3. Sin acceso a internet
4. Bloqueo de CORS

**Qué hacer:**
- Abre la consola (F12) y revisa los mensajes de error
- Busca "sheetFetchWrite" en la consola
- Los logs dirán exactamente qué falló

### Error: "El código debe tener exactamente 5 dígitos"
**Causa:** El código necesita ser numérico y tener exactamente 5 dígitos
**Ejemplo válido:** 10441, 12345, 99999

### El ticket se guarda localmente pero no en Sheets
**Esto es normal** - si no hay conexión a Google Sheets:
1. Se guarda en el navegador automáticamente
2. La próxima vez que haya conexión, se sincroniza automáticamente
3. Los cambios pendientes aparecen en la cola

## 📋 Archivos Modificados
- `index.html` - Removido script de auth.js, corregido campo de código
- `js/sheets.js` - Mejorada función sheetFetchWrite()

## 🔧 Para Desarrolladores
Si necesitas revisar los logs detallados:
1. Abre la consola (F12)
2. Busca mensajes que comiencen con "sheetFetchWrite"
3. Muestran exactamente qué intentó, cuántos reintentos, y por qué falló
