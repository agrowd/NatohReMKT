# Workcycle

## Sesión: 2026-05-06
- [x] Inicialización de Ariadne Engine
- [x] Planificación de arquitectura (Feedback: Flow Secuencial + Media)
- [x] Setup de proyecto (Frontend & Backend)
- [x] Implementación de Backend Core (WhatsApp + SQLite + Sockets)
- [x] Implementación de Frontend Premium (Flow Builder + QR + Monitor)
- [x] Script de setup para VPS (Debian)
- [x] Implementación de Spintax (Ban prevention)
- [x] UI de Gestión de Flows Guardados
- [x] Vista de Logs y Analíticas
- [x] Push a GitHub (agrowd/NatohReMKT)

## Sesión: 2026-05-27 (Actual)
- [x] Análisis del Escenario B: Búsqueda de palabras clave en el historial de mensajes de 500+ chats.
- [x] Diseño de una propuesta premium ("Smart Search & Tagging") para optimizar rendimiento y añadir valor de remarketing.
- [x] Aprobación del usuario recibida.
- [x] Implementación de Búsqueda Segura por lotes (Delays de 70ms + streaming Socket.io) en el Backend.
- [x] Implementación de API de Búsqueda, Cancelación y Bulk Tagging.
- [x] Desarrollo de la interfaz gráfica "Smart Search" en Vite + React con controles avanzados y barra de progreso.
- [x] Soporte para respuestas rápidas y etiquetado individual/masivo.
- [x] Push exitoso a GitHub (main -> main) con todos los cambios implementados y documentados.
## Sesión: 2026-06-02 (Actual)
- [x] Análisis del límite de 250 contactos de búsqueda y etiquetas de WhatsApp.
- [x] Diseño de propuestas alternativas: Etiquetas Virtuales, Auto-Splitting y Chat Harvesting.
- [x] Presentación de opciones al usuario para su aprobación.
- [x] Implementación y despliegue del filtro de exclusión de contactos que ya tienen envíos exitosos (`status = 'sent'`) en `tagContactsByQuery` y `bulkTagChats`.
## Sesión: 2026-06-10
- [x] Diagnóstico de desincronización de etiquetas recién agregadas en el teléfono (caso "hifu 2").
- [x] Implementación de función `syncLabelsAndMembers` en backend para consultar dinámicamente las etiquetas y sus chats en WhatsApp Web.
- [x] Actualización de la ruta `GET /api/labels` con soporte para query parameter `?sync=true`.
- [x] Modificación de la UI agregando loader con animación giratoria en el botón "Sincronizar" del top bar.

## Sesión: 2026-06-11
- [x] Implementación de decodificador Quoted-Printable y normalización robusta de teléfonos celulares de Argentina (remoción de prefijo "15" intermedio, agregado de "549").
- [x] Desarrollo de parsers locales para archivos VCF (vCard) y CSV.
- [x] Implementación de APIs para CRUD de Listas Virtuales locales y bulk linking en base de datos.
- [x] Modificación del endpoint `/api/campaigns` para unificar y desduplicar contactos entre etiquetas de WA y Listas Virtuales.
- [x] Actualización de interfaz React agregando gestión de Listas Virtuales (creación/eliminación) en el Sidebar.
- [x] Integración del panel de carga e importación de archivos de agenda (.vcf / .csv) dentro del área de Smart Tagging.

## Sesión: 2026-06-17
- [x] Solución de conflicto de merge con `server/natoh.db` en el VPS (agregado a `.gitignore` y quitado del trackeo de git).
- [x] Creación de una pestaña dedicada "Importador VCF/CSV" (Icono de clip) separando el importador de la pestaña de Smart Tagging.
- [x] Modificación del endpoint `/api/contacts/import-vcf` para admitir creación automática de listas por nombre (`listName`), filtro por palabra clave en el nombre (`filterQuery`) y exclusión de contactos ya contactados (`excludeSent`).
- [x] Diseño de UI premium en React para el importador con barra de arrastre, entrada para nombre de lista, entrada de filtro opcional por palabra clave, y control visual de exclusión anti-spam.

