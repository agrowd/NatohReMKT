# Registro de Errores y Soluciones

## ERR-01: Detached Frame / Navigation Execution Context Destroyed (2026-09-22)
**Síntoma:** Durante el envío masivo o al pausar/cancelar una campaña, los envíos fallaban masivamente con `Bot apagado` o `Attempted to use detached Frame`.
**Root Cause:** Puppeteer perdía la referencia del marco ejecutable en WhatsApp Web cuando la página recargaba o la sesión cambiaba de estado mientras el bucle de `sendMessage` en Node continuaba llamando a `client.sendMessage()`.
**Solución:** Validar `currentStatus === 'BOT ONLINE'` y verificar la integridad de la instancia del cliente antes de cada `sendMessage()`. Interrumpir inmediatamente la campaña activa si el bot pasa a `DESCONECTADO`.
**Estado:** 🟡 IN PROGRESS

## ERR-02: No LID for user (2026-09-08)
**Síntoma:** Envíos fallaban para números que no tenían ID nativo mapeado por la versión de npm.
**Root Cause:** Cambios en la API de WhatsApp Web.
**Solución:** Actualizar `whatsapp-web.js` a la rama dev `#main` en GitHub e implementar retry con `client.getNumberId(to)`.
**Estado:** ✅ FIXED
