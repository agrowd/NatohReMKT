# Historial de Conversación - 2026-05-27

## Requerimiento
Implementar la funcionalidad de búsqueda de una palabra clave dentro del historial de mensajes de 500+ chats activos (Escenario B) de forma segura y optimizada para remarketing.

## Análisis y Diseño
1. **Problema con la propuesta básica**: Iterar recursivamente sobre 500+ chats y hacer fetch paralelo de mensajes puede colgar la CPU del VPS, consumir excesiva RAM y provocar bloqueos de rate limit por parte de WhatsApp.
2. **Propuesta Premium**: 
   - Motor asíncrono con procesamiento en lotes y delay de `70ms` por chat.
   - Envío de progresos y matches al instante via WebSockets.
   - Pestaña de UI "Smart Search" en React.
   - Acciones de remarketing masivas: **Etiquetado Masivo** de todos los resultados con un click, **Respuesta Rápida** individual y **Etiquetado Individual**.

## Implementación
1. **Backend (`server/whatsapp.js`)**:
   - Agregada función `searchMessagesInHistory(query, chatLimit, messageLimit)`.
   - Agregada función `cancelSearch()` para abortar escaneo en curso.
   - Agregada función `bulkTagChats(chatIds, labelId)` para etiquetar asíncronamente en bloque.
2. **Backend Gateway (`server/index.js`)**:
   - Creados endpoints `POST /api/whatsapp/search-messages`, `POST /api/whatsapp/cancel-search`, `POST /api/whatsapp/bulk-tag` y `POST /api/whatsapp/send-direct`.
   - Actualizado `/status` para sincronizar búsquedas activas en recargas.
3. **Frontend (`client/src/App.jsx`)**:
   - Añadida pestaña lateral de búsqueda con icono de lupa (`Icon` de búsqueda).
   - Implementado buscador avanzado con inputs y dropdowns de control de límites.
   - Diseñado indicador de barra de progreso pulsing con socket en tiempo real.
   - Renderizados los chats coincidentes con acordeones interactivos y fragmentos de mensajes.
   - Controles de acción rápida: Respuesta rápida y etiquetado individual/masivo.

## Verificación y Pruebas
- El motor de procesamiento en segundo plano por lotes previene bloqueos de CPU y agiliza el remarketing masivo orgánicamente.
- Las tablas locales de SQLite se sincronizan al etiquetar masivamente para mantener la persistencia local.
