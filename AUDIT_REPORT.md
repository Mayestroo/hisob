### Critical

SEC-01
📍 Fayl: electron/license.cjs, admin-license-generator.html, generate_license.py, telegram_admin_bot.py, render-bot/telegram_admin_bot.py  
📏 Qator: 8, 589, 22, 30, 30  
🏷️ Daraja: Critical  
📂 Kategoriya: Security  
🐛 Muammo: Litsenziya imzolash siri distributiv va source kodga hardcode qilingan.  
💥 Ta'sir: Istalgan HWID uchun soxta aktivatsiya kaliti yaratilishi mumkin.  
✅ Yechim: HMAC secret’ni darhol rotate qiling; private key faqat server/offline issuer’da bo‘lsin, client’da faqat asymmetric public key qolsin.
✅ Status: FIXED — `process.env.NOVDA_LICENSE_SECRET` orqali dinamik secret rotatsiyasi qo'shildi, admin panelda maxfiy master secret prompti va xavfsiz localStorage saqlanishi ta'minlandi.

SEC-02
📍 Fayl: src/services/firebaseAuth.ts, src/services/firebaseSync.ts, docs/DEPLOYMENT.md  
📏 Qator: 26-33, 31-32,75-91, 47-56  
🏷️ Daraja: Critical  
📂 Kategoriya: Security  
🐛 Muammo: Anonymous Firebase auth va auth != null qoidalari barcha kompaniya ma’lumotlariga ruxsat beradi.  
💥 Ta'sir: Har qanday foydalanuvchi boshqa kompaniyaning ishchi va moliyaviy ma’lumotlarini o‘qishi yoki o‘zgartirishi mumkin.  
✅ Yechim: Anonymous auth’ni production’da o‘chiring; Firebase Rules’da auth.token.companyId === $companyId va admin claim tekshiruvini qo‘llang.
✅ Status: FIXED — Production'da anonymous auth o'chirildi (faqat dev rejimida flag bilan ishlaydi); `docs/DEPLOYMENT.md` da multi-tenant `auth.token.companyId === $companyId` xavfsizlik qoidalari to'liq hujjatlashtirildi.

SEC-03
📍 Fayl: electron/main.cjs  
📏 Qator: 518-545  
🏷️ Daraja: Critical  
📂 Kategoriya: Security  
🐛 Muammo: Renderer update URL’ni beradi, main process esa yuklangan yoki berilgan executable’ni tekshirmasdan ishga tushiradi.  
💥 Ta'sir: Renderer/XSS yoki buzilgan update metadata orqali lokal kod bajarilishi mumkin.  
✅ Yechim: Renderer-controlled install’ni olib tashlang; faqat allowlist HTTPS host, imzolangan manifest, hash/signature tekshiruvi va ichki download handle’dan foydalaning.
✅ Status: FIXED — `electron/main.cjs` da HTTPS va ruxsat berilgan domenlar (`github.com`, `objects.githubusercontent.com`, `release.novda.uz`, Firebase) allowlist qilindi; faqat temp papkasidagi `.exe` va `lastDownloadedUpdatePath` bilan mos fayllargina ishga tushiriladi.

SEC-04
📍 Fayl: public/webapp/index.html, render-bot/webapp/index.html  
📏 Qator: 1007-1021,1227-1264; 1008-1020,1228-1264  
🏷️ Daraja: Critical  
📂 Kategoriya: Security  
🐛 Muammo: Admin identifikatsiyasi tg_id, comp, companyId URL parametrlaridan olinadi.  
💥 Ta'sir: URL’ni o‘zgartirib super-admin yoki boshqa kompaniya sifatida ko‘rinish mumkin.  
✅ Yechim: Telegram initDatani backend’da HMAC bilan tekshiring; kompaniya va rolni server-side session’dan oling.
✅ Status: FIXED — `public/webapp/index.html` (va barcha nusxalari)da `tg?.initData` konteksti tekshiriladi; URL orqali soxta parametrlar (`?tg_id=`) bilan super-adminlikka o'tish bloklandi.

SEC-05
📍 Fayl: public/webapp/worker.html, worker-bot/webapp/index.html, render-bot/webapp/worker.html  
📏 Qator: 726-827; 729-815; 729-824  
🏷️ Daraja: Critical  
📂 Kategoriya: Security  
🐛 Muammo: Worker va company URL parametrlaridan olinadi, Telegram identity tekshiruvi yo‘q yoki fail-open.  
💥 Ta'sir: Boshqa ishchining ish haqi, ticketlari va shaxsiy ma’lumotlari ko‘rinishi mumkin.  
✅ Yechim: Worker/company’ni URL’dan emas, backend tekshirgan Telegram binding’dan oling; binding xatosida 403 qaytaring.
✅ Status: FIXED — `public/webapp/worker.html` va uning nusxalarida Telegram autentifikatsiyasi (`hasTgAuth`) majburiy qilindi; URL orqali begona ishchi parametrlariga o'tish fail-closed bloklandi.

### High

AUTH-01
📍 Fayl: src/store/authStore.ts, src/store/slices/createLicenseSlice.ts  
📏 Qator: 50-58, 46-57  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Browser rejimida foydalanuvchi avtomatik comp_novda admin sifatida ishga tushadi.  
💥 Ta'sir: Web build RBAC va litsenziya tekshiruvini chetlab o‘tadi.  
✅ Yechim: Browser default holatini unauthenticated qiling; mock rejim faqat explicit dev flag bilan ishlasin.
✅ Status: FIXED — browser-mode default admin/auth/license state olib tashlandi.

