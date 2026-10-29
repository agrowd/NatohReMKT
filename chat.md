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

## Historial de Conversación - 2026-06-29

### Requerimiento
Agregar un botón en la interfaz de usuario para poder detener/cancelar de inmediato una campaña de envío masivo activa.

### Análisis y Diseño
1. **Endpoint de Cancelación**: Se añadió una API en el backend para marcar la campaña activa en ejecución como `cancelled`.
2. **Interrupción Inmediata en el Engine**:
   - Para evitar que el backend siga procesando envíos y esperando retrasos largos (que pueden llegar a 90 segundos entre contactos), se diseñó la función `delayWithCancelCheck` que divide el tiempo de espera en microintervalos de 500ms.
   - Si la campaña se marca como `cancelled`, la función despierta de inmediato al bucle y aborta la campaña de forma segura, actualizando su estado a `cancelled` en SQLite y notificando al frontend por Sockets.
3. **Botón en Interfaz Web**: Se colocó un botón de parada ("DETENER") de color rojo en la barra superior junto al monitor de progreso de la campaña, solicitando confirmación del usuario para prevenir clics accidentales.

### Implementación
1. **Backend (`server/index.js`)**:
   - Creado endpoint `POST /api/campaigns/stop` que actualiza el estado en SQLite y marca la campaña activa como cancelada.
   - Creada función `delayWithCancelCheck` y agregados los checks de salida en el motor de campañas.
2. **Frontend (`client/src/App.jsx`)**:
   - Modificado el panel de progreso en el top bar para incluir un botón "DETENER" con llamada POST y confirmación.

### Verificación y Pruebas
- Compilado del frontend exitoso y verificación de sintaxis de Node OK.

## Historial de Conversación - 2026-07-08

### Requerimiento
El usuario coloca un archivo de contactos VCF pesado llamado `contacts2.vcf` (con más de 9400 contactos) en la raíz del proyecto. Solicita crear un proceso que analice este archivo, busque todos los contactos cuyos nombres contengan "luz" o "hifu", los agrupe en una única lista virtual local que pueda ser seleccionada desde la interfaz web, y descarte automáticamente a todos los contactos a los que ya se les haya enviado algún mensaje en campañas previas (cruzando los datos con los logs históricos de la base de datos).

### Análisis y Diseño
1. **Script de Importación Directo (`server/import-special-list.js`)**:
   - Para evitar retardos, caídas por límite de subida HTTP o bloqueos de red en el navegador con un archivo VCF tan pesado (1.7 MB), la mejor vía es un script de Node que corra directo en la consola del servidor Debian.
   - El script abre `contacts2.vcf`, unfoldea las líneas, decodifica texto Quoted-Printable (típico de contactos exportados de celulares) y normaliza los teléfonos celulares argentinos eliminando el prefijo local "15" y forzando el código de país internacional "549".
2. **Criterios de Filtro y Exclusión**:
   - El script filtra de forma case-insensitive aquellos nombres que tengan el término `luz` o `hifu`.
   - Lee todos los registros con estado `sent` en la tabla `logs` de SQLite y los carga en un `Set` para una consulta de exclusión O(1) instantánea.
   - Crea/asocia la lista virtual local "Luz o Hifu" y vincula los miembros aptos en la base de datos.
3. **Privacidad y Limpieza Git**:
   - Se añadió la regla `contacts2.vcf` en `.gitignore` para prevenir subir la agenda privada del cliente de forma pública en GitHub.

### Implementación
1. **Script de Consola (`server/import-special-list.js`)**:
   - Programado el flujo de lectura de archivos, parser de vCards, cruce en base de datos SQLite y resúmenes estadísticos en consola.

### Verificación y Pruebas
- Se ejecutó el script localmente con éxito, procesando los 9425 contactos del archivo VCF en menos de 7 segundos y detectando 3493 coincidencias.
- **Diagnóstico del error "No LID for users":** Los logs en el servidor indicaron fallos masivos debido a la falta de mapeo de LIDs en la API interna de WhatsApp Web.
- **Resolución:** Se actualizó la dependencia de `whatsapp-web.js` en `package.json` para apuntar directamente a su rama oficial de desarrollo en GitHub (`github:wwebjs/whatsapp-web.js#main`), asegurando compatibilidad con los cambios recientes implementados por Meta en WhatsApp.
- **Lógica de exclusión de 7 días y control UI:**
  - Se actualizó el script `server/import-special-list.js` y la API de importación de contactos en `server/index.js` para filtrar el historial de logs a los últimos 7 días (`created_at > datetime('now', '-7 days')`), permitiendo importar contactos que no hayan recibido mensajes en la última semana.
  - Se integró soporte en el motor de campañas de la API para admitir la propiedad `config.exclusionPeriod` (valores: `none`, `48h`, `7d`, `ever`).
  - Se reemplazó el checkbox de "Memoria Infinita" en `client/src/App.jsx` por un menú desplegable de selección de período de exclusión anti-spam para mayor versatilidad.

