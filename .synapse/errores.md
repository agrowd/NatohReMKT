# Registro de Errores y Soluciones

## ERR-01: Detached Frame / Navigation Execution Context Destroyed (2026-09-22)
**Síntoma:** Durante el envío masivo o al pausar/cancelar una campaña, los envíos fallaban masivamente con `Bot apagado` o `Attempted to use detached Frame`.
**Root Cause:** Puppeteer perdía la referencia del marco ejecutable en WhatsApp Web cuando la página recargaba o la sesión cambiaba de estado mientras el bucle de `sendMessage` en Node continuaba llamando a `client.sendMessage()`.
**Solución:** Validar `currentStatus === 'BOT ONLINE'` y verificar la integridad de la instancia del cliente antes de cada `sendMessage()`. Interrumpir inmediatamente la campaña activa si el bot pasa a `DESCONECTADO`.
**Estado:** ✅ FIXED

## ERR-02: No LID for user (2026-09-08)
**Síntoma:** Envíos fallaban para números que no tenían ID nativo mapeado por la versión de npm.
**Root Cause:** Cambios en la API de WhatsApp Web.
**Solución:** Actualizar `whatsapp-web.js` a la rama dev `#main` en GitHub e implementar retry con `client.getNumberId(to)`.
**Estado:** ✅ FIXED

## ERR-03: Data passed to getter must include an id property (2026-10-07)
**Síntoma:** Campaña masiva bloqueada en 0/1727 con errores en SQLite indicando `Data passed to getter must include an id property (it's how we memoize) but got undefined`.
**Root Cause:** Cambio en el JS interno de WhatsApp Web (memoización de getters en `Store.Chat`). Al intentar enviar mensajes a contactos exportados de VCF o Listas Virtuales que no tenían un chat activo cargado en la memoria DOM local de WhatsApp Web, `Store.Chat.get(chatId)` devolvía `undefined`.
**Solución:** Actualizar `whatsapp-web.js` a la última versión de `#main` en GitHub e implementar precarga y resolución con `client.getNumberId(to)` y `client.getChatById(targetId)` en `server/whatsapp.js` para forzar a WhatsApp Web a instanciar la estructura en `Store.Chat` antes de invocar `sendMessage`.
**Commit:** `d0be601`
**Estado:** ✅ FIXED
