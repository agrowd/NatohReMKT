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

## ERR-04: Error al detener campaña (2026-10-07)
**Síntoma:** Al presionar el botón "DETENER" en la interfaz, aparecía un cartel emergente con "Error al detener la campaña".
**Root Cause:** Si `activeCampaign` en memoria de Node ya se había vuelto `null` (porque el proceso de envío de mensajes había finalizado o sido interrumpido por un error de desconexión previo), el endpoint `POST /api/campaigns/stop` devolvía un código HTTP 400 (`No hay ninguna campaña activa`). El frontend Axios capturaba este status 400 como error no controlado.
**Solución:** Hacer el endpoint `POST /api/campaigns/stop` totalmente idempotente para que devuelva status 200 OK actualizando cualquier campaña en estado 'running' en SQLite a 'cancelled', emitiendo el evento `campaign_finished` por WebSockets y limpiando el estado React en `App.jsx`.
**Commit:** `424fff6`
**Estado:** ✅ FIXED

## ERR-05: Finalización inmediata en 1s con alerta falsa y cancelación por Detached Frame (2026-10-24)
**Síntoma:** Al seleccionar la lista virtual "Luz o Hifu" (742 contactos elegibles) y presionar enviar, a los pocos segundos la UI mostraba un cartel indicando "Campaña Finalizada! Todos los mensajes enviados", pero ningún mensaje salía hacia WhatsApp (0/742).
**Root Cause:**
1. Al ordenar por `last_sent_at ASC NULLS FIRST`, el contacto #1 en la cola era un contacto histórico con formato local inválido (`15409177996@c.us`).
2. Al intentar evaluar el chat de ese número, Puppeteer arrojaba `Attempted to use detached Frame`.
3. El bucle de `server/index.js` contenía `err.message.includes('detached Frame')` dentro de la condición de aborto crítico, provocando que un fallo en un único lead cancelara toda la campaña y rompiera el ciclo (`break`).
4. El backend emitía `campaign_finished` con `status: 'cancelled'`, pero el frontend escuchaba `campaign_finished` sin verificar `status`, mostrando el alert de éxito absoluto a pesar de haber enviado 0 mensajes.
**Solución:**
1. Desacoplamiento de fallos por contacto: En `startCampaignProcess`, si ocurre un error individual en un destinatario pero el bot sigue `BOT ONLINE`, se guarda el error en `logs`, se actualiza `last_sent_at` para que no bloquee futuros envíos al frente de la cola, y se continúa con el siguiente contacto.
2. Argumentos de Puppeteer anti-aislamiento de marcos (`--disable-features=IsolateOrigins,site-per-process`, `--disable-site-isolation-trials`, `--disable-gpu`) y limpieza de `SingletonLock`.
3. Normalizador automático de números telefónicos locales argentinos (`15...` -> `549...`) en backend, importación, resolución de campañas y migración de base de datos SQLite.
4. Distinción visual en el frontend entre campañas completadas y canceladas/interrumpidas.
**Estado:** ✅ FIXED

## ERR-06: Reseteo del código de vinculación al ingresar los 8 dígitos en el celular (2026-10-24)
**Síntoma:** Al generar el código de 8 dígitos para vincular con el teléfono e ingresarlo en WhatsApp en el celular, la pantalla del sistema web se devolvía de golpe al formulario inicial con el botón "GENERAR CÓDIGO DE 8 DÍGITOS" en lugar de completar la conexión.
**Root Cause:** Durante el handshake de vinculación por código, WhatsApp Web emite cambios internos de referencia de conexión (`change:ref`). El listener `client.on('qr')` en `server/whatsapp.js` no discriminaba el modo activo y ejecutaba `lastPairingCode = null` y `currentStatus = 'ESPERANDO ESCANEO'`, transmitiendo por socket el reseteo del código hacia la interfaz React antes de que se completara el handshake.
**Solución:**
1. Condicionar `client.on('qr')` en `server/whatsapp.js`: Si `currentStatus` es `BOT ONLINE` o si hay un código de vinculación telefónica activo (`lastPairingCode` o `CÓDIGO GENERADO`), se ignora el evento QR para no pisar el código ni el estado.
2. Escuchar `client.on('authenticated')`: Transiciona inmediatamente a `CONECTANDO...` informando que el celular aceptó los 8 dígitos.
3. UI feedback en `client/src/App.jsx`: Muestra un spinner animado *"¡Código ingresado en tu celular! Vinculando WhatsApp Web y cargando chats..."* hasta que llega el evento `ready` (`BOT ONLINE`).
**Estado:** ✅ FIXED

