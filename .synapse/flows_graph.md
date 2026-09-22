# Grafos de Lógica y Flujos del Sistema

## 1. Conexión de WhatsApp Web

```mermaid
flowchart TD
    A[Usuario inicia solicitud] --> B{¿Modo?}
    B -- QR Code --> C[Cliente genera QR]
    B -- Pairing Code --> D[Cliente solicita Pairing Code al backend]
    C --> E[Socket emite 'qr' al Dashboard UI]
    D --> F[Socket emite 'pairing_code' al Dashboard UI]
    E --> G[Usuario escanea QR]
    F --> H[Usuario ingresa Código de 8 dígitos en cel]
    G --> I[Evento 'ready']
    H --> I[Evento 'ready']
    I --> J[Estado: BOT ONLINE]
```

## 2. Motor de Envío Masivo de Campañas

```mermaid
flowchart TD
    A[UI lanza Campaña] --> B[POST /api/campaigns]
    B --> C[Obtener destinatarios de Listas Virtuales / Etiquetas]
    C --> D[Aplicar exclusión por período anti-spam (48h, 7d, etc.)]
    D --> E[Para cada contacto de la lista]
    E --> F{¿Campaña cancelada o Bot Desconectado?}
    F -- Sí --> G[Abortar campaña y emitir estado]
    F -- No --> H[Seleccionar variante de mensaje del flujo]
    H --> I[sendMessage via Puppeteer]
    I --> J[Registrar en SQLite `logs`]
    J --> K[Wait de delay con check cada 500ms]
    K --> E
```