## Historial de Conversación - 2026-09-08

### Requerimiento
Adaptar la estrategia de mensajería del bot para responder a las nuevas solicitudes comerciales de la estética:
1. Reemplazar el enfoque antiguo de sólo "HIFU facial y luz pulsada".
2. Incorporar tratamientos reductores y para celulitis: **HIFU Corporal** y **Exilis** con esquema de precios de 1 zona por $75.000 y 2 zonas por $90.000.
3. Incluir **Depilación Definitiva** como tratamiento complementario.
4. Diseñar la campaña bajo la Opción 1 (secuencia de 2 bloques con variantes anti-bloqueo) y dejarla precargada en el sistema bajo el nombre **EnvioAntigravity** para que aparezca directamente seleccionable en la barra lateral de flujos guardados.

### Implementación
1. **Modelado de Flujo Secuencial con Variantes**:
   - **Bloque 1**: Tratamientos reductores y celulitis (HIFU Corporal & Exilis Ultra) con 3 variantes de texto redactadas persuasivamente.
   - **Bloque 2**: Depilación definitiva láser y llamado a la acción hacia Corrientes 1466, también con 3 variantes de texto.
2. **Carga y Persistencia Automática**:
   - Actualizado `server/database.js` para inicializar/actualizar automáticamente el flujo `EnvioAntigravity` en la tabla `flows` al arrancar el backend.
   - Creado script `server/seed-flow-antigravity.js` para seeding manual o verificación de flujo.
   - El flujo queda disponible en el sidebar "Flujos Guardados" de la aplicación web y carga los bloques y variantes con un solo click.

### Verificación
- Verificado script `seed-flow-antigravity.js` ejecutado en Node con éxito e insertado en la base de datos local SQLite.
- Verificada la sintaxis de `server/index.js` y `server/database.js`.

### Diagnóstico de Campaña en Servidor VPS (149.50.128.73)
- **Problema Reportado:** El usuario indica que lanzó la campaña pero en la interfaz web no se ve enviando mensajes.
- **Hallazgos:**
  1. Conexión SSH establecida con éxito al VPS.
  2. La Campaña 64 fue ejecutada con éxito pero finalizó en 15 segundos.
  3. De los 1,727 contactos de la lista `[V] Luz o Hifu`:
     - **1,673 contactos fueron saltados (`skipped`)**: Ocurrió porque el navegador tenía en memoria el filtro "Para siempre" (`ever`), y todos esos contactos habían recibido mensajes el 28 de agosto (hace 11 días). Al tener activo el filtro permanente, la base de datos los omitió a todos de forma instantánea.
     - **54 contactos fallaron con `No LID for user`**: Se trataba de números mal guardados o sin cuenta de WhatsApp activa.
  4. Dado que el 100% de la lista fue procesada entre saltados y errores en menos de 15 segundos, `activeCampaign` volvió a `null`, ocultando la barra de progreso en el front.
- **Acciones Correctivas:**
  1. Configuración por defecto de la ventana de exclusión en `7d` (7 días) tanto en el front (`client/src/App.jsx`) como en el motor backend (`server/index.js`). Como los envíos anteriores fueron el 28 de agosto (hace 11 días), ahora la lista de 1,673 contactos queda completamente habilitada para el nuevo envío de `EnvioAntigravity`.
  - Mejora en `client/src/App.jsx` para que el selector de exclusión use `7d` (1 semana) por defecto y la barra de progreso reporte en vivo tanto mensajes enviados como contactos excluidos en tiempo real.
  3. Tratamiento de error en `server/whatsapp.js` para capturar `No LID` y clasificarlo limpiamente como contacto sin cuenta de WhatsApp o mal formateado.

## Historial de Conversación - 2026-09-08 (Subdominio y Reverse Proxy)

### Requerimiento
Configurar el subdominio `remarketing.nextemarketing.com` apuntando a la IP del VPS (`149.50.128.73`), delimitando con total claridad qué debe hacer el usuario y qué resuelve el agente.

