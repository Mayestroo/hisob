# Novda Hisob-Kitob Tizimi

Tikuvchilik va trikotaj korxonalari uchun maxsus ishlab chiqilgan, oflayn rejimda ishlovchi (Offline-First) va ko'p kompyuterli real-vaqt sinxronizatsiyasiga (Multi-PC Sync) ega avtomatlashtirilgan ishlab chiqarish, patta va oylik ish haqi hisob-kitob dasturi.

---

## 🚀 Texnologiyalar Steki

- **Frontend:** React 19, TypeScript, Zustand (Unified State Slices), Tailwind/Vanilla CSS, Lucide Icons
- **Desktop Runtime:** Electron (Secure context isolation, native hardware licensing)
- **Local Persistence:** Local JSON DB (Auto-backups, Tombstone-based conflict resolution)
- **Cloud & Multi-PC Sync:** Firebase Realtime Database (Offline IndexedDB queue + auto-flush)
- **Testing:** Vitest (100% offline isolated unit testing)
- **Admin & Telemetry:** Telegram Bot (Python 3.10+, Render.com 24/7 keep-alive)

---

## 📋 Tizim Talablari

- **Node.js:** 18.x yoki 20.x+
- **NPM:** 9.x+
- **Python:** 3.10+ (faqat Telegram boshqaruv boti uchun)
- **OS:** Windows 10 / 11 x64 (Desktop versiya uchun)

---

## ⚙️ O'rnatish va Ishga Tushirish

### 1. Bog'liqliklarni o'rnatish
```bash
npm install
```

### 2. Muhit parametrlarini sozlash
`.env.example` faylidan nusxa olib, `.env.local` faylini yarating va Firebase parametrlarini kiriting:
```bash
cp .env.example .env.local
```

### 3. Dasturni ishga tushirish

- **Dasturchi rejimi (Vite + Lokal Server):**
  ```bash
  npm run dev
  ```
  Vite brauzerda: `http://127.0.0.1:3000`  
  API server: `http://127.0.0.1:3001`

- **Desktop (Electron) ilovasini ochish:**
  ```bash
  npm run desktop
  # yoki to'liq rejimda:
  npm start
  ```

- **Faqat API serverni ishga tushirish:**
  ```bash
  npm run server
  ```

---

## 🧪 Avtomatlashtirilgan Testlar

Moliyaviy formulalar, patta validatsiyasi va multi-PC sinxronizatsiya algoritmi uchun 100% oflayn Vitest testlari:

```bash
npm run test
```

TypeScript tip tekshiruvi:
```bash
npx tsc --noEmit
```

---

## 📦 Windows Installer (.exe) Yig'ish

Windows 10/11 uchun to'liq avtonom o'rnatuvchi paketni yaratish:
```bash
npm run dist:local
# yoki
npm run dist
```
Natijaviy fayl: `dist-build/Novda-hisob-kitob-Setup-1.6.0-win10-11-x64.exe`

---

## 🛡️ Rollar va Ruxsatlar (RBAC)

1. **👑 Admin:** To'liq huquq (barcha modellar, xodimlar boshqaruvi, oylik hisobot, sozlamalar, zaxiradan tiklash).
2. **⌨️ Type (Kirituvchi):** Yangi partiya ochish, hisob-kitob sonlarini kiritish, Umumiy hisobot va Konveyer varag'ini ko'rish.
3. **🖨️ Print (Chop etuvchi):** Faqat tayyorlangan partiyalarni tekshirish va chop etish (`Konveyer`, `Umumiy` va model hisob varaqlari bloklangan).

---

## 🔒 Xavfsizlik Qoidalari

- Maxfiy tokenlar (`BOT_TOKEN`) hech qachon mijoz kodida hardcode qilinmaydi.
- Testlash jarayonida jonli Firebase ma'lumotlar bazasiga tegilmaydi (barcha testlar mahalliy xotirada mock qilinadi).
- Desktop oynasi ichida chop etish rejimi (`printWin`) xavfsiz qumloq (sandboxed, javascript: false) muhitida ishlaydi.
