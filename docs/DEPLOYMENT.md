# Novda Hisob-Kitob — Deploy va Ishga Tushirish Qo'llanmasi

## 1. Talablar
- Node.js 18+ yoki 20+
- Python 3.10+ (Telegram bot uchun)
- Windows 10/11 x64

---

## 2. Ishga Tushirish Rejimlari

### A) Dasturchi Rejimi (Dev Server)
```bash
npm run dev
# Vite: http://localhost:3000
```

### B) Desktop Ilovani Sinash (Electron)
```bash
npm run desktop
# yoki
npm start
```

### C) Windows Installer (.exe) Yig'ish
```bash
npm run dist
# Natija: dist-build/Novda-hisob-kitob-Setup-1.4.1.exe
```

---

## 3. Telegram Admin Bot (Render.com)
- **Repo:** `https://github.com/Mayestroo/hisobmonitoringbot.git` (branch: `main`)
- **Web Service:** Render.com da avtomatik deploy qilingan.
- **Port:** 10000 (Healthcheck + Keep-alive ping).
- Yangi qurilma ochilganda botga avtomatik bildirishnoma boradi: `[👑 Admin]`, `[⌨️ Type]`, `[🖨️ Print]`.

---

## 4. Firebase Realtime Database
- **URL:** `https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app`
- **Rules:**
```json
{
  "rules": {
    "companies": {
      "$companyId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "telemetry": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```