### Análisis y Arquitectura
- El dominio raíz `nextemarketing.com` delega sus DNS en DonWeb (`ns1.donweb.com`, `ns2.donweb.com`). La creación del registro tipo A debe realizarse en el panel de control del registrador de dominio.
- En el servidor Debian, el sistema corre en dos procesos PM2 independientes:
  - `natoh-ui`: puerto local `8989` (Frontend Vite/React compilado estático).
  - `natoh-api`: puerto local `3001` (Backend Express, Socket.io y almacenamiento de uploads).
- Para unificar ambos bajo el puerto estándar 80/443 sin exponer puertos directos ni tener problemas de Mixed Content / CORS, se requiere un Reverse Proxy Nginx.

### Implementación Realizada por el Agente (Servidor VPS)
1. **Configuración VirtualHost Nginx**:
   - Creado `/etc/nginx/sites-available/remarketing.nextemarketing.com` con proxy_pass a `127.0.0.1:8989` para la raíz, y a `127.0.0.1:3001` para `/api/`, `/socket.io/` (con cabeceras `Upgrade` y `Connection`) y `/uploads/`.
   - Habilitado enlace simbólico en `/etc/nginx/sites-enabled/`.
   - Validada sintaxis con `nginx -t` y recargado Nginx.
2. **Ajuste Frontend Dinámico (`client/src/App.jsx`)**:
   - Ajustada la constante `API_URL` para que cuando el frontend se ejecute a través del dominio o proxy inverso utilice directamente `window.location.origin`, manteniendo la compatibilidad local/puerto directo en desarrollo.
   - Compilado el cliente en producción (`npm run build`) y reiniciados los procesos PM2 `natoh-ui` y `natoh-api`.

### Tarea Realizada por el Usuario (Panel DonWeb)
- Creado registro **Tipo A**: `remarketing` -> `149.50.128.73` (propagado correctamente).

### Despliegue de SSL y Verificación Final
1. Se comprobó la resolución DNS en Windows con `Resolve-DnsName` confirmando IP `149.50.128.73`.
2. Se conectó por SSH al servidor VPS y se ejecutó Certbot:
   - Certificado Let's Encrypt generado exitosamente para `remarketing.nextemarketing.com`.
   - Nginx actualizado automáticamente con redirección forzosa de HTTP a HTTPS.
3. Se verificaron las respuestas con curl:
   - `https://remarketing.nextemarketing.com` -> 200 OK (carga frontend estático React).
   - `https://remarketing.nextemarketing.com/api/whatsapp/status` -> 200 OK (responde Express API).
   - Archivos estáticos en `/assets/` -> 200 OK.
4. El sistema queda 100% operativo en su subdominio seguro.

## Historial de Conversación - 2026-09-08 (Acceso Directo y Experiencia Mobile)

### Requerimiento
1. Eliminar el login de usuario y contraseña para ingresar directamente al sistema.
2. Hacer que el código QR sea mucho más fácil y rápido de escanear.
3. Optimizar y acomodar la interfaz para su uso fluido y cómodo desde celulares.

### Análisis y Solución
1. **Acceso Directo**:
   - Eliminada la pantalla de login condicional en `client/src/App.jsx`. El usuario se inicializa automáticamente con rol administrador (`admin`), permitiendo uso libre e inmediato de todas las funciones sin contraseñas.
   - Eliminado botón de logout innecesario y reemplazada la sección de credenciales en configuración por una tarjeta informativa del sistema.
2. **Escaneo de QR Optimizado**:
   - Reemplazada la etiqueta `img` que dependía de una API externa (`api.qrserver.com`) por el componente local SVG `react-qr-code`. El QR se genera instantáneamente en milisegundos sin latencia ni dependencia de terceros.
   - Encapsulado en una tarjeta blanca de alto contraste con esquinas redondeadas para que la cámara del celular enfoque y lea el código en menos de un segundo.
   - Creación de un **Modal de Escaneo** que se abre automáticamente cuando el bot solicita vinculación o al tocar la píldora de estado en la barra superior.
   - Inclusión de guía paso a paso visual (Menú > Dispositivos vinculados > Vincular dispositivo) y botones de regeneración rápida.
3. **Diseño Mobile-First (Celulares <= 768px)**:
   - **Barra Inferior Fija**: La barra de navegación lateral se transforma en una barra inferior de fácil acceso con el pulgar, distribuyendo las pestañas uniformemente.
   - **Constructor de Campañas Adaptativo**: Se incorporó un selector de pestañas móvil ("Mensajes" vs "Destinatarios") para evitar que el usuario deba desplazarse por cientos de contactos y listas para editar el mensaje.
   - **Formularios e Inputs**: Las franjas de delays y límites pasan de 2 columnas rígidas a 1 columna flexible con áreas táctiles ampliadas (mínimo 44px de altura).
   - **Buscador Inteligente**: Layout apilado verticalmente en smartphones.

