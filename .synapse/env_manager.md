# Environment Manager

## [L] Local Development
- **Node:** v18+
- **Frontend Port:** 5173
- **Backend Port:** 3001
- **DB:** `database.sqlite`

## [P] Production (Debian VPS)
- **Node:** v18+
- **VPS IP:** `149.50.128.73` (SSH Port: `5782`)
- **Process Manager:** PM2 (`natoh-api` en 3001, `natoh-ui` en 8989)
- **Domain:** `remarketing.nextemarketing.com`
- **Reverse Proxy:** Nginx (`/etc/nginx/sites-available/remarketing.nextemarketing.com`)
  - `/` -> `http://127.0.0.1:8989` (Frontend Vite Build)
  - `/api/` -> `http://127.0.0.1:3001` (Backend Express)
  - `/socket.io/` -> `http://127.0.0.1:3001` (WebSocket upgrades)
  - `/uploads/` -> `http://127.0.0.1:3001` (Multimedia)
- **SSL:** Certbot Let's Encrypt ✅ ACTIVO con renovación automática (Expira: 2026-12-07)
- **URL Pública:** `https://remarketing.nextemarketing.com`
- **Dependencies:** `chromium`, `libatk-bridge2.0-0`, etc (for Puppeteer)

