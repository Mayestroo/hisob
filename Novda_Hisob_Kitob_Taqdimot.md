# 🌿 «NOVDA HISOB-KITOB» DASTURI — TO'LIQ TAQDIMOT VA YO'RIQNOMA
> **Tikuvchilik fabrikalari va sexlari uchun ishlab chiqarish, konveyer monitoringi, patta generatsiyasi va ishbay oylik hisobini 100% avtomatlashtiruvchi zamonaviy dasturiy majmua**

---

## 📌 Taqdimot Mundarijasi
0. [Yuqori Boshqaruv Paneli (TitleBar Tugmalari)](#0-yuqori-boshqaruv-paneli-titlebar)
1. [«Umumiy» — Bosh Oylik Hisob Varaqi](#1-umumiy--bosh-oylik-hisob-varaqi)
2. [«Patta» — Partiyalar Yaratish va Chop Etish](#2-patta--partiyalar-yaratish-va-chop-etish)
3. [«Patta Pechati» — Chop Etiladigan Chiptalar Ko'rinishi](#3-patta-pechati--chop-etiladigan-chiptalar)
4. [«Patta-Hisob» — Partiyalar Auditi va Solishtirma](#4-patta-hisob--partiyalar-auditi-va-solishtirma)
5. [«Konveyer» — Liniyalarning Jonli Matrisasi](#5-konveyer--liniyalarning-jonli-matrisasi)
6. [Model «Patta Kiritish» — Chiptalarni Qabul Qilish](#6-model-patta-kiritish--chiptalarni-qabul-qilish)
7. [Model «Hisob-Kitob» — Operatsiyalar va Tariflar](#7-model-hisob-kitob--operatsiyalar-va-tariflar)
8. [«Ishchilar Boshqaruvi» Modali](#8-ishchilar-boshqaruvi-modali)
9. [«Ishchi Shaxsiy Kartochkasi» Modali (Dossier)](#9-ishchi-shaxsiy-kartochkasi-modali)
10. [«Oylik Davr Boshqaruvi» Modali (Arxiv)](#10-oylik-davr-boshqaruvi-modali)
11. [«Zaxiralar (Backup) Tarixi» Modali](#11-zaxiralar-backup-tarixi-modali)
12. [«Yangi Model Qo'shish» Modali](#12-yangi-model-qoshish-modali)

---

## 0. Yuqori Boshqaruv Paneli (TitleBar)

Dasturning eng yuqorisida barcha varaqlarda ko'rinib turadigan tezkor tugmalar joylashgan:

| Tugma / Element | Nomi | Vazifasi va bosilganda nima bo'ladi? |
| :--- | :--- | :--- |
| **📅 Kalendar** | `Joriy Oylik` (masalan: 2026-08-26 oyligi) | Bosilganda `PeriodManagerModal` ochiladi. Oylik davr boshlanishini ko'rsatadi, oyni bitta tugma bilan yopish va arxivlashni amalga oshiradi. |
| **👥 Ishchilar** | `Ishchilar (199)` | Hozir korxonada ro'yxatdan o'tgan barcha ishchilar sonini ko'rsatadi. Bosilganda `WorkerManagerModal` ochiladi. |
| **⬇️ Excel** | `Excel (.xlsx) Yuklab Olish` | 1 soniya ichida butun fabrikadagi barcha modellarni, operatsiyalarni va ishchilarning oyliklarini Excel formatiga eksport qiladi. |
| **💾 Diskka Saqlash**| `Saqlash (Ctrl+S)` | Barcha yangi o'zgarishlarni kompyuter xotirasidagi ma'lumotlar bazasiga darhol muhrlaydi. |
| **🗄️ Baza** | `Zaxiralar va Baza Tarixi` | Bosilganda avtomatik olingan xavfsiz Backup (zaxira nusxalar) ro'yxati chiqadi. Bir tugma bilan o'tmishdagi holatga qaytish mumkin. |
| **🛡️ Litsenziya** | `Litsenziya Holati` | Dasturning faol muddati va qolgan vaqtini ko'rsatadi. Administrator Telegram boti orqali nazorat qilinadi. |
| **🌓 Kun/Tun** | `Mavzu (Theme)` | Interfeysni Dark Mode (qorong'i) yoki Light Mode (yorug') ko'rinishiga bir zumda o'tkazadi. |

---

## 1. «Umumiy» — Bosh Oylik Hisob Varaqi
> **Skrinshot:** `screenshots/01_umumiy_sheet.png`

Ushbu varaq fabrikadagi barcha 199+ xodimlarning yakuniy ish haqini, olingan avanslarini, jarima va doimiy stajlarini 1 tiyingacha hisoblab beruvchi asosiy sahifadir.

### Ustunlar va Kiritiladigan Ma'lumotlar:
* **A ustuni (ID):** Ishchining unikal raqami. **Katakchaga 2 marta tez bosilsa (Double-click)**, ushbu ishchining to'liq shaxsiy kartochkasi ochiladi.
* **B ustuni (Ishchilar F.I.SH):** Xodimning ismi-sharifi. Ustiga bosilganda yuqori Formula satrida ko'rinadi.
* **C ustuni (Qo'lga Tegadi):** Avtomatik formula: `=G-F-E-D`. Ishchining jami ishlagan summasidan avans va jarimalar chegirilib, staj bonusi qo'shilgan holda unga beriladigan sof pul.
* **D ustuni (Doimiy Staj):** Ishchiga fabrikada uzoq ishlagani uchun beriladigan kafolatlangan oylik bonus. Oylik davr yopilganda o'chmaydi, saqlanadi.
* **E ustuni (Avans - Input):** **Operator kiritadi!** Oy davomida ishchiga berilgan naqd yoki kartaga tashlangan avans (masalan: `500000`). Yozilishi bilan C ustundagi pul darhol kamayadi.
* **F ustuni (Jarima - Input):** **Operator kiritadi!** Brak yoki qoidabuzarlik uchun ushlab qolinadigan jarima summasi (masalan: `50000`).
* **G ustuni (Jami Ishlagani):** Ishchi barcha modellarning barcha operatsiyalaridan jami qancha pul ishlab topgani.
* **H, I, J... ustunlari:** Har bir modeldan (`Basiman`, `Polo`...) ushbu tikuvchi aynan qancha summa ishlaganining alohida yig'indisi.

---

## 2. «Patta» — Partiyalar Yaratish va Chop Etish
> **Skrinshot:** `screenshots/02_patta_batch_sheet.png`

Bichuv sexidan chiqqan mato partiyalarini ro'yxatga olish, razmerlar bo'yicha patta sonlarini kiritish va bitta tugma bilan termo-chek qog'ozlarini chop etish bo'limi.

### Har Bir Model Kartochkasidagi Inputlar:
* **Ish soni inputi:** Har bir patta (pachka) ichida necha dona kiyim borligi (masalan: `50` yoki `100` dona). Kiritilmasa tizim qizil ogohlantirish beradi.
* **Partiya raqami inputi:** Tizim avtomatik navbatdagi unikal partiya raqamini qo'yadi. Istalgan paytda qo'lda o'zgartirish mumkin.
* **Rangi inputi:** Mato partiyasining rangi (masalan: *Кора, Ок, Ko'k*). Ushbu rang barcha patta chiptalariga avtomatik yoziladi.
* **Razmerlar inputlari (S, M, L, XL, 2XL, 3XL...):** Ushbu razmerdan necha dona patta chop etilishi (masalan: `M - 10 ta, L - 15 ta`). Tizim avtomatik `10 ta patta × 50 dona = 500 dona ish` deb hisoblab beradi.
* **+ Razmer qo'shish tugmasi:** Yangi o'lcham kerak bo'lsa (masalan 6XL yoki bolalar razmerlari), tizimga darhol yangi razmer ustuni qo'shadi.
* **🖨️ Pechat tugmasi:** Kamida bitta model to'ldirilgach yashil rangda faollashadi. Bosilganda pechat oynasi ochiladi.

---

## 3. «Patta Pechati» — Chop Etiladigan Chiptalar
> **Skrinshot:** `screenshots/02b_patta_print_modal.png`

Termo-printer (kassir cheki formati) yoki standart A4 qog'oz formatiga moslashtirilgan, operatsiyalar ro'yxati va tartib raqami aks etgan chiroyli chiptalar.

### Patta Qog'ozining Tarkibi:
1. **Sarlavha qismi:** Model nomi, Partiya raqami va unikal Patta tartib raqami (masalan: *№1, №2, №3...*).
2. **Tavsif qismi:** Kiyimning rangi, Razmeri (masalan: *XL*) va Pachkadagi ish soni (masalan: *50 dona*).
3. **Operatsiyalar ro'yxati:** Bichuvdan to qadoqlashgacha bo'lgan barcha operatsiyalar. Tikuvchi o'z operatsiyasiga ID raqamini yozadi yoki imzo qo'yadi.
4. **Avtomatik Arxiv:** «Chop etish» bosilishi bilan ushbu partiya avtomatik «Patta-hisob» bo'limiga topshirish kutilayotgan partiya sifatida saqlanadi.

---

## 4. «Patta-Hisob» — Partiyalar Auditi va Solishtirma
> **Skrinshot:** `screenshots/03_patta_hisob_sheet.png`

Chop etilgan partiyalar bilan tikuvchilar tomonidan amalda topshirilgan pattalarni solishtirish, qolib ketgan chiptalarni va yo'qotishlarni aniqlash bo'limi.

### Audit Holatlari va Filtrlar:
* **🟢 To'liq Yopilgan:** Partiyadagi barcha pattalar (100%) tikuvchilar tomonidan tikilib topshirilgan va hisobi yopilgan.
* **🟡 Jarayonda:** Partiya hozir konveyerda tikilmoqda, pattalar qisman topshirilmoqda.
* **🔴 Farq bor (Mismatch):** **Eng muhim audit!** Qaysidir patta yo'qolgan, topshirilmay qolib ketgan yoki sonida farq borligini ko'rsatadi.
* **🔎 Qidiruv Paneli:** Partiya raqami yoki model nomi bo'yicha kerakli partiyani 1 soniyada topib beradi.
* **📁 Arxivni Ko'rish:** Oldingi oylardagi partiyalarni ochib, o'sha oyda nimalar tikilganini tekshirish.

---

## 5. «Konveyer» — Liniyalarning Jonli Matrisasi
> **Skrinshot:** `screenshots/04_konveyer_sheet.png`

Fabrikadagi barcha konveyerlarning (1, 2, 3...) kunlik va partiyaviy unumdorligini ko'rsatuvchi interaktiv monitoring paneli.

* **Matrisa Ko'rinishi (Matrix View):** Har bir konveyer qatorida modellar bo'yicha nechta chipta kiritilgani, tikilgan ishlar soni va umumiy summasi ko'rinadi.
* **Batafsil Ro'yxat (Details Tab):** Har bir topshirilgan pattaning vaqti, konveyeri, modeli, partiyasi, razmeri va tikuvchilar ro'yxatini jadval ko'rinishida ko'rish.
* **Liniyalar Filtratsiyasi:** Qaysi konveyer qanday ishlayotganini alohida tanlab ko'rish va orqada qolayotgan liniyani darhol aniqlash.

---

## 6. Model «Patta Kiritish» — Chiptalarni Qabul Qilish
> **Skrinshot:** `screenshots/05_model_patta_entry.png`

Tikuvchilar olib kelgan qog'oz chiptalarni operator tomonidan soniyalarda bazaga kiritish va xodimlarning hisobiga yozish sahifasi.

### Kiritish Maydonlari va Avtomatika:
* **Sana (Date):** Bugungi sana avtomatik turadi, xohlagan sanaga o'zgartirish mumkin.
* **Konveyer:** Ish qaysi konveyerda tikilgani (masalan: `1`, `2`).
* **Partiya (Party):** Partiya raqami kiritiladi (masalan: `6632`). Agar bu partiya bazada bo'lmasa yoki boshqa modelga tegishli bo'lsa, tizim **qizil xatolik bilan bloklaydi**!
* **Patta raqami:** Tartib raqami kiritiladi. Kiritilishi bilan uning **Rangi, Razmeri va Soni avtomatik chiqadi**!
* **Ishchi ID (Operatsiyalar):** Har bir operatsiyaga ishchi ID si yoziladi. Yozilishi bilan yonida **ishchining to'liq ismi chiqadi** (xato yozishning oldi olinadi).
* **🚀 Jo'natish Tugmasi:** Bosilganda barcha ishchilarning hisobiga operatsiya pullari avtomatik yoziladi va forma keyingi patta uchun tozanadi.

---

## 7. Model «Hisob-Kitob» — Operatsiyalar va Tariflar
> **Skrinshot:** `screenshots/06_model_hisob_sheet.png`

Ushbu model bo'yicha har bir operatsiyaning donabay narxi (stavkasi) va har bir xodim qaysi operatsiyadan qancha dona tikkanini ko'rsatuvchi master varaq.

* **1-qator (Operatsiya nomlari):** Modelning barcha texnologik operatsiyalari (masalan: *Гулфи тахлов, Резинка қўйиш, Дазмол, Контроль...*).
* **2-qator (Tarif / Stavka):** Har bir operatsiya uchun 1 dona kiyimga to'lanadigan pul (masalan: *30 so'm, 150 so'm, 250 so'm...*). Agar narx o'zgarsa, shu yerning o'zida o'zgartiriladi va barcha oyliklar avtomatik qayta hisoblanadi.
* **Katakchalar (Miqdorlar):** Ishchilar qaysi operatsiyadan necha dona tikkani ko'rsatiladi.
* **Jami Ustun:** Xodimning faqat ushbu modeldan ishlagan jami summasi.

---

## 8. «Ishchilar Boshqaruvi» Modali
> **Skrinshot:** `screenshots/07_worker_manager_modal.png`

Korxona xodimlarini ro'yxatdan o'tkazish, ularga unikal ID berish, lavozimlarini belgilash va oylik staj bonuslarini kiritish markazi.

* **🔍 Tezkor Qidiruv:** 199 ta ishchi ichidan ism yoki ID raqami bo'yicha 1 soniyada xodimni topish.
* **➕ Yangi Ishchi Qo'shish:** Ism-sharifi, lavozimi va oylik staj summasini kiritib ro'yxatga qo'shish.
* **⭐ Doimiy Staj Ustuni:** Xodimga har oy kafolatlangan ustama puli (masalan: `140,000` so'm). Bu summa har oy o'chib ketmaydi, doim saqlanadi.

---

## 9. «Ishchi Shaxsiy Kartochkasi» Modali (Dossier)
> **Skrinshot:** `screenshots/08_worker_detail_modal.png`

Ishchi bilan oylik hisob-kitob bo'yicha har qanday savol tug'ilganda, uning bajargan har bir operatsiyasini, qaysi konveyerda, qaysi partiyada va qaysi soatda tikkanini ko'rsatib beruvchi shaxsiy dosye.

* **Umumiy Kartochka:** Xodimning ID raqami, To'liq ismi, Jami ishlagan summasi va Jami bajargan operatsiyalari soni.
* **Xronologik Tarix:** Ish qabul qilingan sana va soat, Konveyer raqami, Model nomi, Partiya raqami, Patta raqami, Razmer, Rang, Operatsiya nomi, Stavka narxi, Tikilgan soni va Ishlab topilgan summa.
* **Eksport Qilish:** Ushbu hisobotni ishchining qo'liga berish uchun alohida qog'ozga chiqarish yoki Excel qilib tashlab berish imkoniyati.

---

## 10. «Oylik Davr Boshqaruvi» Modali (Arxiv)
> **Skrinshot:** `screenshots/09_period_manager_modal.png`

Har oy yakunlanganda bitta tugma bilan oyni yopish, barcha hisoblarni arxivga muhrlash va yangi oyni toza balans bilan boshlash oynasi.

1. **Arxiv Yaratiladi:** Ushbu oyning barcha oyliklari, tikilgan pattalari va konveyer tarixi alohida o'zgarmas arxiv fayliga muhrlanadi.
2. **Avans va Jarimalar Nolga Qaytadi:** Yangi oy boshlangani uchun barcha xodimlarning avans va jarimalari avtomatik 0 so'm bo'ladi.
3. **Staj Saqlanadi:** Xodimlarning belgilangan staj pullari yangi oyga avtomatik o'tadi.
4. **O'tgan Oylarni Ko'rish:** Istalgan o'tgan oyni tanlab, o'sha oyda kim qancha oylik olganini ko'rish va yuklab olish mumkin.

---

## 11. «Zaxiralar (Backup) Tarixi» Modali
> **Skrinshot:** `screenshots/10_backup_manager_modal.png`

Kompyuter o'chib qolsa, nosozlik bo'lsa yoki tasodifan biror ma'lumot o'chib ketsa ham, barcha hisobotlarni 1 soniyada qaytarib beruvchi avtomatik zaxira tizimi.

* **Avtomatik Zaxira:** Tizim har bir muhim amalda o'zi mustaqil zaxira nusxa olib boradi.
* **Qayta Tiklash (Restore):** Zaxiralar ro'yxatidan o'sha vaqtdagi nusxani tanlab «Tiklash» tugmasini bosish orqali 10 daqiqa oldingi holatga qaytish mumkin.
* **Excel Sinxronizatsiyasi:** Dastur barcha ma'lumotlarni parallel ravishda kompyuterdagi `Buxoro_Hisob_Oxirgi.xlsx` fayliga ham saqlab boradi.

---

## 12. «Yangi Model Qo'shish» Modali
> **Skrinshot:** `screenshots/11_new_model_modal.png`

Korxonaga yangi buyurtma yoki yangi kiyim modeli kelganda, uning barcha operatsiyalari va stavkalarini kiritib tizimga ulash ustasi.

* **Model nomi:** Mahsulotning nomi (masalan: *Polo Futbolka Long*). Ushbu nom bilan pastda yangi 2 ta varaq ochiladi.
* **Mato Partiyasi & Rang:** Boshlang'ich partiya raqami va rangi.
* **Operatsiyalar ro'yxati:** Kiyim tikilishidagi barcha operatsiyalar ro'yxati va ularning donabay ish haqi narxi belgilanadi.
* **Saqlash:** Dasturda bir zumda yangi kiyim modeli uchun barcha jadvallar va formulalar tayyor bo'ladi.