### Despliegue y Verificación
- Compilación en Vite local completada con éxito (`dist/assets/index-DHY75V__.js` y `index-Dr3eevhI.css`).
- Subida a GitHub (`main`) y desplegado en el VPS (`cd /srv/NatohReMKT && git pull && cd client && npm install && npm run build && pm2 restart natoh-ui`).
- Verificado estado `200 OK` en producción bajo `https://remarketing.nextemarketing.com`.

## Historial de Conversación - 2026-09-14 (Vinculación WhatsApp por Número de Teléfono / Pairing Code)

### Requerimiento
El cliente tiene problemas para conectar el bot mediante el código QR (WhatsApp en el móvil indica que "no está disponible"). Se consulta si es posible conectar directamente mediante el número de teléfono.

### Solución Técnica
1. **Investigación e Integración de API Nativa:**
   - `whatsapp-web.js` cuenta de forma nativa con el método `requestPairingCode(phoneNumber, showNotification = true, intervalMs = 180000)` y el evento `code` (`Events.CODE_RECEIVED`).
   - Se verificó su presencia tanto en el entorno local como en el VPS remoto de producción.
2. **Backend (`server/whatsapp.js` & `server/index.js`):**
   - Agregada variable de estado `lastPairingCode` expuesta en `getStatus()`.
   - Registrado listener `client.on('code', (code) => { ... })` con emisión en tiempo real por Socket.io (`pairing_code`).
   - Creada función sanitizadora `sanitizePairingNumber(raw)` que normaliza números argentinos (agrega prefijo internacional 549, remueve 15 intermedio o 0 inicial) y números de otros países a sólo dígitos.
   - Implementada función `requestPairingCode(phoneNumber)` y `cancelPairingCode()`.
   - Expuestos endpoints `POST /api/whatsapp/pair-phone` y `POST /api/whatsapp/cancel-pair-phone`.
3. **Frontend React (`client/src/App.jsx` & `client/src/index.css`):**
   - Incorporado selector tipo pestaña en el modal de conexión y en la vista de Conexión: `[ 📷 Escanear QR ]` y `[ 📱 Vincular con Teléfono ]`.
   - En la pestaña de teléfono:
     - Formulario simple donde el usuario ingresa su número móvil.
     - Botón "GENERAR CÓDIGO DE 8 DÍGITOS" con estado de carga.
     - Tarjeta de alto contraste con tipografía monoespaciada para el código de 8 dígitos generado (`ABCD - 1234`).
     - Botón de 1-tap para copiar el código al portapapeles.
     - Instrucciones claras paso a paso para introducir el código en la app de WhatsApp del celular (*Menú ⋮ / Configuración ⚙️ > Dispositivos vinculados > Vincular un dispositivo > "¿Vincular con el número de teléfono?"*).
   - Banner superior flotante actualizado para avisar de la disponibilidad de ambos métodos de vinculación.

## Historial de Conversación - 2026-09-15 (Arquitectura Nativa de Vinculación por Código)

### Requerimiento / Problema
El usuario reporta que al hacer clic en "GENERAR CÓDIGO DE 8 DÍGITOS", aparece el mensaje *"El navegador de WhatsApp aún está iniciando sus servicios"*, solicitando mejorar la arquitectura de inicio para que el bot se conecte nativamente por código de teléfono.

### Diagnóstico e Investigación
1. **Incompatibilidad de Alternancia Dinámica:**
   - WhatsApp Web inicializa internamente su protocolo de comunicación en modo QR (`initializeQRLinking`) si el cliente se arranca sin especificar previamente el número de teléfono.
   - Intentar forzar `startAltLinkingFlow` en caliente sobre un navegador iniciado para QR provoca desincronización en los módulos `window.AuthStore` y errores como `window.require is not a function` o `CompanionHelloError`.
2. **Confirmación de la API Nativa de `whatsapp-web.js`:**
   - Se probó experimentalmente arrancar el cliente con la opción nativa `pairWithPhoneNumber: { phoneNumber: '...', showNotification: true }` en la instanciación de `new Client(...)`.
   - Resultado: WhatsApp Web inicia limpiamente en modo Vinculación por Teléfono, sin errores de `window.require`, emitiendo instantáneamente el evento nativo `client.on('code', (code) => ...)` con el código de 8 dígitos (`DX9RKWKZ`).

