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
# Vite: http://127.0.0.1:3000
```

### B) Desktop Ilovani Sinash (Electron)
```bash
npm run desktop
# yoki
npm start
```

### C) Windows Installer (.exe) Yig'ish
```bash
npm run dist:local
# yoki GitHub Releases orqali:
npm run dist
# Natija: dist-build/Novda-hisob-kitob-Setup-1.6.0-win10-11-x64.exe
```

---

## 3. Telegram Admin Bot (Render.com)
- **Web Service:** Render.com da avtomatik deploy qilingan (`render.yaml`).
- **Port:** 10000 (Healthcheck + Webhook).
- **Muhit o'zgaruvchilari (Majburiy):**
  - `BOT_TOKEN`: Telegram bot tokeni
  - `ADMIN_CHAT_ID`: Bosh admin Telegram ID'si
  - `MASTER_SECRET`: HMAC litsenziya va xavfsiz API kaliti
  - `FIREBASE_RTDB_URL`: Firebase Realtime Database URL
  - `WEB_APP_URL`: Xavfsiz Telegram WebApp URL
  - `NOVDA_LICENSE_SECRET`: Asosiy litsenziya siri

---

## 4. Ishchi Boti (Worker Bot)
- **Autentifikatsiya:** Ishchi ID biriktirish uchun bir martalik PIN kod tekshiruvi (`AWAITING_PIN`) majburiy.
- **Hisob-kitob formulasi:**
  $$\text{Sof Foyda} = \text{Umumiy} - \text{Avans} - \text{Staj} - \text{Jarima}$$
  *(Eslatma: Korxona qoidasiga ko'ra staj jamg'arma sifatida maoshdan ushlab qolinadi).*

---

## 5. Firebase Realtime Database Xavfsizlik Qoidalari (Multi-Tenant Isolation)
- **Tavsiya etiladigan qoidalar (Production Rules):**
```json
{
  "rules": {
    "companies": {
      "$companyId": {
        ".read": "auth != null && (auth.token.companyId === $companyId || auth.token.admin === true)",
        ".write": "auth != null && (auth.token.companyId === $companyId || auth.token.admin === true)"
      }
    },
    "telemetry": {
      ".read": "auth != null && auth.token.admin === true",
      ".write": "auth != null"
    },
    "app_updates": {
      ".read": true,
      ".write": "auth != null && auth.token.admin === true"
    }
  }
}
```
