# Decisiones Técnicas del Proyecto (Chesterton Fences)

| ID | Decisión Técnica | La Razón (The Why) | Estado |
|:---|:---|:---|:---|
| D-01 | **Uso de `whatsapp-web.js#main` (rama dev de GitHub)** | La versión de npm estable lanzaba errores de `No LID for user` por cambios internos en la API de WhatsApp Web. | 🔒 LOCKED |
| D-02 | **Gestión de Sesiones con `LocalAuth`** | Preserva la sesión de WhatsApp Web en el servidor sin requerir re-escaneo constante de QR/Código. | 🔒 LOCKED |
| D-03 | **Wait con microintervalos (`delayWithCancelCheck`)** | Al pausar/detener campañas, los delays de 90s retenían la CPU. Los intervalos de 500ms permiten abortar en <1s. | 🔒 LOCKED |
| D-04 | **Listas Virtuales en SQLite** | Evita las limitaciones nativas de etiquetas de WhatsApp (máximo de etiquetas y contactos sin chat previo). | 🔒 LOCKED |
| D-05 | **Búsqueda en lotes con delay 70ms** | Evita saturar la CPU y previene bloqueos de rate limit por parte de WhatsApp durante lecturas de historial. | 🔒 LOCKED |
| D-06 | **Filtrado de Exclusión por Período (`exclusionPeriod`)** | Permite configurar ventanas anti-spam (48h, 7d, siempre, ninguna) para evitar re-enviar mensajes a contactos recientes. | 🔒 LOCKED |
| D-07 | **Sincronización interactiva por socket (`labels`, `status`)** | Notifica en tiempo real el progreso de envíos, sincronización y escaneo QR/Código en el dashboard web. | 🟢 ACTIVE |