### Solución Implementada
1. **Backend (`server/whatsapp.js`):**
   - Modificada la función `startClient(pairingPhoneNumber)` para admitir un número de teléfono.
   - Si se proporciona un número, instanciar `new Client({ ..., pairWithPhoneNumber: { phoneNumber: cleanNumber, showNotification: true, intervalMs: 180000 } })`.
   - Captura nativa del evento `client.on('code', (code) => { ... })` y emisión en tiempo real por Socket.io.
   - En `requestPairingCode(phoneNumber)`: se reinicia el cliente con la configuración nativa de teléfono y se aguarda la emisión del código. Si el cliente ya está conectado, retorna estado online.
2. **Compilación y Git:**
   - Verificada la compilación local del bundle Vite (`npm run build`).
   - Cambios subidos a GitHub (`origin/main`).


## Historial de Conversación - 2026-10-07 (Resolución de Bloqueo de Envíos en Campaña Masiva)

### Requerimiento
El usuario indica que el envío masivo se quedó trabado en 0/1727 (475 excluidos) en la interfaz web y no envía mensajes a las personas, solicitando revisar los logs del servidor VPS.

### Diagnóstico y Causa Raíz
1. Se consultó en tiempo real el endpoint del servidor VPS `http://149.50.128.73:3001/api/admin/vps-logs`.
2. Se detectaron múltiples entradas de error en la base de datos de SQLite `logs`:
   `Data passed to getter must include an id property (it's how we memoize) but got undefined`
3. **Mecanismo de Falla:** Meta realizó cambios internos en el paquete JS de WhatsApp Web (`gromeMe_cpc.js`) relacionados con la memoización de getters en `Store.Chat`. Cuando la campaña intenta enviar un mensaje a un contacto importado de VCF o Listas Virtuales que no posee un chat previamente instanciado en la memoria local DOM del cliente de WhatsApp Web, `Store.Chat.get(chatId)` retorna `undefined`, lo que hace colapsar la función de memoización de WhatsApp Web.

### Solución Implementada
1. **Actualización de Dependencias:**
   - Se actualizó el paquete `whatsapp-web.js` en `server/package.json` a la última revisión de la rama `#main` en GitHub.
2. **Backend (`server/whatsapp.js`):**
   - Se reestructuró la función `sendMessage` para interceptar errores de tipo `Data passed to getter`, `memoize`, `undefined` o `No LID`.
   - En caso de falla, ejecuta una precarga explícita mediante `client.getNumberId(to)` y `client.getChatById(targetId)`. Esto invoca `Store.Chat.find(chatId)` en WhatsApp Web, poblando el chat en `Store.Chat` antes de proceder al envío.
3. **Endpoint de Auto-Deploy (`server/index.js`):**
   - Creado endpoint `POST /api/admin/deploy-update` para permitir actualizaciones automatizadas sin fricción.
4. **Git:**
   - Cambios commiteados y pusheados a GitHub (`origin/main`, commit `d0be601` y `f683d91`).


## Historial de Conversación - 2026-10-15 (Exclusión Anti-Spam de 2 Meses y Cola Inteligente de Destinatarios)

### Requerimiento
El usuario solicita agregar una opción para evitar enviar mensajes a personas que ya hayan recibido uno en los últimos 2 meses (60 días), que el sistema lo calcule dinámicamente si tienen envíos previos y que se guarde de forma permanente en la base de datos SQLite, dado que el cliente reporta que con frecuencia se le envía mensajes a los mismos contactos.

### Diagnóstico de la Causa Raíz
1. **Período de Exclusión Corto:** El sistema anteriormente utilizaba por defecto una ventana de 7 días. Tras 7 días, los primeros contactos de la lista volvían a ser elegibles.
2. **Iteración Sin Ordenamiento Equitativo:** Las listas virtuales y etiquetas seleccionaban los contactos en su orden natural de inserción (`rowid`). Al enviar en lotes diarios (ej. 50 o 150 contactos) o reiniciar campañas, el bucle procesaba invariablemente a los primeros 50 o 150 contactos de la lista, dejando desatendidos a los contactos del fondo (1000+).
3. **Falta de Cálculo Previsto:** La interfaz no mostraba el cálculo de cuántos contactos estaban excluidos vs disponibles antes de presionar enviar.

### Solución Implementada
1. **Esquema de Base de Datos SQLite (`server/database.js`):**
   - Agregadas las columnas `last_sent_at DATETIME` y `sent_count INTEGER DEFAULT 0` a la tabla `contacts`.
   - Creados índices `idx_contacts_last_sent`, `idx_logs_contact_sent` y `idx_logs_created_at` para acelerar el cálculo a O(1).
   - Agregada columna `config TEXT` a la tabla `campaigns` para registrar los parámetros anti-spam usados en cada ejecución.
   - Creada tabla `settings (key, value, updated_at)` con el valor inicial `exclusionPeriod = '60d'`.
   - Implementado backfill automático que analiza la tabla histórica `logs` e inicializa `last_sent_at` y `sent_count` para todos los contactos que ya recibieron mensajes.
