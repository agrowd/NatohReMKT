# Historial de Cambios (Changelog)

## [v1.6.0] - 2026-10-15
- **Feat:** Filtro anti-spam configurable de 2 meses (60 días) como nueva opción predeterminada y recomendada.
- **Feat:** Cálculo interactivo en tiempo real de audiencia (`POST /api/campaigns/preview-audience`) mostrando contactos totales, excluidos y disponibles para enviar.
- **Feat:** Cola de envíos inteligente y equitativa (`ORDER BY contacts.last_sent_at ASC NULLS FIRST`) que prioriza contactos nunca antes contactados para evitar saturar a los mismos destinatarios iniciales.
- **Feat:** Persistencia en base de datos SQLite (`contacts.last_sent_at`, `contacts.sent_count`, `campaigns.config` y tabla `settings`).
- **Feat:** Backfill automático de fechas de último envío desde logs históricos en SQLite.

## [v1.5.0] - 2026-09-22
- **Feat:** Implementado tracker de logs de diagnóstico en VPS.
- **Fix:** Manejo robusto de verificación de estado `BOT ONLINE` pre-envío en `whatsapp.js`.
- **Docs:** Inicialización de Ariadne Engine v5.0 `.synapse/`.

## [v1.4.0] - 2026-09-08
- **Feat:** Flujo predeterminado `EnvioAntigravity` con variantes de HIFU Corporal, Exilis y Depilación Definitiva.
- **Feat:** Configuración flexible de ventanas anti-spam (`exclusionPeriod`: 48h, 7d, ever, none).
