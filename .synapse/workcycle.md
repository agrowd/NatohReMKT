# Workcycle Log - Sesión Actual

## 📋 Tarea: Solución a Bloqueo de Envíos, ProtocolTimeout CDP y Protección de Sesión WhatsApp
- **Objetivo:** Resolver el problema reportado por el usuario donde las campañas no incrementan el contador de enviados (queda en 0) y los mensajes no se entregan, protegiendo estrictamente la sesión activa de WhatsApp Web sin desconexiones.
- **Diagnóstico Realizado:**
  1. En los logs de PM2 y SQLite (`/api/admin/vps-logs`), cada intento de envío fallaba sistemáticamente con:
     `Runtime.callFunctionOn timed out. Increase the 'protocolTimeout' setting in launch/connect calls for a higher timeout if needed.`
  2. Búsqueda de destinatarios sin registrar o mal formateados: Cuando `client.sendMessage()` se invoca con números no registrados en WhatsApp o con prefijos alterados (ej. `5491111...`), el método interno `findOrCreateLatestChat()` de WhatsApp Web dispara consultas de red que nunca resuelven, dejando colgadas las promesas en Chromium.
  3. Bucles Zombie de Campañas: `startCampaignProcess` no verificaba que la campaña activa correspondiera a la suya (`activeCampaign.campaignId === campaignId`), permitiendo que loops de campañas anteriores (ej. campaña 95) continuaran corriendo en segundo plano indefinidamente y saturando el hilo de ejecución de Puppeteer.
- **Acciones Implementadas:**
  1. **Pre-validación Canónica (`resolveTargetChatId`) en `server/whatsapp.js`:**
     - Antes de enviar cualquier mensaje, se valida el número con `client.getNumberId(...)` con timeout de resguardo de 8s.
     - Si el número no existe en WhatsApp, se rechaza inmediatamente en <1s sin tocar `client.sendMessage()`, evitando colgar el DOM de WhatsApp Web.
     - Se resuelven variantes de prefijos argentinos (con 9 y sin 9).
     - Si está registrado, devuelve el WID canónico garantizado.
  2. **Timeout de Seguridad y `protocolTimeout: 60000`:**
     - Se configuró `protocolTimeout: 60000` en Puppeteer.
     - Se encapsuló `client.sendMessage` en `Promise.race` con timeout de 35s para evitar bloqueos perpetuos.
  3. **Blindaje Anti-Bucles Zombie en `server/index.js`:**
     - `startCampaignProcess` valida `!activeCampaign || activeCampaign.campaignId !== campaignId || activeCampaign.status !== 'running'` antes de cada contacto, paso de mensaje y delay.
     - Al arrancar una campaña en `/api/campaigns`, cualquier campaña previa se cancela formalmente y se espera a que su bucle finalice.
  4. **Corrección de Normalización Telefónica:**
     - Eliminación de prefijos duplicados `1111` y corrección de la longitud de números locales en `normalizePhoneNumber` y `normalizePhoneRecipient`.
  5. **Mejora en Notificaciones de UI (`client/src/App.jsx`):**
     - Si una campaña finaliza sin envíos (0 mensajes), informa claramente si se debió a la regla de exclusión anti-spam o números no registrados en WhatsApp, en vez de emitir alertas engañosas.