2. **Motor de Campañas y Endpoints (`server/index.js`):**
   - Incorporada la opción de exclusión `'60d'` / `'2m'` (`datetime('now', '-60 days')`) como valor por defecto y recomendado.
   - Implementada función `resolveContactsForCampaign` con ordenamiento inteligente: `ORDER BY last_sent_at ASC NULLS FIRST`. Los contactos que nunca recibieron mensajes van primero, seguidos de los que los recibieron hace más tiempo.
   - Creado endpoint `POST /api/campaigns/preview-audience` para calcular en tiempo real los contactos totales, excluidos y disponibles antes y durante el lanzamiento.
   - Creados endpoints `GET /api/settings` y `POST /api/settings` para sincronizar la configuración con la base de datos.
   - Al concretar cada envío exitoso, se actualiza en SQLite: `UPDATE contacts SET last_sent_at = CURRENT_TIMESTAMP, sent_count = sent_count + 1 WHERE id = ?`.
3. **Frontend UI (`client/src/App.jsx`):**
   - Agregada la opción "🌟 Evitar si se envió en los últimos 2 meses (60 días) [Recomendado]" en el selector anti-spam.
   - Diseñada tarjeta interactiva "Audiencia Calculada" que informa en vivo: Total en lista, Excluidos por fecha y Listos para enviar.
   - Sincronización bidireccional entre LocalStorage y el backend SQLite para que la preferencia quede guardada permanentemente.

## Historial de Conversación - 2026-10-24 (Resolución de Finalización Inmediata en 1s y Cancelación por Detached Frame)

### Requerimiento
El usuario reporta: "Selecciono la lista virtual de luz o hifu, me da como resultado que esta para enviarle a x cantidad de personas, pongo enviar y en un segundo me dice que ya se envio, que puede ser? trata de proteger la sesion".

### Diagnóstico de la Causa Raíz
1. **Logs en Producción (`/api/admin/vps-logs`):**
   - Se revisaron las campañas 90 y 91 creadas hoy para la lista virtual "Luz o Hifu" (742 contactos elegibles).
   - En ambas campañas, en el primer contacto `15409177996@c.us` ("Claudiahifufacialjueves"), Puppeteer arrojó el error:
     `Attempted to use detached Frame 'D815534E1F0A891536AF0D6DF1AA274D'`.
2. **Aborto Prematuro del Bucle en el Motor (`server/index.js`):**
   - En `startCampaignProcess`, el bloque catch contenía `err.message.includes('detached Frame')` dentro de la condición de aborto fatal. Por lo tanto, el fallo en ese único lead provocaba que `activeCampaign.status = 'cancelled'` y se ejecutara un `break` inmediato, cancelando la campaña con 0 mensajes enviados.
3. **Falsa Alarma en el Frontend (`client/src/App.jsx`):**
   - Al cancelarse la campaña, el backend emitía `campaign_finished` con `{ status: 'cancelled' }`.
   - El socket listener en `App.jsx` ejecutaba incondicionalmente: `alert('🚀 ¡Campaña Finalizada! Todos los mensajes han sido enviados o procesados exitosamente.')`, dando la falsa impresión de que se había completado en 1 segundo.
4. **Contacto #1 Inválido en la Cola:**
   - Debido al ordenamiento inteligente `last_sent_at ASC NULLS FIRST`, el contacto Claudia (con formato local `15409177996@c.us` y `last_sent_at` nulo) quedaba invariablemente en la posición #1 de la cola en cada intento.
5. **Configuración de Puppeteer en VPS Headless:**
   - Chromium carecía de los flags `--disable-features=IsolateOrigins,site-per-process`, `--disable-site-isolation-trials` y `--disable-gpu`, lo que facilitaba que subframes o iframes en WhatsApp Web se desprendieran durante llamadas de evaluación.

### Solución Implementada
1. **Desacoplamiento de Fallos por Lead (`server/index.js`):**
   - Modificado el bloque `catch` para que los errores en contactos individuales (números rotos, detached frame o timeouts) NO cancelen la campaña mientras el bot continúe en `BOT ONLINE`.
   - El error se registra en `logs` con estado `'error'`, se actualiza `contacts.last_sent_at = CURRENT_TIMESTAMP` para que ese número pase al final de la cola y no obstruya a los demás contactos, se pausa 2s por resguardo y se continúa con el siguiente lead.
   - Sólo si el bot pasa a estar desconectado o el usuario pulsa "Detener" se interrumpe la campaña.