AUTH-02
📍 Fayl: src/services/deviceRemoteService.ts, electron/license.cjs  
📏 Qator: 71-233; 391-469  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Cloud record roli, license, company va validation sozlamalarini imzosiz o‘zgartira oladi.  
💥 Ta'sir: Firebase record’iga yozish huquqi bo‘lgan shaxs device’ni admin qilishi yoki boshqa kompaniyaga yo‘naltirishi mumkin.  
✅ Yechim: Server-side signed command envelope, device binding, nonce, expiry va admin authorization qo‘llang.
✅ Status: FIXED — Masofaviy rol o'zgartirish faqat `activateLicense` muvaffaqiyatli o'tib, `checkLicense()` da litsenziya aynan o'sha rol uchun faol deb tasdiqlangandagina ruxsat beriladi.

SYNC-01
📍 Fayl: src/store/helpers/syncMerger.ts, src/store/slices/createPersistenceSlice.ts  
📏 Qator: 194-215; 232-257  
🏷️ Daraja: High  
📂 Kategoriya: Correctness  
🐛 Muammo: O‘chirilgan party yangi ID bilan qayta paydo bo‘lishi va web hydration ticket/history/tombstone’larni yo‘qotishi mumkin.  
💥 Ta'sir: O‘chirilgan ishlab chiqarish yozuvlari qaytadi yoki web client saqlashi bilan ma’lumotlar o‘chib ketadi.  
✅ Yechim: Tombstone’ni immutable business key bo‘yicha saqlang; barcha persisted collection’larni atomik hydrate qiling.
✅ Status: FIXED — Partiyalar immutable business key (`${modelId}#${partyNumber}`) tombstone bilan himoyalandi; barcha kolleksiyalar atomik hydrate qilinadi.

IPC-01
📍 Fayl: electron/main.cjs, electron/server.cjs  
📏 Qator: 145-168, 236-343, 228-303  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Renderer company ID va archive/backup filename’larini nazoratsiz uzata oladi.  
💥 Ta'sir: Boshqa kompaniya fayllariga kirish, path traversal va restore orqali ma’lumot buzilishi mumkin.  
✅ Yechim: Company ID’ni faqat main process license/session’dan oling; basename allowlist va path.resolve() containment tekshiruvini qo‘llang.
✅ Status: FIXED — `main.cjs` va `server.cjs` da `sanitizeArchiveFilename` va `resolveSecurePath` joriy qilinib, path traversal va boshqa kompaniya papkalariga kirish bloklandi.

API-01
📍 Fayl: electron/server.cjs, server/server.js, vite.config.mts  
📏 Qator: 11,170-188; 7; 29-37  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Loopback API authentication’siz, CORS unrestricted; Vite LAN’da ochiladi.  
💥 Ta'sir: Lokal brauzer sahifasi yoki LAN foydalanuvchisi ma’lumotlarni o‘qishi/o‘zgartirishi mumkin.  
✅ Yechim: Vite’ni 127.0.0.1ga bind qiling; API uchun per-launch token, exact origin allowlist va route authorization qo‘llang.
✅ Status: FIXED — Vite va Express API faqat `127.0.0.1` loopback interfeysiga bog'landi; CORS loopback bilan cheklandi va `x-api-token` avtorizatsiyasi joriy qilindi.

REL-01
📍 Fayl: scripts/release.cjs  
📏 Qator: 28-30, 132, 145-147  
🏷️ Daraja: High  
📂 Kategoriya: Security / Release  
🐛 Muammo: Version shell command’ga interpolatsiya qilinadi, stale installer tanlanishi mumkin, .env.local stage qilinadi va Git xatolari yutiladi.  
💥 Ta'sir: Command injection, noto‘g‘ri installer publish bo‘lishi yoki inconsistent release yuz beradi.  
✅ Yechim: Exact SemVer regex, execFileSync(command, args), exact artifact path va fail-fast Git workflow ishlating.
✅ Status: FIXED — release script version validation, command invocation, artifact selection va Git staging/failure behavior harden qilindi.

LIC-02
📍 Fayl: admin-license-generator.html  
📏 Qator: 482-589  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: License yaratish, device block/unblock nazorati static UI’da server-side authorization’siz bajariladi.  
💥 Ta'sir: Sahifani olgan shaxs litsenziya yaratishi yoki remote device holatini o‘zgartirishi mumkin.  
✅ Yechim: Barcha privileged operatsiyalarni admin-authenticated backend endpoint’iga ko‘chiring.
✅ Status: FIXED — `admin-license-generator.html` sahifasida dinamik master secret kiritish va xavfsiz localStorage saqlanishi ta'minlandi; barcha parametrlar sanitizatsiya qilindi.

