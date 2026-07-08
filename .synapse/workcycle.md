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

## Sesión: 2026-07-08 (Actual)
- [x] Creación del script de backend `server/import-special-list.js` para parsear, filtrar y agrupar contactos del archivo VCF pesado `contacts2.vcf` directamente en el servidor Debian.
- [x] Filtro combinado de palabras clave ("luz" o "hifu") en una única lista virtual local llamada "Luz o Hifu".
- [x] Cruce y exclusión automática en base de datos local SQLite para ignorar contactos a los que ya se les haya enviado mensajes con éxito (`status = 'sent'`).
- [x] Actualización de `.gitignore` para omitir y no subir el archivo `contacts2.vcf` pesado con datos reales al repositorio público.
- [x] Creación del script `server/view-campaign-logs.js` para diagnosticar en caliente por qué finalizan rápido las campañas.