2. **Estabilidad y Blindaje de WhatsApp Web (`server/whatsapp.js`):**
   - Incorporados flags de Chromium anti-desprendimiento de marcos: `--disable-features=IsolateOrigins,site-per-process`, `--disable-site-isolation-trials`, `--disable-gpu`, `--disable-accelerated-2d-canvas`.
   - Limpieza preventiva de `SingletonLock` de Chromium al iniciar para prevenir errores de "The browser is already running" tras reinicios de PM2.
   - En `sendMessage`, reintento automático tras 1500ms si ocurre una advertencia de frame, seguido de resolución profunda de ID con `client.getNumberId()` y precarga con `client.getChatById()`.
3. **Normalización de Teléfonos Argentinos (`database.js`, `index.js`, `whatsapp.js`):**
   - Normalizador unificado que transforma formatos locales como `1540917796` o `15...` a formato internacional oficial `549...`.
   - Migración automática en SQLite al arrancar el servidor para actualizar contactos preexistentes guardados con `15%@c.us`.
4. **Notificaciones Claras en el Frontend (`client/src/App.jsx`):**
   - `campaign_finished` ahora evalúa `data.status`: informa si la campaña fue detenida/interrumpida o si finalizó exitosamente.

### Segunda Consulta: Reseteo de Pantalla al Ingresar el Código de 8 Dígitos en el Celular
- **Problema:** Al ingresar el código de 8 caracteres en WhatsApp en el celular, la pantalla del sistema web devolvía inmediatamente al usuario al formulario previo ("GENERAR CÓDIGO DE 8 DÍGITOS") en lugar de conectar.
- **Causa Raíz:** `server/whatsapp.js` escuchaba el evento `client.on('qr')` que WhatsApp Web disparaba internamente durante el handshake y ejecutaba `lastPairingCode = null` y `currentStatus = 'ESPERANDO ESCANEO'`, transmitiendo por socket el reseteo del código hacia la interfaz React antes de que se completara el handshake.
- **Solución:**
  1. `client.on('qr')` ahora ignora eventos si el bot ya está en `BOT ONLINE` o si hay un código telefónico activo (`lastPairingCode` / `CÓDIGO GENERADO`).
  2. Implementado `client.on('authenticated')` que pone el estado en `CONECTANDO...`.
  3. `client/src/App.jsx` muestra pantalla de transición *"¡Código ingresado en tu celular! Vinculando WhatsApp Web y cargando chats..."* hasta llegar a `BOT ONLINE`.

### Verificación en Vivo (Campaña 92 Activa)
- Bot conectado con éxito (`BOT ONLINE`).
- La campaña 92 se encuentra actualmente en estado `running`.
- Envíos exitosos confirmados en tiempo real (ej. `Ingridluzpulsada` a las 17:42:29 y `Blancaluzpulsada Pereyra` a las 17:44:25).
- El bucle avanza respetando los tiempos de resguardo estipulados (60-90 segundos entre destinatarios y 15-30 segundos entre pasos del flujo).

---

## Sesión: Solución a Bloqueo de Envíos, ProtocolTimeout CDP y Bucles Zombie (2026-10-28)

### Consulta del Usuario
"No se están enviando los mensajes, revisa, me dice que se envían pero arriba no aparece el contador de enviados ni nada. Revisa bien todo, tiene que funcionar sin perder la sesión de WhatsApp y enviar los mensajes"

### Diagnóstico de la Falla
1. **Error en Logs:** En SQLite y PM2, todos los contactos en campañas 94, 95 y 96 arrojaban:
   `Runtime.callFunctionOn timed out. Increase the 'protocolTimeout' setting in launch/connect calls for a higher timeout if needed.`
2. **Causa Raíz Principal:** Al llamar a `client.sendMessage()` directamente para números no registrados o con prefijos corruptos (ej. `5491111...`), el método interno de WhatsApp Web `findOrCreateLatestChat` quedaba esperando indefinidamente una respuesta del servidor de WhatsApp que nunca llegaba.
3. **Causa Secundaria (Bucles Zombie):** `startCampaignProcess` no verificaba que la campaña en ejecución correspondiera al ID activo (`activeCampaign.campaignId === campaignId`), permitiendo que loops huérfanos continuaran intentando enviar mensajes concurrentemente y saturaran el protocolo CDP de Puppeteer.

