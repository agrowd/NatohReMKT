# Gestión de Entornos [L] Local vs [P] Producción

## 💻 Entorno Local [L]
- **SO:** Windows 11 / PowerShell
- **Backend API:** `http://localhost:3001`
- **Frontend UI:** `http://localhost:5173` (Vite Dev Server) o `http://localhost:8989`
- **Comandos:**
  - Backend: `cd server && npm run dev` / `node index.js`
  - Frontend: `cd client && npm run dev`
  - Build Frontend: `cd client && npm run build`

## 🚀 Entorno Producción [P] VPS
- **IP:** `149.50.128.73`
- **SSH:** `ssh -p 5782 root@149.50.128.73`
- **Ruta del Proyecto:** `/srv/NatohReMKT`
- **URL Pública:** `https://remarketing.nextemarketing.com`
- **Procesos PM2:**
  - `natoh-api` (Port 3001)
  - `natoh-ui` (Port 8989)
- **Comando de Deploy:**
  ```bash
  cd /srv/NatohReMKT && git pull && cd client && npm run build && pm2 restart natoh-api natoh-ui
  ```