## ERR-07: Bloqueo de envíos por ProtocolTimeout CDP y Bucles Zombie de Campañas Concurrentes (2026-10-28)
**Síntoma:** El dashboard muestra que la campaña se está ejecutando, pero el contador de enviados en la barra superior se queda en 0. Los mensajes nunca llegan a los destinatarios en WhatsApp. En los logs de PM2 y base de datos, cada contacto arroja: `Runtime.callFunctionOn timed out. Increase the 'protocolTimeout' setting in launch/connect calls for a higher timeout if needed.`
**Root Cause:**
1. Cuando un destinatario tiene un formato telefónico corrupto (ej. prefijo duplicado `1111`) o no existe en WhatsApp, la función interna de WhatsApp Web `findOrCreateLatestChat` envía una consulta de red que nunca resuelve, dejando una promesa colgada en Chromium.
2. Puppeteer CDP excedía su timeout predeterminado de 30 segundos (`Runtime.callFunctionOn timed out`).
3. Al acumularse llamadas fallidas, loops de campañas previas (ej. campaña 95) continuaban iterando en segundo plano porque `startCampaignProcess` no verificaba que `activeCampaign.campaignId === campaignId`. Esto producía múltiples bucles asíncronos concurrentes que saturaban el hilo principal de Chromium.
**Solución:**
1. Pre-validación canónica (`resolveTargetChatId`): Antes de enviar, se consulta `client.getNumberId(...)` con timeout de 8s. Si el número no está registrado en WhatsApp o es inválido, se descarta limpiamente en <1s sin invocar `sendMessage`, evitando colgar WhatsApp Web.
2. `protocolTimeout: 60000` configurado en las opciones de Puppeteer.
3. Blindaje anti-bucles zombie en `startCampaignProcess`: Se valida `activeCampaign.campaignId === campaignId` y `status === 'running'` en cada iteración y delay. Al arrancar una campaña nueva, cualquier bucle previo se cancela inmediatamente.
4. Reparación en el normalizador de números para eliminar duplicados de prefijos (`1111` -> `11`).
5. Feedback visual claro en `App.jsx` si una campaña finaliza con 0 enviados debido a exclusión anti-spam o destinatarios no registrados.
**Estado:** ✅ FIXED

## ERR-08: Código de Vinculación Estancado al Regenerar (2026-10-29)
**Síntoma:** Al presionar "Re-generar código" en el modal de vinculación con teléfono, el sistema no cambiaba el código de 8 dígitos y seguía mostrando exactamente el mismo código expirado previo (ej. `GV52-AG6J`).
**Root Cause:** En `server/whatsapp.js`, `startClient` poseía la guarda `if (pairingPhoneNumber && lastPairingCode && currentStatus === 'CÓDIGO GENERADO') return;`. Al estar el estado en `'CÓDIGO GENERADO'` y existir `lastPairingCode`, `startClient` retornaba inmediatamente sin hacer nada, y `requestPairingCode` devolvía la variable `lastPairingCode` vieja en memoria sin solicitar nunca un nuevo código a WhatsApp Web.
**Solución:**
1. Eliminación de la guarda bloqueante en `startClient`.
2. Limpieza forzada de procesos huérfanos de Chromium y cerrojos (`SingletonLock`, `SingletonCookie`, `SingletonSocket`, `DevToolsActivePort`) mediante `terminateClient` y `cleanChromiumLocks`.
3. Feedback reactivo en `client/src/App.jsx`: Muestra un spinner animado *"GENERANDO NUEVO CÓDIGO..."* en el recuadro de dígitos mientras se espera la respuesta, garantizando que el usuario y el frontend vean la renovación inmediata sin volver bruscamente al formulario inicial.
**Estado:** ✅ FIXED

