---
description: Butun loyihani to'liq audit qilish — model avtomatik switch bo'ladi (Luna → Sol)
agent: plan
subtask: false
---

Sen orkestrator sifatida ishla. Loyihani to'liq audit qil va HECH QANDAY faylni o'tkazib yuborma.

## Bosqich 1 — Tez skanerlash (quick-scan subagentiga topshir)
Loyiha strukturasini chiqar, uni mantiqiy modul/papkalarga bo'l. Har bir modul uchun **quick-scan** subagentini (parallel, bir nechtasini bir vaqtda) chaqir. Har biriga quyidagi 9 ta kategoriya bo'yicha tez tekshiruv buyur:
1. Kod sifati va mantiqiy xatolar (sintaksis, typo, dead code, null/undefined, type mismatch)
2. Xavfsizlik belgilari (hardcoded secret, SQL/XSS shubhasi, input validatsiya yo'qligi)
3. Performance (N+1, keraksiz tsikl, katta bundle)
4. Arxitektura (kod takrorlanishi, tight coupling)
5. Error handling (try/catch yo'qligi, silent failure)
6. Testlar (coverage, yo'q testlar)
7. Dependencies (eskirgan/zaif paketlar)
8. Konfiguratsiya (.env, prod/dev aralashuvi)
9. Hujjatlashtirish

Har bir topilma uchun: fayl, qator, taxminiy daraja (Critical/High/Medium/Low).

## Bosqich 2 — Chuqur tasdiqlash (deep-audit subagentiga topshir)
quick-scan'dan kelgan barcha **Critical va High** darajali topilmalarni yig'ib ol. Ularni **BITTA (yoki modul bo'yicha bir nechta) katta xabarda, RO'YXAT qilib** deep-audit subagentiga yubor — har bir topilma uchun alohida-alohida chaqiruv qilma, bu tokenni behuda sarflaydi. Masalan: "Quyidagi 8 ta topilmani tahlil qil: 1) ... 2) ... 3) ..." tarzida bitta xabarda yubor.

Agar loyiha juda katta bo'lsa, deep-audit'ni modul boshiga bittadan (butun modul topilmalari birga) chaqir, fayl boshiga emas.

## Bosqich 3 — Yakuniy hisobot
Barcha natijalarni birlashtirib, quyidagi formatda hisobot ber:

```
📍 Fayl: [yo'l]
📏 Qator: [raqam]
🏷️ Daraja: [Critical/High/Medium/Low]
🐛 Muammo: [tavsif]
💥 Ta'sir: [nima bo'lishi mumkin]
✅ Yechim: [tayyor kod/taklif]
```

Oxirida: statistika (daraja bo'yicha son), tuzatish tartibi bo'yicha tavsiya.

## Bosqich 4 — Tuzatish (faqat tasdiqdan keyin!)
Hisobotni ko'rsatgach TO'XTA va foydalanuvchidan tasdiq so'ra: "Qaysi xatolarni tuzatishni boshlaymiz?". Tasdiqlangandan so'nggina **fixer** subagentini chaqirib, tuzatishni amalga oshir. O'z-o'zingdan avtomatik tuzatishga o'tma.