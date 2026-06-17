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

## Historial de Conversación - 2026-06-10

### Requerimiento
El usuario reporta que la etiqueta "hifu 2" tiene contactos en su teléfono pero en la interfaz web del CRM muestra "0". 

### Análisis y Diagnóstico
WhatsApp Web no siempre carga las membresías de todas las etiquetas nativas en memoria de forma inmediata. Dado que el CRM antes solo calculaba el conteo localmente basándose en la tabla de SQLite `label_members`, cualquier etiqueta nueva o recientemente editada en el celular aparecía con 0 en la base de datos local hasta que se hiciera una sincronización profunda. El botón "Sincronizar" solo consultaba la API local sin forzar la lectura del cliente.

### Solución
1. **whatsapp.js**: Se agregó la función asíncrona `syncLabelsAndMembers` que consulta dinámicamente a la API de WhatsApp Web (`getLabels()` y `label.getChats()`), actualiza/limpia la tabla `label_members` y retorna el listado fresco.
2. **index.js**: Se modificó `/api/labels` para admitir el parámetro `?sync=true`, ejecutando el proceso en el backend.
3. **App.jsx**:
   - Se modificó el botón "Sincronizar" del top bar. Ahora ejecuta `fetchLabels(true)`, el cual hace un request a `/api/labels?sync=true`.
   - Se agregó un estado `isSyncingLabels` para inhabilitar el botón y mostrar visualmente el estado "Sincronizando..." con una animación CSS de giro en el icono de refresco.

## Historial de Conversación - 2026-06-11

### Requerimiento
Implementar "Listas Virtuales" y un importador de archivos de contactos VCF (.vcf) y CSV (.csv) para evadir los límites nativos de WhatsApp Web (límite de etiquetas, contactos no reconocidos por falta de chats activos, desduplicación de contactos).

### Análisis y Diseño
1. **Listas Virtuales**: Listas locales no dependientes de etiquetas en el teléfono de WhatsApp, administradas en la base de datos local SQLite.
2. **Parser de Agenda**:
   - Parseo de archivos VCF unfolding de líneas largas.
   - Decodificación UTF-8 para nombres en Quoted-Printable (usados frecuentemente por teléfonos Android).
   - Normalización robusta de números argentinos (elimina prefijo local "15" móvil e inyecta el prefijo internacional "549" dependiendo del largo del dígito).
   - Detección automática de delimitadores en archivos CSV e índices de nombres/teléfonos para soporte universal.
3. **Desduplicación y Campañas**:
   - Clave única compuesta en SQLite para evitar duplicados en la base de datos local.
   - Algoritmo de desduplicación de contactos por ID único en el motor de campañas. El motor ahora acepta tanto etiquetas nativas como listas virtuales para el envío y garantiza un único mensaje por destinatario.
   - Soporte para auto-limpieza (autoRemove) tanto de etiquetas como de listas virtuales.

### Implementación
1. **Backend (`server/index.js`)**:
   - Creadas funciones auxiliares de decodificación y parseo VCF/CSV.
   - Creados endpoints `GET /api/virtual-lists`, `POST /api/virtual-lists`, `DELETE /api/virtual-lists/:id`, `POST /api/virtual-lists/bulk-add`, `POST /api/contacts/import-vcf` y `GET /api/contacts/search`.
   - Modificados endpoints `/api/campaigns` y `startCampaignProcess` para integrar las Listas Virtuales y la auto-limpieza.
2. **Frontend (`client/src/App.jsx`)**:
   - Añadida sección de Listas Virtuales en el Sidebar (creación y eliminación rápida).
   - Modificado el método `startCampaign` para enviar tanto `labelIds` como `virtualListIds`.
   - Creado componente UI de subida y arrastre de archivos (.vcf / .csv) dentro de la pestaña de "Smart Tagging" que permite asociar directamente los contactos a una Lista Virtual local.

### Verificación y Pruebas
- Frontend compilado exitosamente sin errores de sintaxis en Vite.
- Backend verificado con syntax checker de Node.js.

## Historial de Conversación - 2026-06-17

### Requerimiento
El usuario reporta que el importador VCF estaba mal distribuido al estar metido dentro de la pestaña de Smart Tagging. Solicita mover el importador de archivos VCF/CSV a un apartado/pestaña específica e independiente, agregando la funcionalidad de crear la lista virtual directamente al importar, aplicar filtros por palabra clave en el nombre (ej: "luz pulsada") y realizar un chequeo de exclusión contra la base de datos para no añadir a la lista a contactos que ya hayan recibido mensajes en campañas anteriores.

### Análisis y Diseño
1. **Reorganización de UI**: Se quitó la sección de importación de la pestaña "Smart Tagging" y se creó una pestaña dedicada "Importador VCF/CSV" (Icono de clip).
2. **Importación Dinámica y Filtros**:
   - El formulario de importación ahora permite escribir el nombre de una nueva Lista Virtual para ser creada en el acto y asociarle los contactos importados.
   - Añadido un campo opcional para ingresar una palabra clave de filtrado (ej: "luz pulsada"). Solo los contactos cuyo nombre contenga dicho texto serán asignados a la lista.
   - Añadido control visual ("Exclusión Inteligente") para consultar las bitácoras históricas en la tabla `logs` (donde `status = 'sent'`) y descartar a contactos que ya fueron procesados con anterioridad.

### Implementación
1. **Backend (`server/index.js`)**:
   - Actualizada la API `POST /api/contacts/import-vcf` para recibir y procesar los parámetros `listName`, `filterQuery` y `excludeSent`.
   - Incorporada la lógica de creación automática de Listas Virtuales, filtrado case-insensitive de nombres de contacto, y exclusión por consulta cruzada a los registros de campañas.
2. **Frontend (`client/src/App.jsx`)**:
   - Agregada la pestaña `vcf-import` a la barra de navegación lateral.
   - Diseñado el panel completo del importador con controles estructurados para subida de archivos, nombre de lista a crear/asociar, filtro de coincidencia por palabra y exclusión anti-spam.
   - Integradas las llamadas de red axios a los nuevos parámetros del backend.

### Verificación y Pruebas
- Verificada la compilación exitosa del frontend client localmente (`dist/assets/index...js` y `css`).
- Verificado el backend index.js sin fallos de parser de Node.

