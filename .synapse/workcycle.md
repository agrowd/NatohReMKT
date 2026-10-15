# Workcycle Log - Sesión Actual

## 📋 Tarea Actual
- **Objetivo:** Implementar la opción de exclusión anti-spam para no enviar mensajes a contactos a los que se les envió en los últimos 2 meses (60 días), cálculo en tiempo real de contactos disponibles/excluidos, persistencia en base de datos SQLite y ordenamiento inteligente para evitar repetir siempre los mismos destinatarios.
- **Acciones en Curso:**
  1. Actualización del esquema SQLite (`database.js`):
     - Agregar columnas `last_sent_at` y `sent_count` en la tabla `contacts` con índices para búsquedas O(1).
     - Backfill automático de `last_sent_at` y `sent_count` desde la tabla histórica `logs` (`status = 'sent'`).
     - Agregar columna `config` en `campaigns`.
     - Crear tabla `settings` para persistencia de configuraciones globales (`exclusionPeriod = '60d'`).
  2. Motor de Campañas (`server/index.js`):
     - Soporte para período de exclusión `'60d'` / `'2m'` (`datetime('now', '-60 days')`).
     - Actualizar `contacts.last_sent_at` y `contacts.sent_count` cada vez que se envía un mensaje.
     - Endpoint `POST /api/campaigns/preview-audience` para calcular en tiempo real los contactos totales, excluidos y disponibles antes y durante el lanzamiento.
     - Ordenamiento inteligente de contactos por `last_sent_at ASC NULLS FIRST` para priorizar a los que nunca recibieron mensajes y evitar que siempre se envíe a los primeros de la lista.
     - Endpoints `GET /api/settings` y `POST /api/settings` para guardar la configuración por defecto en la base de datos.
  3. Frontend UI (`client/src/App.jsx`):
     - Agregar opción "Evitar si se envió en los últimos 2 meses (60 días)" como predeterminada/recomendada.
     - Mostrar tarjeta/badge informativo con el cálculo en vivo de la audiencia: Total contactos, Excluidos por fecha, Disponibles para enviar.
     - Persistir la configuración seleccionada tanto en LocalStorage como en la base de datos SQLite.
