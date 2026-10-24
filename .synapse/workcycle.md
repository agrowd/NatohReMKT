# Workcycle Log - Sesión Actual

## 📋 Tarea Completada
- **Objetivo:** Resolver el problema donde al iniciar la campaña con la lista virtual "Luz o Hifu" se cancelaba inmediatamente en 1 segundo mostrando un cartel de finalización falsa sin enviar mensajes, protegiendo rigurosamente la sesión de WhatsApp activa.
- **Acciones Realizadas:**
  1. Diagnóstico de Logs en VPS (`/api/admin/vps-logs`):
     - Identificado que las campañas 90 y 91 fallaron en el primer contacto `15409177996@c.us` ("Claudiahifufacialjueves") debido a que Puppeteer arrojó `Attempted to use detached Frame`.
     - `server/index.js` contenía `err.message.includes('detached Frame')` dentro de la condición de aborto de campaña, provocando que un error en un único contacto cancelara toda la campaña (0/742).
     - El frontend `client/src/App.jsx` mostraba el alert de éxito absoluto al recibir `campaign_finished` sin validar `status === 'cancelled'`.
  2. Blindaje del Motor de WhatsApp (`server/whatsapp.js`):
     - Agregados flags de estabilidad a Puppeteer: `--disable-features=IsolateOrigins,site-per-process`, `--disable-site-isolation-trials`, `--disable-gpu`, `--disable-accelerated-2d-canvas`.
     - Implementada limpieza preventiva de `SingletonLock` de Chromium para evitar bloqueos tras reinicios.
     - Implementada normalización profunda de números telefónicos argentinos (`15...` -> `549...`) antes del envío.
     - En `sendMessage`, manejo con retry ante advertencias de detached frame y resolución alternativa de JID con `client.getNumberId()` y precarga con `client.getChatById()`.
  3. Desacoplamiento de Fallos por Lead (`server/index.js`):
     - Un fallo en un lead individual ya no cancela la campaña mientras el bot esté `BOT ONLINE`.
     - Se registra el error en `logs` (`status = 'error'`), se actualiza `contacts.last_sent_at` para rotar la cola y evitar que un contacto roto quede eternamente como #1 bloqueando la lista, se pausa 2s por resguardo y se continúa con el resto de la lista.
     - Función `normalizePhoneNumber` mejorada para Argentina.
     - Normalización de IDs al resolver contactos de listas virtuales.
  4. Migración de Base de Datos (`server/database.js`):
     - Migración automática al iniciar para normalizar contactos preexistentes en SQLite con prefijo `15...` a formato internacional `549...`.
  5. Interfaz de Usuario (`client/src/App.jsx`):
     - `socket.on('campaign_finished')` ahora distingue entre campañas completadas y canceladas/interrumpidas para no engañar al usuario.
  6. Compilación y Despliegue:
     - Rebuild de Vite (`npm run build` en cliente) exitoso.
     - Validación sintáctica de Node sin errores.