## ERR-09: Congelamiento de Inicialización y Caída por Unhandled Rejection (2026-10-29)
**Síntoma:** Al solicitar regeneración de código de vinculación o reiniciar el servidor, la API quedaba congelada en `GENERANDO CÓDIGO` o caía con `ECONNRESET`.
**Root Cause:**
1. Al reiniciar la instancia de Puppeteer, `client.destroy()` a menudo se bloqueaba por operaciones CDP colgadas. El timeout abandonaba la promesa sin enviar `SIGKILL`, dejando procesos huérfanos de Chromium que retenían los archivos de bloqueo en `sessions/session/`. Las nuevas instancias quedaban colgadas intentando bloquear el directorio.
2. Errores internos de WhatsApp Web (como el rechazo minificado `t` al solicitar vincularse cuando WhatsApp limita las solicitudes) provocaban un Unhandled Promise Rejection en Node 18, cerrando abruptamente la API.
3. El endpoint de despliegue ejecutaba `execSync('pm2 restart natoh-api')` dentro de su propio proceso, causando que PM2 mate el proceso y aborte la respuesta HTTP.
**Solución:**
1. Implementación de `terminateClient()` con timeout estricto, `proc.kill('SIGKILL')`, `pkill -9 -f "sessions/session"` en Linux y borrado físico de cerrojos `SingletonLock`.
2. Handlers globales `process.on('unhandledRejection')` y `process.on('uncaughtException')` en `server/index.js` para evitar caídas de Node por excepciones asíncronas de terceros.
3. Desacople del reinicio en `/api/admin/restart-api` y `/api/admin/build-ui` mediante `process.exit(0)` diferido tras responder al cliente HTTP.
**Estado:** ✅ FIXED

## ERR-10: Colisión Concurrente de Instancias de Chromium ("Attempted to use detached Frame") (2026-10-29)
**Síntoma:** Al intentar generar código repetidamente ("intente varias veces"), la interfaz arrojaba el error: "No se pudo obtener el código a tiempo. Si WhatsApp limitó los intentos...". En los logs de PM2 se evidenciaban errores: `Init Error: Error: Attempted to use detached Frame` y `Init Error: Error: Navigating frame was detached`.
**Root Cause:**
1. No existía mutex de concurrencia en `requestPairingCode` ni en `startClient`. Si el usuario hacía múltiples clics antes de que WhatsApp Web cargara (~10-15s), cada nuevo clic ejecutaba `terminateClient()`, matando el proceso de Chromium que la petición anterior estaba esperando en pleno `page.goto()`.
2. Al destruirse el navegador en cada intento, se invalidaba cualquier código previo de 8 dígitos recién generado, haciendo que en el celular apareciera "No se pudo vincular" y saturando a WhatsApp con solicitudes hasta que aplicaba rate limit (`t`).
**Solución:**
1. Implementación de mutex concurrente Single-Flight (`activePairingPromise`): todas las llamadas simultáneas comparten la misma promesa de arranque sin matar procesos en vuelo.
2. Reutilización de código activo vigente (`CODE_LIFETIME_MS = 140s`): si ya hay un código válido emitido y el cliente Chromium sigue en espera, se retorna inmediatamente sin reiniciar.
3. Bloqueo de doble clic en frontend (`disabled={isRequestingPairing}` + guarda `if (isRequestingPairing) return;`).
4. Botón de rescate directo en la alerta de rate limit: permite con 1 clic pasar a la pestaña QR y generar el código QR instantáneamente sin esperas.
**Estado:** ✅ FIXED
