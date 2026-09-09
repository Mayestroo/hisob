# Novda Hisob-Kitob — Arxitektura Qo'llanmasi

## 1. Umumiy Arxitektura (3 Qatlamli Offline-First)

```
┌─────────────────────────────────────────────────────────────┐
│                     NOVDA HISOB-KITOB                        │
├─────────────────────────────────────────────────────────────┤
│  PC-1 (Admin)          PC-2 (Type)           PC-3 (Print)   │
│  [Zustand RAM]         [Zustand RAM]         [Zustand RAM]  │
│        ↓                     ↓                     ↓        │
│  [Local DB (JSON)]     [Local DB (JSON)]     [Local DB]     │
│        ↓                     ↓                     ↓        │
│  [IndexedDB Queue]     [IndexedDB Queue]     [IndexedDB]    │
│        └─────────────────────┬─────────────────────┘        │
│                              ↓                              │
│              [Firebase Realtime Database (RTDB)]            │
│                 companies/company_main/...                  │
│                                                             │
│       ┌──────────────────────────────────────────┐          │
│       │ Telegram Bot (@hisobmonitoringbot)       │          │
│       │ Render.com (24/7 Keep-Alive Heartbeat)   │          │
│       │ [👑 Admin]  [⌨️ Type]  [🖨️ Print]          │          │
│       └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 3 Qatlamli Xotira (Crash Safety)
1. **Zustand (RAM):** Optimistic update, real-time 60 FPS jadval.
2. **Electron Local JSON:** `userData/hisob_database.json` — svet to'satdan o'chsa ham diskda saqlanadi.
3. **Firebase RTDB & IndexedDB:** Internet uzilganda o'zgarishlar `offlineQueue.ts` orqali navbatga tushadi, internet tiklanganda avtomatik Firebase'ga LWW (Last-Write-Wins) orqali sinxronlanadi.

---

## 3. Rollar va Ruxsatlar (RBAC)
- **👑 Admin:** To'liq boshqaruv, sozlamalar, arxivlar, o'chirish, foydalanuvchilar va rollarni tayinlash.
- **⌨️ Type:** Model va hisob miqdorlarini kiritish, Umumiy oylik hisobotni ko'rish, yangi partiya ochish.
- **🖨️ Print:** Faqat Pattalarni ko'rish va chop etish, kiritish/tahrirlash huquqi bloklangan.

---

## 4. Kesh va Performance Dvigateli
- **Virtualizatsiya:** `@tanstack/react-virtual` native spacer row jadval (katta hajmdagi jadvallarda faqat ekranda ko'rinadigan qatorlarni render qiladi).
- **Tombstone Sync Merger:** `syncMerger.ts` orqali o'chirilgan yozuvlar (deleted IDs) saqlanadi va boshqa kompyuterlar bilan birlashganda dublikat yoki qayta tiklanishning (Zombie resurrection) oldi olinadi.
- **Optimallashtirilgan Formula Dvigateli:** `formulaEngine.ts` sof matematik funksiyalar orqali oylik, staj, avans va jarimalarni O(N) murakkablikda tezkor hisoblaydi.
- **Code Splitting:** Dinamik `React.lazy` va `Suspense` orqali og'ir sahifalar va modallar faqat kerak bo'lganda yuklanadi.
