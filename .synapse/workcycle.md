# Workcycle Log - Sesión Actual

## 📋 Tarea Completada
- **Objetivo:** Resolver el problema donde al ingresar el código de vinculación de 8 dígitos en WhatsApp desde el celular, la pantalla del sistema devolvía al usuario al formulario inicial ("GENERAR CÓDIGO DE 8 DÍGITOS") en vez de completar la conexión a "BOT ONLINE".
- **Acciones Realizadas:**
  1. Diagnóstico de Logs en VPS (`/api/admin/vps-logs`):
     - Detectado que WhatsApp Web emite eventos `qr` (`change:ref`) en segundo plano mientras se vincula con código telefónico.
     - `server/whatsapp.js` escuchaba el evento `client.on('qr')` de forma no condicionada y reseteaba `lastPairingCode = null` y `currentStatus = 'ESPERANDO ESCANEO'`.
     - Esto provocaba que el frontend recibiera `pairingCode = null`, desmontando la pantalla con los 8 dígitos y re-mostrando el formulario previo de entrada.
  2. Blindaje de Eventos en el Backend (`server/whatsapp.js`):
     - Si el bot está en modo código (`lastPairingCode` activo o `currentStatus === 'CÓDIGO GENERADO'`), `client.on('qr')` ignora la sobreescritura del código y mantiene el estado.
     - Si el bot ya está en `BOT ONLINE`, ignora cualquier evento residual de QR.
     - Agregado listener `client.on('authenticated')` para notificar al instante cuando el celular acepta los 8 dígitos y poner el estado en `CONECTANDO...`.
     - `startClient()` ahora ejecuta `client.removeAllListeners()` antes de `client.destroy()` para evitar colisiones con instancias previas.
  3. Experiencia de Usuario en el Frontend (`client/src/App.jsx`):
     - Soporte para estado `CONECTANDO...`: Muestra un spinner animado informando *"¡Código ingresado en tu celular! Vinculando WhatsApp Web y cargando chats. Aguardá unos segundos..."*.
     - `socket.on('qr')` ya no resetea el modal si el usuario está en proceso de vinculación por teléfono.
     - Al completar la vinculación, transiciona suavemente a *"¡WhatsApp Conectado!"* y cierra el modal automáticamente.
