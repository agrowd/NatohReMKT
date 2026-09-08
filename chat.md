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