### Soluciones Implementadas
1. **Pre-validación Canónica (`resolveTargetChatId`) en `server/whatsapp.js`:**
   - Pre-chequeo con `client.getNumberId(...)` (timeout 8s). Si el número no está en WhatsApp, se descarta limpiamente en <1s sin tocar `sendMessage` ni colgar Chromium.
   - Variantes para prefijos argentinos (`549...` y `54...`).
   - Envío protegido con `Promise.race` y timeout de 35s.
   - `protocolTimeout: 60000` en opciones de Puppeteer.
2. **Blindaje Anti-Bucles Zombie (`server/index.js`):**
   - Validación estricta de `activeCampaign.campaignId === campaignId` y `status === 'running'` en cada iteración del bucle, pasos y delays.
   - Cancelación automática e inmediata de campañas previas al iniciar una nueva en `/api/campaigns`.
3. **Corrección de Normalización:**
   - Corrección en `normalizePhoneNumber` y `normalizePhoneRecipient` para evitar duplicaciones `1111`.
4. **Claridad en Frontend (`client/src/App.jsx`):**
   - Notificación diferenciada si una campaña finaliza sin nuevos envíos debido a exclusión anti-spam o destinatarios no registrados.
   - Protección total de `server/sessions/` para mantener la sesión de WhatsApp Web intacta.

---

## Sesión: Solución a Código de Vinculación Estancado al Regenerar (2026-10-29)

### Consulta del Usuario
"No me aparece otro codigo cuando pongo regenerar y se quedo en ese, revisa y solucionalo que el cliente me esta pidiendo" (Adjunta captura con código `GV52-AG6J`).

### Diagnóstico de la Falla
1. En `server/whatsapp.js`, la función `startClient()` contenía una condición preventiva:
   `if (pairingPhoneNumber && lastPairingCode && currentStatus === 'CÓDIGO GENERADO') return;`
2. Cuando el usuario pulsaba "Re-generar código", `currentStatus` ya era `'CÓDIGO GENERADO'` y `lastPairingCode` tenía el código anterior.
3. Esto hacía que `startClient()` retornara inmediatamente sin hacer nada, y `requestPairingCode()` devolvía el mismo código anterior en memoria sin solicitar nunca un nuevo código a WhatsApp Web.

### Soluciones Implementadas
1. **Remoción de Guarda Bloqueante (`server/whatsapp.js`):**
   - Se removió el retorno anticipado que impedía volver a generar códigos.
2. **Generación en Caliente con `client.requestPairingCode()`:**
   - Si la instancia de Chromium ya está activa, se utiliza directamente el método nativo de WhatsApp Web para generar un nuevo código en 1-2 segundos sin recargar la página.
   - Se limpia `lastPairingCode` antes de solicitar el nuevo código para garantizar un código fresco.
3. **Indicador Visual Reactivo (`client/src/App.jsx`):**
   - Al pulsar "Re-generar código", el cuadro de dígitos muestra inmediatamente un spinner animado *"GENERANDO NUEVO CÓDIGO..."* hasta que llega el nuevo código.
   - El botón "Cambiar número" ahora cancela la solicitud activa en el backend vía `/api/whatsapp/cancel-pair-phone`.
4. **Gestión Robusta de Procesos y Cerrojos de Chromium (`terminateClient` + `cleanChromiumLocks`):**
   - Timeout de 2s para el cierre de Puppeteer con fallback a `SIGKILL` y `pkill -9 -f "sessions/session"` en Linux.
   - Limpieza automática de cerrojos (`SingletonLock`, `SingletonCookie`, `SingletonSocket`, `DevToolsActivePort`) para evitar bloqueos tras reinicios.
5. **Blindaje de la API en Node.js:**
   - Handlers globales para `unhandledRejection` y `uncaughtException`.
   - Reinicio de PM2 desacoplado mediante `process.exit(0)` diferido, evitando fallos por subprocesos muertos.
6. **Mantenimiento del Estado de la Interfaz:**
   - La vista de vinculación telefónica mantiene el recuadro con el spinner de carga sin volver bruscamente al formulario inicial gracias a `(pairingCode || isRequestingPairing)`.
7. **Protección Mutex Single-Flight contra Clics Múltiples:**
   - Se implementó `activePairingPromise` y `isStartingClient` para evitar la colisión de navegadores que provocaba `Attempted to use detached Frame`.
   - Reutilización de código activo por 140 segundos para no destruir la sesión mientras el usuario la ingresa en el celular.
   - Botón directo de rescate a Código QR cuando WhatsApp limita las solicitudes telefónicas.