## Sesión: 2026-06-29
- [x] Desarrollo del endpoint `POST /api/campaigns/stop` en backend para permitir detener campañas activas.
- [x] Implementación de la función `delayWithCancelCheck` en el engine backend para abortar de inmediato las demoras entre mensajes y envíos.
- [x] Integración de un botón "DETENER" de color rojo con ventana de confirmación en la UI React (top bar) junto a la barra de progreso de envíos.

## Sesión: 2026-07-08
- [x] Creación del script de backend `server/import-special-list.js` para parsear, filtrar y agrupar contactos del archivo VCF pesado `contacts2.vcf` directamente en el servidor Debian.
- [x] Filtro combinado de palabras clave ("luz" o "hifu") en una única lista virtual local llamada "Luz o Hifu".
- [x] Cruce y exclusión automática en base de datos local SQLite para ignorar contactos a los que ya se les haya enviado mensajes con éxito (`status = 'sent'`).
- [x] Actualización de `.gitignore` para omitir y no subir el archivo `contacts2.vcf` pesado con datos reales al repositorio público.
- [x] Creación del script `server/view-campaign-logs.js` para diagnosticar en caliente por qué finalizan rápido las campañas.
- [x] Actualización de la dependencia whatsapp-web.js a github:wwebjs/whatsapp-web.js#main en package.json para corregir el error crítico 'No LID for users' provocado por los cambios recientes en WhatsApp Web.
- [x] Cambio de la lógica de exclusión para usar un filtro de 7 días (1 semana) en lugar de exclusión permanente por defecto, tanto en importaciones de archivos de agenda como en el motor de campañas.
- [x] Rediseño de la interfaz de configuración de campañas en React para reemplazar el checkbox de 'Memoria Infinita' por un selector dropdown que permite escoger el período de exclusión (No excluir, 48 horas, 7 días, Permanente).

## Sesión: 2026-09-08 (Actual)
- [x] Adaptación de la estrategia de copywriting para la clínica estética según requerimiento del cliente:
  - Foco en reducción y celulitis con HIFU Corporal y Exilis (1 zona $75.000 / 2 zonas $90.000).
  - Integración de Depilación Definitiva con cupos limitados y CTA hacia consultorio en Corrientes 1466.
- [x] Estructuración de campaña en 2 bloques con 3 variantes de texto cada una para evasión de bloqueos en WhatsApp.
- [x] Creación del flujo guardado `EnvioAntigravity` y automatización de su inserción en SQLite vía `server/database.js` y `server/seed-flow-antigravity.js`.
- [x] Diagnóstico en caliente por SSH en VPS (149.50.128.73:5782):
  - Detección de por qué la Campaña 64 terminó en 15 segundos sin verse en el front: 1,673 contactos de la lista fueron saltados (`skipped`) porque el frontend tenía activo el filtro `ever` (memoria infinita) y todos habían sido contactados el 28 de agosto (>7 días atrás).
  - Diagnóstico de error `No LID for user` en los 54 contactos restantes: corresponden a números inexistentes/mal formateados en la agenda VCF que no poseen cuenta en WhatsApp.
  - Corrección de fallback en backend (`server/index.js`) para que por defecto aplique la ventana de 7 días y no excluya de forma permanente.
- [x] Configuración de subdominio `remarketing.nextemarketing.com` apuntando a VPS `149.50.128.73`:
  - Creación y activación de VirtualHost Nginx en `/etc/nginx/sites-available/remarketing.nextemarketing.com`.
  - Configuración de reverse proxy para Frontend (:8989), Backend API (:3001), WebSockets (:3001) y Uploads (:3001).
  - Verificación de sintaxis de Nginx (`nginx -t`) y recarga del servicio.
  - Modificación de `client/src/App.jsx` para resolución transparente de endpoints via `window.location.origin` (commit `e446ae0` en `main`).
  - Recompilación de producción en VPS (`npm run build`) y reinicio de PM2 `natoh-ui` y `natoh-api`.
- [x] Verificación de propagación DNS del registro Tipo A `remarketing.nextemarketing.com` -> `149.50.128.73` completada con éxito.
- [x] Ejecución de Certbot vía SSH en el VPS: Certificado SSL Let's Encrypt obtenido y desplegado en Nginx con redirección HTTPS automática (HTTP 200 OK verificado en frontend y `/api/whatsapp/status`).

