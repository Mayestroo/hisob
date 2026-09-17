---

description: Butun loyihani to'liq va token-tejamkor audit qilish — Luna barcha fayllarni skanerlaydi, Terra faqat jiddiy topilmalarni tasdiqlaydi
agent: plan
subtask: false
--------------

Sen **ORKESTRATOR** sifatida ishla.

Maqsad: loyihadagi barcha relevant source/config/test fayllarni audit qilish, lekin kuchli modelga keraksiz kontekst yubormaslik.

## ASOSIY QOIDALAR

1. Hech qanday relevant source/config/test fayl auditdan o'tmay qolmasin.
2. `quick-scan` — asosiy scanner. Barcha fayllarni aynan shu agent tekshiradi.
3. `deep-audit` butun loyihani qayta skanerlamaydi.
4. `deep-audit`ga FAQAT `Critical` va `High` topilmalar yuboriladi.
5. `Medium` va `Low` topilmalarni `deep-audit`ga yuborma.
6. Bir fayl uchun alohida subagent chaqirma. Fayllarni mantiqiy batch/modullarga birlashtir.
7. Bir moduldagi barcha Critical/High topilmalarni imkon qadar BITTA `deep-audit` chaqiruviga birlashtir.
8. Agar Critical/High topilmasa, `deep-audit`ni umuman chaqirma.
9. Bir xil root-cause'dan kelib chiqqan topilmalarni deduplicate qil.
10. Audit davomida hech qanday kodni o'zgartirma.
11. Faqat foydalanuvchi tasdiqlagandan keyin `fixer` ishlatiladi.
12. Keraksiz uzun izohlar, qayta-qayta summary va bir xil kodni bir necha agentga yuborishdan saqlan.

---

# BOSQICH 0 — LOYIHANI INVENTARIZATSIYA QIL

Avval loyiha strukturasini aniqlab ol.

Relevant fayllarni top:

* source code
* backend/frontend
* API/controllers/routes
* services
* database/repository/ORM
* authentication/authorization
* middleware/guards/interceptors
* UI/components/pages
* state management
* configuration
* migrations
* tests
* scripts
* Docker/CI/CD
* package manifests
* environment example/config files

Auditdan chiqarib tashla:

* `node_modules`
* `.git`
* build/dist/output
* coverage
* generated code
* cache
* binary/media fayllar
* dependency lock fayllari, agar dependency muammosini tekshirish uchun zarur bo'lmasa

Fayllarni mantiqiy modullarga ajrat.

Masalan:

* backend/auth
* backend/users
* backend/orders
* backend/database
* frontend/pages
* frontend/components
* frontend/state
* tests
* config/infrastructure

Har bir relevant fayl qaysi batchga tushganini nazorat qil.

Maqsad:

**AUDITED relevant files = 100%**

Lekin har bir fayl uchun alohida agent chaqirma.

---

# BOSQICH 1 — QUICK-SCAN

Har bir modul/batch uchun `quick-scan` subagentini chaqir.

Mustaqil modullarni imkon qadar **parallel** tekshirtir.

Har bir quick-scan'ga faqat o'z moduliga tegishli fayllarni ber.

## QUICK-SCAN TEKSHIRADIGAN KATEGORIYALAR

### 1. Correctness

Tekshir:

* syntax
* typo
* noto'g'ri condition
* null/undefined
* type mismatch
* unreachable/dead code
* noto'g'ri async/await
* noto'g'ri return
* edge case
* noto'g'ri state/data flow

### 2. Security

Tekshir:

* hardcoded secret
* SQL injection
* XSS
* command injection
* path traversal
* auth bypass
* authorization xatosi
* IDOR
* input validation yo'qligi
* sensitive data exposure
* noto'g'ri JWT/session ishlatilishi

Faqat koddan asosli shubha mavjud bo'lsa topilma yarat.

### 3. Performance

Tekshir:

* N+1 query
* keraksiz database query
* cheksiz/og'ir loop
* unnecessary re-render
* katta object/array copy
* memory leak
* blocking operation
* katta bundle/import

### 4. Architecture / Maintainability

Tekshir:

* duplicate logic
* tight coupling
* god class/file
* responsibility aralashuvi
* noto'g'ri abstraction
* SOLID/DRY buzilishi

Faqat real maintenance yoki bug xavfi tug'dirsa report qil.

