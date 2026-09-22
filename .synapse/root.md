# NatohReMKT - Sistema de Remarketing WhatsApp

## 🎯 Propósito del Proyecto
Sistema CRM / Remarketing masivo para WhatsApp orientado a clínicas estéticas. Permite enviar campañas masivas por WhatsApp Web utilizando `whatsapp-web.js` y Puppeteer, gestionar listas virtuales, etiquetado inteligente, secuencias de flujos con variantes anti-bloqueo y filtros anti-spam por período de exclusión.

## 🏗️ Arquitectura General

```
+-------------------------------------------------------+
|                    Frontend UI                        |
|  React 18 + Vite + Tailwind CSS + Lucide Icons        |
|  Servido en el puerto 8989 (PM2: natoh-ui)             |
+---------------------------+---------------------------+
                            | HTTP / WebSockets (Socket.io)
                            v
+-------------------------------------------------------+
|                    Backend Server                     |
|  Node.js + Express + Socket.io                        |
|  Servido en el puerto 3001 (PM2: natoh-api)           |
|  - Engine de WhatsApp: whatsapp-web.js + Puppeteer    |
|  - SQLite (better-sqlite3): database.js / natoh.db    |
+-------------------------------------------------------+
```

## 📁 Estructura de Directorios

- `client/`: Aplicación SPA React + Vite + Tailwind.
  - `src/App.jsx`: Interfaz principal con pestañas (Estado, Campañas, Flujos, Smart Search, Importador VCF/CSV, etc.).
- `server/`: Backend Express con motor de WhatsApp y SQLite.
  - `index.js`: Endpoints REST API, servidor HTTP y Socket.io, bucle de ejecución de campañas.
  - `whatsapp.js`: Integración de `whatsapp-web.js`, Puppeteer, autenticación por QR / Pairing Code, búsquedas y etiquetado.
  - `database.js`: Conexión e inicialización de esquemas SQLite (`natoh.db`).
  - `import-special-list.js`: Script de importación masiva de contactos VCF (ej. `contacts2.vcf`).
  - `seed-flow-antigravity.js`: Seeding de flujos predeterminados (`EnvioAntigravity`).
- `.synapse/`: Memoria persistente del proyecto (Ariadne Engine v5.0).
- `chat.md`: Log de conversación e hitos históricos.

## 🌐 Producción (VPS)
- IP: `149.50.128.73` (Puerto SSH: 5782)
- Dominio: `https://remarketing.nextemarketing.com`
- PM2 Processes: `natoh-api`, `natoh-ui`
- Reverse Proxy: Nginx con Certbot SSL.