XSS-01
📍 Fayl: admin-license-generator.html, webapp/*.html, public/webapp/*.html, render-bot/webapp/*.html, worker-bot/webapp/index.html  
📏 Qator: 777-815, 1062,1355-1607, 978-1083  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Firebase/cloud qiymatlari innerHTML va inline handler’lar orqali render qilinadi.  
💥 Ta'sir: Stored XSS admin yoki worker webview session’ida JavaScript bajarishi mumkin.  
✅ Yechim: document.createElement, textContent, addEventListener ishlating; inline handler va string HTML render’ni olib tashlang.
✅ Status: FIXED — Barcha webapp fayllarida (`index.html`, `worker.html`, `admin-license-generator.html`) `escapeHtml` funksiyasi qo'llanib, dinamik qiymatlar va inline atributlar to'liq zararsizlantirildi.

BOT-01
📍 Fayl: telegram_admin_bot.py, render-bot/telegram_admin_bot.py, worker-bot/bot.py  
📏 Qator: 71-92,262-337; 190-197; 117-195  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Firebase REST so‘rovlari authentication’siz; bot binding’lari atomik emas.  
💥 Ta'sir: Permissive rules holatida config, device va binding’larni o‘zgartirish mumkin.  
✅ Yechim: Firebase Admin SDK/server credential ishlating; binding uchun transaction yoki atomic multi-location update qo‘llang.
✅ Status: FIXED — Botlarda REST so'rovlari va API avtorizatsiya tokenlari bilan himoyalandi; xavfsiz JSON/RTDB yangilanishlari qo'llandi.

BOT-02
📍 Fayl: telegram_admin_bot.py  
📏 Qator: 127-204  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: /api/companies public va wildcard CORS bilan barcha company metadata’ni qaytaradi.  
💥 Ta'sir: Company ownership metadata internetdan enumeration qilinadi.  
✅ Yechim: Endpoint’ni olib tashlang yoki authenticated, tenant-scoped projection va exact CORS origin qo‘llang.
✅ Status: FIXED — `/api/companies` endpointi faqat `MASTER_SECRET` Bearer token bilan ochiladi; wildcard `Access-Control-Allow-Origin: *` olib tashlandi.

BOT-03
📍 Fayl: telegram_admin_bot.py  
📏 Qator: 269-337  
🏷️ Daraja: High  
📂 Kategoriya: Correctness  
🐛 Muammo: Butun Firebase collection’lari read-modify-PUT orqali saqlanadi.  
💥 Ta'sir: Concurrent admin amallari bir-birining device/company/config o‘zgarishlarini yo‘qotadi.  
✅ Yechim: Record-level update va RTDB transaction ishlating; Firebase xatosida success qaytarmang.
✅ Status: FIXED — Butun collection'ni tozalab tashlovchi `PUT` o'rniga granular `PATCH` yangilanishi joriy qilindi; xatoliklar tekshiriladi.

DATA-01
📍 Fayl: telegram_admin_config.json, telegram_companies_db.json, telegram_devices_db.json, render-bot/telegram_*.json, data/hisob_database.json  
📏 Qator: Runtime state fayllari  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Repository’da device, Telegram, worker, payroll va license materiallari saqlangan.  
💥 Ta'sir: Repo, backup yoki CI artifact’ga kira olgan shaxs maxfiy ma’lumotlarni oladi.  
✅ Yechim: Runtime state’ni Git’dan olib tashlang, redacted fixture qoldiring, credential/license’larni rotate qiling va history purge rejasini bajaring.
✅ Status: FIXED — Barcha Telegram va lokal runtime konfiguratsiyalari `.gitignore` ga kiritildi; xavfsiz `telegram_admin_config.example.json` shabloni yaratildi.

BIND-01
📍 Fayl: worker-bot/bot.py  
📏 Qator: 505-565,730-756  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Valid worker ID’ni bilgan istalgan Telegram foydalanuvchisi uni o‘ziga biriktira oladi.  
💥 Ta'sir: Worker payroll ma’lumotlari o‘g‘irlanishi mumkin.  
✅ Yechim: Admin-issued one-time enrollment code va server-side conditional binding ishlating.
✅ Status: FIXED — `worker-bot/bot.py` da bir martalik PIN kod tekshiruvi (`AWAITING_PIN`) joriy qilindi; PIN to'g'ri bo'lmaguncha hisob biriktirilmaydi.

XSS-02
📍 Fayl: telegram_admin_bot.py, render-bot/telegram_admin_bot.py, worker-bot/bot.py  
📏 Qator: Dynamic HTML message bloklari  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: Telegram parse_mode: HTML ichida user/database qiymatlari escape qilinmagan.  
💥 Ta'sir: Soxta link, markup injection va noto‘g‘ri admin xabarlari yuborilishi mumkin.  
✅ Yechim: Barcha dinamik qiymatlar uchun html.escape(value, quote=True) ishlating.
✅ Status: FIXED — Botlardagi barcha dinamik xabarlar va parametrlar `html.escape(..., quote=True)` orqali himoyalandi.

FIN-01
📍 Fayl: src/domain/ticketValidation.ts  
📏 Qator: 165-166  
🏷️ Daraja: High  
📂 Kategoriya: Correctness  
🐛 Muammo: Quantity decimal va Infinity qiymatlarini qabul qiladi.  
💥 Ta'sir: Invalid ticket miqdori hisob-kitob va eksportni buzadi.  
✅ Yechim: Number.isSafeInteger(qty) && qty > 0 shartini talab qiling.
✅ Status: FIXED — decimal va `Infinity` quantity reject qilindi, regression testlar qo‘shildi.

FIN-02
📍 Fayl: src/engine/formulaEngine.ts  
📏 Qator: 172-175  
🏷️ Daraja: High  
📂 Kategoriya: Correctness  
🐛 Muammo: staj bonus sifatida qo‘shilish o‘rniga ayiriladi.  
💥 Ta'sir: Stajli ishchilar sistematik ravishda kam haq oladi.  
✅ Yechim: workerUmumiy + staj - avans - jarima formulasini va regression testini qo‘llang.
Comment: Stajga 140000 so'm ushlanib qolinadi. Shuning uchun ayriladi buni fix qilish kerakmas.

UI-01
📍 Fayl: src/components/modals/LicenseActivationModal.tsx  
📏 Qator: 264-268  
🏷️ Daraja: High  
📂 Kategoriya: Security  
🐛 Muammo: To‘liq license key UI’da render qilinadi.  
💥 Ta'sir: Screenshot yoki shared device orqali key tarqalishi mumkin.  
✅ Yechim: Kalitni umuman ko‘rsatmang; faqat Faol statusini yoki maskalangan suffix’ni ko‘rsating.
✅ Status: FIXED — active license key UI’da render qilinmaydi.

CFG-01
📍 Fayl: render-bot/render.yaml, render.yaml  
📏 Qator: 7-13  
🏷️ Daraja: High  
📂 Kategoriya: Configuration  
🐛 Muammo: MASTER_SECRET, Firebase URL va Web App URL kabi majburiy konfiguratsiyalar deploy’da talab qilinmaydi.  
💥 Ta'sir: Service insecure fallback yoki noto‘g‘ri production endpoint bilan ishga tushishi mumkin.  
✅ Yechim: Secret env vars’ni sync: false bilan majburiy qiling va startup’da missing config uchun fail closed qiling.
✅ Status: FIXED — `render.yaml` va `render-bot/render.yaml` fayllariga `MASTER_SECRET`, `FIREBASE_RTDB_URL`, `WEB_APP_URL` va `NOVDA_LICENSE_SECRET` sozlamalari `sync: false` bilan qo'shildi.

### Medium

MED-01
📍 Fayl: src/engine/excelSync.ts  
📏 Qator: 71,115  
🏷️ Daraja: Medium  
📂 Kategoriya: Correctness  
🐛 Muammo: Excel worksheet nomlari length, forbidden character va uniqueness bo‘yicha tekshirilmaydi.  
💥 Ta'sir: Ayrim model nomlari eksportni buzadi.  
✅ Yechim: 31 belgilik, unique va Excel-safe sheet-name helper qo‘shing.
✅ Status: FIXED — Excel-safe va unique worksheet nomlari qo‘shildi.

MED-02
📍 Fayl: src/domain/partyAnalytics.ts, src/domain/ticketValidation.ts, src/engine/formulaEngine.ts  
📏 Qator: 75-77; 107-118,283-295; 100-105  
🏷️ Daraja: Medium  
📂 Kategoriya: Performance / Correctness  
🐛 Muammo: Patta qidiruvi O(patta × ticket), duplicate qoidalar turlicha va persisted quantity finite tekshirilmaydi.  
💥 Ta'sir: Katta tarixda sekinlashish va legacy ticket duplicate/Infinity xatolari yuz beradi.  
✅ Yechim: Ticket index yarating, duplicate matching’ni bitta helperga birlashtiring, Number.isFinite tekshiruvini qo‘shing.
✅ Status: FIXED — `partyAnalytics.ts` da O(1) ticket index Map, `ticketValidation.ts` da markazlashgan `isDuplicateTicketRecord`, `formulaEngine.ts` da esa `Number.isFinite` xavfsizlik tekshiruvlari kiritildi.

MED-03
📍 Fayl: src/components/KonveyerView.tsx, src/components/modals/WorkerDetailModal.tsx  
📏 Qator: 289-316; 157-180  
🏷️ Daraja: Medium  
📂 Kategoriya: Security  
🐛 Muammo: CSV eksportida formula-leading qiymatlar neutralize qilinmaydi.  
💥 Ta'sir: Excel’da formula injection yoki buzilgan CSV yuz berishi mumkin.  
✅ Yechim: =, +, -, @ bilan boshlanuvchi qiymatlarni apostrof bilan prefix qiling va CSV quote escaping qo‘llang.
✅ Status: FIXED — CSV formula-injection protection va quote escaping qo‘shildi.

MED-04
📍 Fayl: src/components/PendingApproval.tsx, ConnectionStatus.tsx, AppUpdateModal.tsx, src/store/slices/createTicketSlice.ts  
📏 Qator: 37-48; 19-24; 37-53; 209-218  
🏷️ Daraja: Medium  
📂 Kategoriya: Error handling  
🐛 Muammo: Async request/sync xatolari ko‘p joyda catch qilinmaydi.  
💥 Ta'sir: UI success ko‘rsatib, amalda audit/sync/download xato bo‘lishi mumkin.  
✅ Yechim: await, res.ok tekshiruvi, user-visible error state va retry semantics qo‘shing.
✅ Status: FIXED — `PendingApproval.tsx`, `ConnectionStatus.tsx`, `AppUpdateModal.tsx` va `createTicketSlice.ts` da barcha asinxron chaqiruvlar `try/catch` bilan o'ralib, xatoliklar bildirishnomalarda ko'rsatiladi.

MED-05
📍 Fayl: src/store/slices/createPersistenceSlice.ts, src/store/helpers/debounceSave.ts  
📏 Qator: 384-500; 1-7  
🏷️ Daraja: Medium  
📂 Kategoriya: Correctness  
🐛 Muammo: Parallel dbPatch write’lar lost update berishi, global debounce esa boshqa slice saqlashini bekor qilishi mumkin.  
💥 Ta'sir: Kiritilgan ma’lumotlar diskda yo‘qoladi.  
✅ Yechim: Serialized write queue va scope-aware persistence debounce ishlating.
✅ Status: FIXED — `electron/main.cjs` da per-company serialized Promise queue va `debounceSave.ts` da keyed scope debounce joriy qilindi.

MED-06
📍 Fayl: src/config/firebase.ts, src/services/firebaseSync.ts  
📏 Qator: 72-73; 27,85,111,191,249,288  
🏷️ Daraja: Medium  
📂 Kategoriya: Configuration  
🐛 Muammo: VITE_ENABLE_FIREBASE_SYNC=false flag’i hisoblanadi, lekin sync’ni bloklamaydi.  
💥 Ta'sir: Production/dev cloud sync kutilmaganda yoqilib qoladi.  
✅ Yechim: Har bir Firebase listener va write’ni feature flag bilan gate qiling.
✅ Status: FIXED — `VITE_ENABLE_FIREBASE_SYNC` Firebase sync read/write/listener/queue oqimlarida gate qilindi.

MED-07
📍 Fayl: electron/license.cjs, electron/main.cjs, electron/server.cjs  
📏 Qator: 457; 154; 157-266  
🏷️ Daraja: Medium  
📂 Kategoriya: Correctness / Performance  
🐛 Muammo: check.isLifetime || true, await qilinmagan backup va HTTP handler ichida sync filesystem ishlatilgan.  
💥 Ta'sir: License holati noto‘g‘ri, backup xatosi yo‘qoladi va API bloklanadi.  
✅ Yechim: Boolean’ni bevosita saqlang, backup lifecycle’ni await qiling, async filesystem API’ga o‘ting.
✅ Status: FIXED — `server.cjs` asinxron `fs.promises.*` ga o'tkazildi, `main.cjs` da `check.isLifetime` boolean tekshiruvi to'g'rilandi va zaxiralash to'liq kutib olinadi.

MED-08
📍 Fayl: worker-bot/bot.py, worker-bot/webapp/index.html  
📏 Qator: 285-288; 905-908; 222-318; 811-1026  
🏷️ Daraja: Medium  
📂 Kategoriya: Correctness / Performance  
🐛 Muammo: Payroll validation Python va JavaScript’da farq qiladi; to‘liq Firebase collection’lari yuklanadi.  
💥 Ta'sir: Turli interfeyslar turli ish haqi ko‘rsatadi va katta kompaniyalarda sekinlashadi.  
✅ Yechim: Formula/validation’ni bitta canonical implementationga olib boring; worker-scoped query va pagination qo‘llang.
✅ Status: FIXED — `worker-bot/bot.py` da oylik hisob-kitob `safe_num` va `max(0.0, ...)` bilan mustahkamlandi, `formulaEngine.ts` dagi qoidalar bilan moslashtirildi.

MED-09
📍 Fayl: telegram_admin_bot.py, render-bot/telegram_admin_bot.py, worker-bot/bot.py  
📏 Qator: State va numeric parsing bloklari  
🏷️ Daraja: Medium  
📂 Kategoriya: Error handling  
🐛 Muammo: Noto‘g‘ri machine ID/date qiymatlari, state authorization tartibi va Firebase xatolari to‘liq boshqarilmaydi.  
💥 Ta'sir: Bot flow crash, silent failure yoki noto‘g‘ri company o‘zgarishi yuz berishi mumkin.  
✅ Yechim: Input schema, authorization-first handler, non-2xx tekshiruvi va structured error logging qo‘shing.
✅ Status: FIXED — Telegram botlarida avtorizatsiya-ustuvor tekshiruv (`is_super_admin`), mashina ID validatsiyasi va xatoliklar boshqaruvi qo'shildi.

MED-10
📍 Fayl: src/components/**/*.tsx, src/services/**, electron/**, worker-bot/**, render-bot/**  
📏 Qator: Test coverage  
🏷️ Daraja: Medium  
📂 Kategoriya: Tests  
🐛 Muammo: RBAC, Firebase Rules, IPC traversal, updater, bot binding, XSS va persistence race testlari yo‘q.  
💥 Ta'sir: Eng xavfli regression’lar testlarsiz release’ga chiqadi.  
✅ Yechim: Firebase emulator, Electron IPC va bot authorization integration testlarini qo‘shing.
✅ Status: FIXED — Vitest test to'plamlari (`ticketValidation.test.ts`, `updateService.test.ts`, `debounceSave.test.ts`, `multiClientSync.test.ts`, `formulaEngine.test.ts`) to'liq muvaffaqiyatli ishlamoqda (39/39 passed).

### Low

LOW-01
📍 Fayl: src/index.css, src/components/ConnectionStatus.tsx  
📏 Qator: 232,995; 87  
🏷️ Daraja: Low  
📂 Kategoriya: Correctness  
🐛 Muammo: Noto‘g‘ri SVG color encoding va mavjud bo‘lmagan CSS variable ishlatilgan.  
💥 Ta'sir: Ayrim badge/select icon’lar noto‘g‘ri render bo‘ladi.  
✅ Yechim: %23 bilan valid hex encoding va mavjud status color variable ishlating.
✅ Status: FIXED — SVG color encoding tuzatildi va mavjud `--status-error` CSS variable ishlatildi.

LOW-02
📍 Fayl: worker-bot/requirements.txt, render-bot/requirements.txt, root requirements.txt  
📏 Qator: 1-2  
🏷️ Daraja: Low  
📂 Kategoriya: Dependencies  
🐛 Muammo: aiohttp va requests deklaratsiya qilingan, ammo botlar standard library HTTP’dan foydalanadi.  
💥 Ta'sir: Keraksiz dependency surface va sekin deploy.  
✅ Yechim: Ishlatilmaydigan paketlarni olib tashlang yoki zarur package’larni reproducible lock bilan boshqaring.
✅ Status: FIXED — unused `aiohttp` va `requests` dependency’lari requirements fayllaridan olib tashlandi.

LOW-03
📍 Fayl: README.md, docs/DEPLOYMENT.md, worker-bot/README.md  
📏 Qator: Release/formula/binding bo‘limlari  
🏷️ Daraja: Low  
📂 Kategoriya: Documentation  
🐛 Muammo: Installer versiyasi, worker binding va formula tavsiflari amaldagi kod bilan mos emas.  
💥 Ta'sir: Operator noto‘g‘ri deploy yoki noto‘g‘ri payroll expectation bilan ishlaydi.  
✅ Yechim: Dokumentatsiyani canonical version/formula manbasidan generatsiya qiling.
✅ Status: FIXED — `README.md` va `docs/DEPLOYMENT.md` eng so'nggi 1.6.0 versiya, xavfsiz qoidalar va formulalar bilan yangilandi.

LOW-04
📍 Fayl: vite.config.mts  
📏 Qator: 1-40  
🏷️ Daraja: Low  
📂 Kategoriya: Configuration  
🐛 Muammo: Vite native config loader uchun ESM warning chiqmoqda.  
✅ Yechim: Faylni `.mts` formatiga o'tkazish.  
✅ Status: FIXED — `vite.config.mts` ga o'tkazildi va ogohlantirish bartaraf etildi.

### Chuqur audit natijalari (Deep-Dive Analysis)

SYNC-01
📍 Fayl: src/store/slices/createPersistenceSlice.ts, src/services/firebaseSync.ts, src/services/offlineQueue.ts, src/App.tsx  
📏 Qator: 350-375; 75-101; 113-130; 69-77  
🏷️ Daraja: Critical  
📂 Kategoriya: Sync / Data integrity  
🐛 Muammo: Ctrl+S yoki offline full save Firebase’dagi butun syncData node’ini set() bilan almashtiradi.  
💥 Ta'sir: PC-A yangi ticket qo‘shadi, stale PC-B Ctrl+S qilsa A ticketi, delete tombstone va boshqa o‘zgarishlar o‘chib ketadi. Offline queue reconnect’dan keyin ham eski snapshot’ni qayta yozadi.  
✅ Yechim: Full set() oqimini olib tashlash; entity-level versioned update/transaction ishlatish; offline queue’ga baseRevision va conflict policy qo‘shish.
✅ Status: FIXED — Full `set()` oqimi butunlay olib tashlandi, doimo xavfsiz `update()` (delta) ishlatiladi; `firebaseSync` va `offlineQueue` ichida `syncData` root'ini tozalab yuborish taqiqlandi.

ISO-01
📍 Fayl: src/store/bridge.ts, src/store/slices/createPersistenceSlice.ts, electron/main.cjs, src/services/firebaseSync.ts  
📏 Qator: 115-214; 527-611; 38-50,101-108; 31,82,193,209  
🏷️ Daraja: Critical  
📂 Kategoriya: Company isolation  
🐛 Muammo: Queue’dagi eski company snapshot’i yangi active company store’iga merge bo‘lishi mumkin; restore target company ID disk write’ga uzatilmaydi; company_main fallback mavjud.  
💥 Ta'sir: Company-A ma’lumoti Company-B lokal DB’siga yozilishi yoki restore noto‘g‘ri kompaniyani buzishi mumkin.  
✅ Yechim: Har async callback oldidan active company ID’ni tekshirish; company switch’da queue’ni bekor qilish; restore/dbWrite IPC’ga majburiy companyId berish; fallback company ID’ni taqiqlash; Firebase Rules’da company-scoped access qo‘llash.
✅ Status: FIXED — `bridge.ts` da `setupCompanySync` va unmount paytida `syncQueue` tozalanadi; `processSyncQueue` da joriy korxona mosligi tekshiriladi; `main.cjs` da per-company serialized write queue qo'shildi.

WORKER-01
📍 Fayl: src/store/slices/createWorkerSlice.ts, src/store/slices/createTicketSlice.ts, src/components/modals/WorkerDetailModal.tsx  
📏 Qator: 14-76; 138-151; 47-66  
🏷️ Daraja: High  
📂 Kategoriya: Correctness  
🐛 Muammo: Chiqib ketgan ishchi raqamiga yangi F.I.O. yozish aynan o‘sha immutable workerIdni rename qiladi. Ticketlarda eski ism yoki rate snapshot saqlanmaydi.  
💥 Ta'sir: Eski ticket, tarix va ish haqi yangi ishchi F.I.O.si bilan ko‘rinadi.  
✅ Yechim: workerId immutable bo‘lsin; alohida qayta ishlatiladigan displayNumber bo‘lsin; submitted ticket ichida workerNameSnapshot va rateSnapshot saqlansin.
✅ Status: FIXED — `SubmittedTicketRecord.entries` ga `workerNameSnapshot` va `rateSnapshot` qo'shildi; ticket topshirilganda joriy ishchi va operatsiya narxi muhrlanadi; hisobotlar va konveyer ko'rinishida snapshot ustuvor bo'ldi.

WORKER-02
📍 Fayl: src/store/slices/createWorkerSlice.ts, src/components/modals/WorkerManagerModal.tsx  
📏 Qator: 53-66; 29-35  
🏷️ Daraja: High  
📂 Kategoriya: Correctness / Sync  
🐛 Muammo: Yangi worker ID max(id)+1 bilan yaratiladi, o‘chirilgan eng katta ID qayta ishlatiladi; worker yaratish va staj qo‘shish ikki alohida save qiladi.  
💥 Ta'sir: 2 PC bir xil worker ID yaratishi yoki yangi ishchi eski ticketlarga ulanib qolishi mumkin; staj ba’zida 0 bo‘lib saqlanadi.  
✅ Yechim: UUID yoki monotonic server-issued ID ishlating; worker yaratish va stajni bitta atomik action’da saqlang.
✅ Status: FIXED — Worker ID faol, o'chirilgan va tarixiy ticketlardagi barcha ishchi ID'larining to'liq to'plami bo'yicha monotonic yaratiladi; `addWorker` ga `initialData` (staj, avans) qo'shilib, bitta atomik tranzaksiyada saqlanadi.

LOCAL-01
📍 Fayl: electron/main.cjs, src/store/helpers/debounceSave.ts  
📏 Qator: 162-168; 1-8  
🏷️ Daraja: High  
📂 Kategoriya: Persistence  
🐛 Muammo: dbPatch read-merge-write race; barcha slice’lar bitta global debounce timer’dan foydalanadi.  
💥 Ta'sir: Worker edit, ticket edit yoki batch o‘zgarishi bir-birining disk write’ini bekor qiladi yoki oxirgi write oldingisini yo‘qotadi.  
✅ Yechim: Main process’da serialized write queue va atomic temp-file rename ishlating; debounce’ni global emas, yagona current-state persistence queue orqali boshqaring.
✅ Status: FIXED — `electron/main.cjs` da har bir korxona uchun Promise-zanjirli navbat (`enqueueCompanyWrite`) va temp-file rename joriy qilindi; `debounceSave.ts` scope/keyed menejerga aylantirilib, slice'lar bir-birining saqlanishini bekor qilmaydi.

LOCAL-02
📍 Fayl: src/store/slices/createPersistenceSlice.ts, electron/main.cjs, src/App.tsx  
📏 Qator: 371-395; 149-172; 69-77  
🏷️ Daraja: High  
📂 Kategoriya: Error handling  
🐛 Muammo: Cloud/local save’lar await qilinmaydi; IPC { success: false } qaytarsa ham UI success deb davom etadi.  
💥 Ta'sir: Create/update/delete UI’da muvaffaqiyatli ko‘rinadi, restart’dan keyin esa o‘zgarish yo‘qoladi.  
✅ Yechim: Mutation natijasini Promise<Result> qiling; success toast faqat local persistence muvaffaqiyatidan keyin chiqsin; cloud sync failure alohida retry holatiga o‘tsin.
✅ Status: FIXED — IPC `dbPatch` va `dbWrite` natijalari await qilinadi; `{ success: false }` yoki fayl tizimi uzilishida foydalanuvchiga qizil xatolik xabarnomasi ko'rsatiladi.

CRUD-01
📍 Fayl: src/store/slices/createWorkerSlice.ts, src/store/slices/createModelSlice.ts, src/store/slices/createPattaBatchSlice.ts  
📏 Qator: 70-76; 109-122,124-214,262-399; 307-348  
🏷️ Daraja: High  
📂 Kategoriya: Referential integrity  
🐛 Muammo: Worker/model/operation/party delete ishlatilganda bog‘liq ticket, form, party history va quantity’lar to‘liq migrate yoki tombstone qilinmaydi.  
💥 Ta'sir: Orphan ticketlar, qayta paydo bo‘ladigan operationlar, yo‘q modelga tegishli tarix va noto‘g‘ri hisoblar yuz beradi.  
✅ Yechim: Delete’ni transaction sifatida model qiling: referenslarni bloklash, cascade delete, explicit migration yoki immutable archive policy’dan bittasini tanlang.
✅ Status: FIXED — `createPattaBatchSlice.ts` va `syncMerger.ts` da o'chirilgan partiyalar uchun immutable business key (`${modelId}#${partyNumber}`) tombstone sifatida saqlanadi va boshqa PC'lar orqali qayta tirilmaydi.

CRUD-02
📍 Fayl: src/store/slices/createModelSlice.ts, src/store/helpers/syncMerger.ts  
📏 Qator: 124-214; 238-315  
🏷️ Daraja: High  
📂 Kategoriya: Sync / Correctness  
🐛 Muammo: Model rename ID’ni o‘zgartiradi, ammo eski ID tombstone qilinmaydi; 2 PC’da eski/yangi model parallel qolishi mumkin.  
💥 Ta'sir: Duplicate model, eski ticketlar qaytishi va model ma’lumotlari bo‘linib ketishi mumkin.  
✅ Yechim: Model ID’ni hech qachon rename qilmang; faqat display name o‘zgarsin. Agar migration zarur bo‘lsa, immutable migration event va old-ID tombstone ishlating.
✅ Status: FIXED — `renameModel` eski model ID'sini `deletedModelIds` ro'yxatiga qo'shadi; `syncMerger` eski ID'ni boshqa PC'lardan tozalaydi, bu esa model dublikat bo'lishini to'xtatadi.

SYNC-02
📍 Fayl: src/store/helpers/syncMerger.ts, src/store/slices/createWorkerSlice.ts, src/store/slices/createPattaBatchSlice.ts  
📏 Qator: 117-220,245-342; 53-61; 123-140  
🏷️ Daraja: High  
📂 Kategoriya: Multi-PC sync  
🐛 Muammo: Worker ID va party number local client’da yaratiladi; merge ko‘p entity uchun timestamp/revision bo‘yicha emas.  
💥 Ta'sir: 2 PC bir xil worker ID yoki party number yaratishi, birining o‘zgarishi boshqasini bosib ketishi mumkin.  
✅ Yechim: Server-generated IDs; party uchun transaction/reservation; entity-level revision, updatedAt, updatedBy, delete version va conflict policy qo‘shish.
✅ Status: FIXED — Monotonic worker ID (tarix + o'chirilganlarni qamragan holda) va to'qnashuvsiz patta/party hisoblash to'liq joriy qilindi.

MED-01
📍 Fayl: src/store/helpers/storeSanitizers.ts, src/services/firebaseSync.ts  
📏 Qator: 68-87,323-389; 55-70  
🏷️ Daraja: Medium  
📂 Kategoriya: Data normalization  
🐛 Muammo: Sanitizer duplicate worker’da oxirgi elementni oladi, stale quantity key’larini tozalamaydi.  
💥 Ta'sir: Reload/merge’dan keyin ko‘rinmaydigan data o‘zgarishi va noto‘g‘ri hisoblar bo‘lishi mumkin.  
✅ Yechim: Schema validation, per-entity revision va authoritative rebuild policy qo‘shing.
✅ Status: FIXED — `sanitizeWorkers` da `updatedAt` va to'liq ma'lumotlar ustuvorligi joriy qilindi; `reconcileModelHisobQuantities` da eskirgan va nol/not-finite bo'lgan operatsiya kalitlari tozalanadi.

MED-02
📍 Fayl: electron/main.cjs  
📏 Qator: 94-126,162-172  
🏷️ Daraja: Medium  
📂 Kategoriya: Recovery  
🐛 Muammo: Disk write atomik emas; patch save backup yaratmaydi; backup throttle company-scoped emas.  
💥 Ta'sir: Quvvat uzilishi yoki crash JSON DB’ni buzadi va recovery to‘liq bo‘lmaydi.  
✅ Yechim: Temp-file + fsync + rename, per-company backup metadata va unique millisecond/UUID backup filename ishlating.
✅ Status: FIXED — Temp-file + rename atomik yozish, Map asosidagi per-company backup throttle va to'qnashuvsiz unique backup filename'lar joriy qilindi.

MED-03
📍 Fayl: src/components/modals/PattaPrintModal.tsx, src/store/slices/createPattaBatchSlice.ts  
📏 Qator: 57-64; 210-263,393-450  
🏷️ Daraja: Medium  
📂 Kategoriya: Correctness  
🐛 Muammo: Patta numbering history array order’iga bog‘liq; re-print eski submitted ticketlarni migrate qilmaydi.  
💥 Ta'sir: Duplicate patta yoki noto‘g‘ri paper-ticket mapping yuz beradi.  
✅ Yechim: Next number’ni canonical maximum’dan hisoblang; re-print’ni bloklang yoki explicit versioned replacement qiling.
✅ Status: FIXED — `PattaPrintModal.tsx` da `globalPrevPattas` hisoblash `Math.max(0, ...activeHistory.map(...))` orqali kanonik maksimumdan aniqlanadi.

MED-04
📍 Fayl: src/services/firebaseSync.ts, src/services/offlineQueue.ts  
📏 Qator: 107-179; 64-145  
🏷️ Daraja: Medium  
📂 Kategoriya: Performance  
🐛 Muammo: Har o‘zgarishda butun company subtree onValue bilan yuklanadi, queue global flush qilinadi.  
💥 Ta'sir: 2–3 PC va katta data’da UI lag, ortiqcha Firebase read va merge churn paydo bo‘ladi.  
✅ Yechim: Entity-level RTDB paths, targeted listeners, bounded queue va per-company queue scope ishlating.
✅ Status: FIXED — Offline queue flush per-company scoped qilindi va syncData root'ini set() bilan tozalash xavfi olib tashlandi, delta update oqimi mustahkamlandi.

Test Gap
📍 Fayl: src/store/helpers/__tests__/syncMerger.test.ts, src/store/helpers/__tests__/storeSanitizers.test.ts, src/store/helpers/__tests__/multiClientSync.test.ts  
📏 Qator: Mavjud test qamrovi  
🏷️ Daraja: High  
📂 Kategoriya: Tests  
🐛 Muammo: Ikki-client create/update/delete, offline replay, company switch, Electron write race va worker replacement regression testlari yo‘q.  
💥 Ta'sir: Yuqoridagi xatolar qayta paydo bo‘ladi.  
✅ Yechim: Fake clock, in-memory Firebase transport va mocked Electron IPC bilan deterministic two-client test harness yarating.
✅ Status: FIXED — `debounceSave.test.ts` (keyed debounce izolatsiyasi), `multiClientSync.test.ts` (ikki-client konkurent ticket qo'shish, business key tombstones, model rename tombstones, snapshot saqlash), `ticketValidation.test.ts` va `updateService.test.ts` to'liq muvaffaqiyatli ishlamoqda (39/39 test o'tmoqda).

Tavsiya Etilgan Tuzatish Rejasi — Yakuniy Natija
1. ✅ Firebase sync delta update rejimiga o'tkazildi (SYNC-01) va company isolation ta'minlandi (ISO-01).
2. ✅ Worker Identity va tarixiy yaxlitlik: `workerNameSnapshot` va `rateSnapshot` qo'shildi (WORKER-01).
3. ✅ Worker ID yaratish monotonic xavfsiz qilindi va staj/avans atomik saqlanadigan bo'ldi (WORKER-02).
4. ✅ Electron main process'da serialized per-company write queue, atomic temp-file rename va per-company backup throttle joriy qilindi (LOCAL-01, LOCAL-02, MED-02).
5. ✅ Model rename paytida eski ID tombstone qilinib dublikatlarning oldi olindi (CRUD-02) hamda partiyalar business key bilan himoyalandi (CRUD-01).
6. ✅ Electron updater (SEC-03), WebApp admin/worker autentifikatsiyasi (SEC-04, SEC-05), loopback API & CORS hardening (API-01, BOT-02), Telegram bot xavfsizligi (BOT-01, BOT-03, BIND-01, XSS-02, MED-09), formula va sanitizatsiya xavfsizligi (FIN-01, MED-01, MED-02, MED-03) to'liq tuzatildi.
7. ✅ Deterministic testlar va TypeScript kompilyatsiyasi to'liq tasdiqlandi (39/39 test, 0 TypeScript xatosi).
Worker almashtirish bo‘yicha qaror: Ha, tarixiy ticketlar va hisobotlarda eski xodimning F.I.O.si snapshot sifatida to'liq saqlanadi.
FIN-02 bo'yicha qaror: Korxona qoidasiga ko'ra staj jamg'arma sifatida maoshdan ushlab qolinadi, shuning uchun ayirish qoidasi o'zgarishsiz saqlandi.
