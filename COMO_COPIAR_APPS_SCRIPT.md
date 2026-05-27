# 📝 Cómo Copiar el Código Mejorado al Google Apps Script

## ✅ Pasos:

### 1. **Abre Google Apps Script**
- Ve a [script.google.com](https://script.google.com)
- O desde Google Drive: **Nuevo** → **Google Apps Script**

### 2. **Busca tu Proyecto**
- Busca el proyecto que tiene el SHEET_ID: `1T9z7zVtb4CV-uH8uP5EL54FwyWeie8GKoxP0yAQkMhY`
- Abre ese proyecto

### 3. **Selecciona el archivo `Code.gs`**
- En el panel izquierdo, haz clic en `Code.gs`

### 4. **Elimina TODO el código actual**
- `Ctrl+A` (selecciona todo)
- `Delete` (elimina)

### 5. **Copia el código nuevo**
- Abre el archivo `APPS_SCRIPT_MEJORADO.txt` (en tu carpeta de ticket)
- Copia TODO el contenido (Ctrl+A → Ctrl+C)

### 6. **Pega en Apps Script**
- En Google Apps Script, en el editor vacío
- Pega (Ctrl+V)

### 7. **Guarda**
- `Ctrl+S` o haz clic en **Guardar**
- Verás un mensaje: "Proyecto guardado"

### 8. **Despliega (Deploy)**
- Haz clic en **Deploy** → **New deployment**
- Selecciona **API Executable** (tipo)
- Haz clic en **Deploy**
- Copia la URL nueva que aparece
- Esta es tu nueva **URL del Web App**

---

## 🔄 Si ya tienes un Deploy anterior:

Si ya tienes una URL publicada, puedes:

**Opción A: Reutilizar la URL (Recomendado)**
1. Haz clic en **Deploy** → **Manage deployments**
2. Busca el deployment anterior (tipo "API Executable")
3. Edítalo (icono de lápiz)
4. Haz clic en **Redeploy**
5. Copia la URL (ya tienes la misma)

**Opción B: Crear un nuevo Deploy**
1. Haz clic en **Deploy** → **New deployment**
2. Tipo: **API Executable**
3. Copia la URL nueva
4. **IMPORTANTE:** Actualiza `config.js` en tu aplicación con esta URL

---

## 🔍 Cambios principales en el código:

1. ✅ **Mejor logging** - Verás mensajes claros de qué está pasando
2. ✅ **updateEstado es no-bloqueante** - No detiene si falla
3. ✅ **Mejor manejo de errores** - Si falta una hoja, lo indica pero continúa
4. ✅ **Validaciones mejoradas** - Verifica que los datos sean correctos
5. ✅ **Tolerancia a cambios de nombre** - Detecta hojas aunque varíe mayúscula/minúscula

---

## ✨ Después de copiar:

Tu aplicación debería funcionar mejor porque:
- El append (crear ticket) es **completamente independiente** de updateEstado
- Si falla actualizar el estado del monitor, el ticket se guarda igualmente
- Tendrás logs claros si algo falla

---

## 📌 URL del Google Apps Script:
```
https://script.google.com/home/projects/[TU_PROJECT_ID]/edit
```

Si necesitas la URL, búscala en:
1. **Deploy** → **Manage deployments**
2. Allí verás la URL del Web App