Kosmetik refactorlarni topilma sifatida ko'paytirma.

### 5. Error Handling

Tekshir:

* silent failure
* swallowed exception
* noto'g'ri try/catch
* promise rejection
* noto'g'ri HTTP error
* transaction rollback muammosi

### 6. Tests

Tekshir:

* Critical business logic testsiz
* auth/security testsiz
* muhim edge-case testsiz
* noto'g'ri/mock sabab real bug yashirilishi

100% coverage talab qilma.

### 7. Dependencies

Manifest va koddan ko'rinadigan:

* noto'g'ri package ishlatilishi
* duplicate dependency
* keraksiz dependency
* xavfli/deprecated API

Aniq tashqi ma'lumot talab qiladigan CVE/version da'volarini taxmin qilma.

### 8. Configuration

Tekshir:

* `.env` noto'g'ri ishlatilishi
* prod/dev aralashuvi
* insecure default
* secret fallback
* debug productionda yoqilishi
* noto'g'ri CORS/security config

### 9. Documentation

Faqat noto'g'ri yoki yo'q documentation real ishlash/deployment xavfini tug'diradigan holatlarni report qil.

---

# QUICK-SCAN OUTPUT

Uzun essay yozma.

Har bir topilmani ixcham formatda qaytar:

```text
ID: AUTH-01
File: src/auth/auth.service.ts
Line: 120-135
Severity: High
Category: Security
Issue: Refresh token ownership tekshirilmayapti.
Evidence: refreshToken() userId bo'yicha token egasini tekshirmasdan yangi access token beradi.
```

Severity faqat:

* Critical
* High
* Medium
* Low

Severity'ni oshirib ko'rsatma.

Agar muammo aniq bo'lmasa:

`POSSIBLE`

deb belgilansin.

Quick-scan yechim uchun katta kod yozmasin.

---

# BOSQICH 1.5 — NORMALIZE VA DEDUPLICATE

Barcha quick-scan natijalarini yig'.

Bir xil muammoni bir nechta agent topgan bo'lsa birlashtir.

Masalan:

```text
AUTH-01
AUTH-07
API-03
```

aslida bir xil auth middleware muammosidan kelib chiqsa, bitta root-cause sifatida ko'r.

Severity'larni qayta normalizatsiya qil.

Topilmalarni:

* Critical
* High
* Medium
* Low

bo'yicha ajrat.

`Medium` va `Low` shu yerda saqlanadi.

Ularni deep-audit'ga yuborma.

---

# BOSQICH 2 — DEEP-AUDIT

Faqat:

**Critical + High**

topilmalarni `deep-audit`ga yubor.

Agar:

```text
Critical = 0
High = 0
```

bo'lsa:

**deep-audit chaqirma.**

## MUHIM TOKEN QOIDASI

Deep-audit:

* butun repository'ni qayta skanerlamaydi;
* barcha fayllarni qayta o'qimaydi;
* quick-scan ishini qayta bajarmaydi;
* Medium/Low'ni tekshirmaydi;
* aloqasiz kodni tahlil qilmaydi.

Unga faqat topilmani tasdiqlash uchun zarur bo'lgan:

* finding ID
* file path
* line/range
* quick-scan evidence
* zarur relevant surrounding code/dependency

beriladi.

---

## BATCHING

Bir moduldagi barcha Critical/High topilmalarni BITTA xabarga yig'.

Masalan:

```text
Quyidagi AUTH modul topilmalarini tasdiqla:

1. AUTH-01 — auth.service.ts:120-135
   Refresh token ownership bypass shubhasi.
   Evidence: ...

2. AUTH-04 — jwt.guard.ts:44-61
   Role validation bypass shubhasi.
   Evidence: ...

3. AUTH-08 — password.service.ts:81-96
   Password reset token reuse shubhasi.
   Evidence: ...
```

Har bir finding uchun alohida `deep-audit` chaqiruv QILMA.

Agar loyiha juda katta bo'lsa:

**1 modul ≈ 1 deep-audit task**

tamoyilidan foydalan.

---

# DEEP-AUDIT VAZIFASI

Har bir Critical/High finding uchun:

1. Muammo real yoki false-positive ekanini aniqlasin.
2. Root-cause'ni aniqlasin.
3. Exploit/failure path'ni aniqlasin.
4. Severity'ni tasdiqlasin yoki pasaytirsin.
5. Minimal va xavfsiz yechimni aniqlasin.

