# Workcycle Log - Sesión Actual

## 📋 Tarea: Panel de Control Manual de WhatsApp, Diagnóstico en Vivo y Desbloqueo de Estados
- **Objetivo:** 
  1. Agregar botón manual y visible para iniciar, reiniciar y detener el bot de WhatsApp con control absoluto del usuario.
  2. Proveer feedback visual en tiempo real de cada fase del motor (`DESCONECTADO`, `INICIANDO`, `ESPERANDO ESCANEO`, `GENERANDO CÓDIGO`, `CÓDIGO GENERADO`, `CONECTANDO...`, `BOT ONLINE`) para eliminar toda ambigüedad.
  3. Prevenir estados bloqueados (`GENERANDO CÓDIGO` persistente) cuando WhatsApp Web rechaza o agota el tiempo de vinculación telefónica por rate limiting de la línea.
- **Diagnóstico Realizado:**
  - Si WhatsApp Web respondía con error de rate limit (`t`) tras múltiples solicitudes de código telefónico seguidas para la misma línea, `requestPairingCode` caía en timeout de 40s y lanzaba una excepción.
  - Al lanzar la excepción, `currentStatus` permanecía en `'GENERANDO CÓDIGO'` indefinidamente sin resetearse a `'DESCONECTADO'`, impidiendo la emisión y visualización del código QR y dejando la interfaz bloqueada.
  - El usuario no disponía de un botón visible para encender o reiniciar manualmente el motor desde la barra superior, generando confusión sobre si el bot estaba activo o cargando.
- **Acciones Implementadas:**
  1. **Control de Estados en Backend (`server/whatsapp.js` & `server/index.js`):**
     - Se añadió protección en `activePairingPromise`: ante fallo o timeout, `currentStatus` se resetea inmediatamente a `'DESCONECTADO'`, `lastPairingCode = null` y se emite la actualización por Socket.io.
     - Se agregó protección a `startClient`: si el bot ya está en `'BOT ONLINE'`, no se reinicia a menos que se especifique `forceRestart = true` (evita matar sesiones activas).
     - Se crearon los métodos `restartClient()` y endpoint `/api/whatsapp/restart` para forzar cierre limpio y nuevo arranque en cualquier momento.
     - `stopClient()` limpia completamente referencias, códigos, temporizadores y procesos huérfanos.
  2. **Panel de Control Manual y Píldora Reactiva (`client/src/App.jsx`):**
     - **Top Bar:** Botón prominente `[▶️ INICIAR BOT]` en verde neón visible cuando el motor está detenido (`status === 'DESCONECTADO'`), con spinner animado durante el arranque y botón `[🔄 Reiniciar Bot]` cuando el bot está activo.
     - **Modal de Conexión:** Nuevo componente superior con indicador LED dinámico, título de estado, badge contextual (`ONLINE`, `INICIANDO`, `ESPERANDO ESCANEO`, `GENERANDO CÓDIGO`, `CÓDIGO LISTO`, `APAGADO`), explicación en lenguaje claro de lo que ocurre en el servidor y botones manuales de `[▶️ INICIAR BOT]`, `[🔄 Reiniciar]` y `[⏹️ Detener]`.
     - **Pestaña QR:** Vista informativa animada mientras el navegador inicia y botón manual para encender y generar QR si está detenido.
     - **Pestaña Teléfono:** Alerta explicativa clara ante bloqueo de rate limit de WhatsApp con botón directo `[📲 Vincular con QR ahora (Sin esperar)]`.
- **Resultado de Verificación:**
  - Compilado local y en VPS sin errores (153ms build time).
  - Verificado live endpoint `/api/whatsapp/status` en VPS: estado `'ESPERANDO ESCANEO'` con string QR emitido correctamente.
  - Interfaz web disponible en `http://149.50.128.73:8989` con los nuevos controles.
