# Workcycle Log - Sesión Actual

## 📋 Tarea: Sincronización Real de Favoritos de WhatsApp (Contador 0 a 2)
- **Objetivo:**
  1. Corregir el problema por el cual en el panel lateral de etiquetas WhatsApp la lista "Favorites" mostraba contador `0` pese a que en la aplicación de WhatsApp del teléfono existían 2 contactos marcados como favoritos.
  2. Lograr que los 2 contactos favoritos se sincronicen en SQLite (`label_members` para `label_id = '2'`), se visualicen con `Favorites: 2` en la UI y puedan ser seleccionados como destinatarios de campañas sin fallos.
- **Diagnóstico Realizado:**
  - En WhatsApp Web moderno, "Favorites" (ID de filtro nativo `'2'`) **no es una etiqueta de negocio común**: no almacena sus miembros en `labelItemCollection` de la etiqueta. Por eso, el método estándar `label.getChats()` de `whatsapp-web.js` devolvía un array vacío `[]` (0 chats).
  - Mediante inspección en tiempo real por CDP sobre el navegador de WhatsApp Web en el VPS, se descubrió que WhatsApp guarda los favoritos en la colección interna `WAWebCollections.FavoriteCollection`.
  - Dicha colección contenía exactamente los 2 modelos de favoritos correspondientes a los contactos del usuario:
    - Contacto 1: `@federicoromero8` (`167954796826725@lid`, teléfono `5491126642674@c.us`)
    - Contacto 2: `Nextemarketing.com` (`98256587624560@lid`, teléfono `5491157351676@c.us`)
  - Además, los contactos de WhatsApp Web moderno utilizan identificadores de usuario `@lid`. Los métodos previos `normalizePhoneRecipient` y `resolveTargetChatId` alteraban estos IDs o fallaban al buscar números en `getNumberId` porque los trataban como números estándar de Argentina en vez de identificadores nativos de chat ya existentes en el navegador.
- **Acciones Implementadas:**
  1. **Extracción Especializada vía `FavoriteCollection` (`server/whatsapp.js`):**
     - Se creó la función `getFavoriteChatsFromWhatsApp()`, que consulta `WAWebCollections.FavoriteCollection` y cruza los modelos con `Chat` y `Contact` para extraer nombre, número de teléfono y WID.
     - Se integró esta función dentro de `syncLabelsAndMembers()`, `getContactsByLabel(labelId)` y `deepSyncLabels()` para la etiqueta con ID `'2'` o cuyo nombre contenga `'favorit'`.
  2. **Compatibilidad Nativa con Identificadores `@lid` y `@g.us` (`server/whatsapp.js`):**
     - En `normalizePhoneRecipient`, se añadió una guarda para preservar intactos los identificadores `@lid` y `@g.us`.
     - En `resolveTargetChatId`, se añadió verificación directa en WhatsApp Web (`window.WWebJS.getChat` / `WAWebWidFactory`) antes de intentar consultas telefónicas, permitiendo enviar mensajes fluidamente a contactos con identificador LID.
  3. **Auto-Sincronización en Evento `ready` (`server/whatsapp.js`):**
     - Al conectar el bot y entrar en estado `BOT ONLINE`, se dispara automáticamente `syncLabelsAndMembers()` y se emite la lista de etiquetas con sus contadores reales a la interfaz vía Socket.io.
- **Resultado de Verificación:**
  - Código desplegado y comprobado en el VPS de producción (`149.50.128.73`).
  - Consulta a `/api/labels?sync=true`:
    ```json
    { "id": "2", "name": "Favorites", "memberCount": 2 }
    ```
  - Consulta a `/api/campaigns/preview-audience` con `labelIds: ["2"]`:
    ```json
    { "total": 2, "excluded": 0, "eligible": 2, "exclusionPeriod": "60d" }
    ```
  - La interfaz en `http://149.50.128.73:8989` ahora muestra **Favorites con 2 miembros** y los reconoce al seleccionarla para campañas.