Natija:

```text
ID: AUTH-01
Verdict: CONFIRMED
Severity: High
Root cause: ...
Impact: ...
Fix: ...
```

yoki:

```text
ID: AUTH-01
Verdict: FALSE_POSITIVE
Reason: ...
```

Deep-audit uzun umumiy security tutorial yozmasin.

---

# BOSQICH 3 — YAKUNIY HISOBOT

Quick-scan va deep-audit natijalarini birlashtir.

False-positive deb tasdiqlangan topilmalarni asosiy xatolar ro'yxatidan chiqar.

Har bir haqiqiy topilma:

```text
📍 Fayl: [yo'l]
📏 Qator: [raqam/range]
🏷️ Daraja: [Critical/High/Medium/Low]
📂 Kategoriya: [Security/Correctness/Performance/...]
🐛 Muammo: [aniq tavsif]
💥 Ta'sir: [real oqibat]
✅ Yechim: [minimal konkret yechim]
```

Yechimni tushuntirish uchun kerak bo'lsa kichik kod snippet ber.

Butun faylni qayta yozma.

---

# STATISTIKA

Oxirida:

```text
Audit coverage:
Relevant files: X
Audited files: X
Skipped generated/vendor files: X

Findings:
Critical: X
High: X
Medium: X
Low: X

Deep-audit:
Checked: X
Confirmed: X
Downgraded: X
False-positive: X
```

Keyin tuzatish prioritetini ko'rsat:

```text
1. Critical
2. High
3. Medium
4. Low
```

Bir xil root-cause'dan kelgan xatolarni birga tuzatishni tavsiya qil.

---

# BOSQICH 4 — MAJBURIY STOP

Hisobot tayyor bo'lgach:

**HECH QANDAY KODNI O'ZGARTIRMA.**

`fixer`ni chaqirma.

Foydalanuvchidan so'ra:

**"Qaysi xatolarni tuzatishni boshlaymiz? Masalan: barcha Critical/High yoki aniq finding ID'larini ayting."**

Shundan keyin TO'XTA.

---

# BOSQICH 5 — FIXER

Faqat foydalanuvchi aniq tasdiqlagandan keyin bajariladi.

`fixer`ga faqat:

* tasdiqlangan finding ID
* kerakli fayllar
* deep-audit root-cause
* tavsiya qilingan fix

ber.

Fixer:

1. Auditni qayta bajarmasin.
2. Butun repository'ni qayta tahlil qilmasin.
3. Aloqasiz refactor qilmasin.
4. Faqat kerakli minimal patchni kiritsin.
5. Existing API/behavior'ni sababsiz o'zgartirmasin.
6. Tegishli test/typecheck/lint/build'ni ishga tushirsin.
7. Fix sabab boshqa joy buzilmaganini tekshirsin.

Agar bitta root-cause bir nechta finding'ni hal qilsa, bitta umumiy fix qil.

Fix tugagach qisqa hisobot:

```text
Fixed:
- AUTH-01
- AUTH-04

Changed:
- src/auth/auth.service.ts
- src/auth/jwt.guard.ts

Validation:
- Tests: PASS
- Typecheck: PASS
- Build: PASS
```

---

# TOKEN TEJASHNING QAT'IY QOIDALARI

**Luna barcha fayllarni ko'radi. Terra faqat zarur topilmalarni ko'radi.**

Shuning uchun:

* Terra'ga butun repository yuborma.
* Deep-audit orqali repository'ni boshidan audit qildirma.
* Medium/Low → Terra'ga yuborma.
* Finding boshiga agent chaqirma.
* Bir xil kodni bir nechta agentga sababsiz yuborma.
* Uzun chain-of-thought yoki umumiy tushuntirish talab qilma.
* Quick-scan outputini ixcham saqla.
* Duplicate findinglarni Terra'ga yuborishdan oldin birlashtir.
* Critical/High bo'lmasa Terra deep-audit ishlamasin.
* Fixer faqat foydalanuvchi tasdiqlagan kodni ko'rsin.
* Audit paytida avtomatik refactor/fix qilinmasin.

**Asosiy pipeline:**

`Inventory → parallel quick-scan (Luna) → deduplicate → Critical/High only → deep-audit (Terra) → final report → STOP → user approval → fixer (Terra)`
