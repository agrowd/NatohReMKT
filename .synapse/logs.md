# Tracker de Console Logs (Debugging vs Producción)

| Archivo | Ubicación / Función | Tipo de Log | Descripción | Estado |
|:---|:---|:---|:---|:---|
| `server/whatsapp.js` | `startClient()` | Console.log | Output de estado de conexión (QR, Pairing, Ready, Disconnected) | Active |
| `server/whatsapp.js` | `searchMessagesInHistory()` | Console.log | Progreso de búsqueda de mensajes por chat | Active |
| `server/index.js` | `/api/admin/vps-logs` | Endpoint Admin | Muestra PM2 logs y SQLite error logs en vivo para diagnóstico | Active |
