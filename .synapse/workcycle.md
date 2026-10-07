# Workcycle Log - Sesión Actual

## 📋 Tarea Actual
- **Objetivo:** Resolver el bloqueo del envío masivo de mensajes que muestra 0/1727 en la UI.
- **Acciones Realizadas:**
  1. Consulta directa a `/api/admin/vps-logs` en la IP `149.50.128.73:3001`.
  2. Detección del error raíz: `Data passed to getter must include an id property (it's how we memoize) but got undefined`.
  3. Diagnóstico: Cambio interno en WhatsApp Web (Octubre 2026) en la función de memoización de getters de chats/contactos en `Store.Chat` cuando un contacto de agenda (VCF/Lista Virtual) no tiene chat activo cargado en la memoria local de WhatsApp Web.
  4. Actualización de `whatsapp-web.js` a la última revisión de la rama `#main` en GitHub.
  5. Implementación de fallback con `client.getChatById` y `client.getNumberId` en `server/whatsapp.js` para forzar la carga previa del chat en `Store.Chat` antes de invocar `client.sendMessage()`.
