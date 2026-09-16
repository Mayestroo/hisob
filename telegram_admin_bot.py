#!/usr/bin/env python3
"""
Novda Hisob-Kitob — Telegram Admin Boshqaruv Boti (100% Tugmali Menyu)
Bot: @hisobmonitoringbot
"""

import sys
import os
import json
import time
import hmac
import hashlib
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta
import urllib.request
import urllib.parse

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
DEFAULT_ADMIN_CHAT_ID = int(os.environ.get("ADMIN_CHAT_ID", "1526974123"))
PORT = int(os.environ.get("PORT", "8080"))
MASTER_SECRET = os.environ.get('MASTER_SECRET', 'NOVDA_2026_MASTER_SECRET_SECURITY_SALT_KEY_HISOB_PROD')
FIREBASE_RTDB_URL = os.environ.get("FIREBASE_DATABASE_URL", "https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app")
DB_FILE = os.path.join(os.path.dirname(__file__), 'telegram_devices_db.json')
CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'telegram_admin_config.json')
COMPANIES_FILE = os.path.join(os.path.dirname(__file__), 'telegram_companies_db.json')

def load_companies():
    # 1. Firebase Realtime Database (bulutdagi doimiy xotira)dan olish
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/companies_meta.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'NovdaBot/1.0'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if isinstance(data, dict) and len(data) > 0:
                save_companies_local(data)
                return data
    except Exception as e:
        print(f"[Firebase Sync] load_companies ogohlantirish: {e}")

    # 2. Lokal fayl zaxirasi
    if os.path.exists(COMPANIES_FILE):
        try:
            with open(COMPANIES_FILE, 'r', encoding='utf-8') as f:
                comps = json.load(f)
                if isinstance(comps, dict) and len(comps) > 0:
                    save_companies(comps)
                    return comps
        except Exception:
            pass

    default_companies = {
        "company_main": {
            "id": "company_main",
            "name": "Asosiy Korxona (Standart)",
            "createdAt": "2026-08-01T00:00:00",
            "requireTicketValidation": True
        }
    }
    save_companies(default_companies)
    return default_companies

def save_companies_local(comps):
    try:
        with open(COMPANIES_FILE, 'w', encoding='utf-8') as f:
            json.dump(comps, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def save_companies(comps):
    save_companies_local(comps)
    # Doimiy Firebase bulutiga saqlash (Render o'chib-yonganida ham yo'qolmaydi)
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/companies_meta.json"
        req = urllib.request.Request(
            url,
            data=json.dumps(comps).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='PUT'
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Korxonalar Firebase bulutiga saqlandi.")
    except Exception as e:
        print(f"[Firebase Sync Error] save_companies xatosi: {e}")

def update_firebase_device(mach_id, payload):
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/devices/{mach_id}.json"
        data_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={'Content-Type': 'application/json'},
            method='PATCH'
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Firebase updated for {mach_id}: {payload}")
            return True
    except Exception as e:
        print(f"[Firebase Error] Failed to update {mach_id}: {e}")
        return False

# Session state for user inputs (e.g. awaiting device ID for key generation)
user_states = {}

def get_webapp_url(comp_id=None):
    custom_url = os.environ.get("WEBAPP_URL", "").strip()
    if not custom_url:
        render_url = os.environ.get("RENDER_EXTERNAL_URL", "").strip()
        if render_url:
            custom_url = f"{render_url.rstrip('/')}/webapp"
        else:
            custom_url = "https://hisobmonitoringbot.onrender.com/webapp"
    if comp_id:
        sep = "&" if "?" in custom_url else "?"
        return f"{custom_url}{sep}comp={comp_id}"
    return custom_url

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        req_path = parsed.path

        if req_path in ('/webapp', '/webapp/', '/tma', '/tma/', '/'):
            html_candidates = [
                os.path.join(os.path.dirname(__file__), 'webapp', 'index.html'),
                os.path.join(os.path.dirname(__file__), 'public', 'webapp', 'index.html'),
                os.path.join(os.path.dirname(__file__), 'dist', 'webapp', 'index.html'),
            ]
            content = None
            for p in html_candidates:
                if os.path.exists(p):
                    try:
                        with open(p, 'rb') as f:
                            content = f.read()
                        break
                    except Exception:
                        pass

            if content:
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
                return

        if req_path in ('/worker-app', '/worker-app/', '/worker', '/worker/', '/webapp/worker.html'):
            html_candidates = [
                os.path.join(os.path.dirname(__file__), 'webapp', 'worker.html'),
                os.path.join(os.path.dirname(__file__), 'public', 'webapp', 'worker.html'),
                os.path.join(os.path.dirname(__file__), 'dist', 'webapp', 'worker.html'),
            ]
            content = None
            for p in html_candidates:
                if os.path.exists(p):
                    try:
                        with open(p, 'rb') as f:
                            content = f.read()
                        break
                    except Exception:
                        pass

            if content:
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
                return

        if req_path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"status": "ok", "bot": "Novda Telegram Admin Bot 24/7"}')
            return

        if req_path == '/api/companies':
            comps = load_companies()
            data_bytes = json.dumps(comps, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data_bytes)
            return

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'{"status": "ok", "bot": "Novda Telegram Admin Bot 24/7"}')

    def log_message(self, format, *args):
        pass

def start_health_server():
    try:
        server = HTTPServer(('0.0.0.0', PORT), HealthHandler)
        print(f"Health server running on port {PORT}")
        server.serve_forever()
    except Exception as e:
        print(f"Health server note: {e}")

def keep_alive_ping():
    """
    Render.com Free Web Service larini 15 daqiqada uxlab (sleep) qolishini oldini oluvchi
    avtomatik Self-Ping (Heartbeat) mexanizmi. Har 8 daqiqada o'zini-o'zi uyg'otib turadi!
    """
    print("Anti-sleep Keep-Alive mexanizmi faollashdi.")
    while True:
        try:
            time.sleep(480) # har 8 daqiqada bir marta
            render_url = os.environ.get("RENDER_EXTERNAL_URL")
            if render_url:
                url = render_url.rstrip('/') + '/'
                req = urllib.request.Request(url, headers={'User-Agent': 'Novda-KeepAlive-Heartbeat/1.0'})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Keep-alive ping muvaffaqiyatli: {resp.status}")
            else:
                # Local fallback ping
                req = urllib.request.Request(f"http://127.0.0.1:{PORT}/", headers={'User-Agent': 'Novda-KeepAlive/1.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    pass
        except Exception as e:
            print(f"Keep-alive ping eslatma: {e}")

def load_db():
    # 1. Doimiy Firebase bulutidan qurilmalarni o'qish (Render deploy bo'lsa ham yo'qolmaydi)
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/devices.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'NovdaBot/1.0'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if isinstance(data, dict) and len(data) > 0:
                save_db_local(data)
                return data
    except Exception as e:
        print(f"[Firebase Sync] load_db ogohlantirish: {e}")

    # 2. Lokal fayl zaxirasi
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_db_local(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def save_db(data):
    save_db_local(data)
    # Firebase bulutiga ham to'liq saqlash
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/devices.json"
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='PUT'
        )
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception as e:
        print(f"[Firebase Sync Error] save_db xatosi: {e}")

def load_config():
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/bot_config.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'NovdaBot/1.0'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if isinstance(data, dict):
                save_config_local(data)
                return data
    except Exception:
        pass

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass

    default_cfg = {
        "super_admin_chat_ids": [DEFAULT_ADMIN_CHAT_ID],
        "admin_chat_ids": [DEFAULT_ADMIN_CHAT_ID],
        "company_owners": {
            "274466315": {
                "companyId": "comp_novda",
                "companyName": "Novda",
                "assignedAt": "2026-09-16T10:26:00"
            }
        }
    }
    return default_cfg

def save_config_local(cfg):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def save_config(cfg):
    save_config_local(cfg)
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/bot_config.json"
        req = urllib.request.Request(
            url,
            data=json.dumps(cfg).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='PUT'
        )
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception:
        pass

def is_super_admin(chat_id):
    cfg = load_config()
    super_admins = cfg.get('super_admin_chat_ids') or cfg.get('admin_chat_ids') or [DEFAULT_ADMIN_CHAT_ID]
    try:
        return int(chat_id) in [int(x) for x in super_admins]
    except Exception:
        return False

def get_user_company(chat_id):
    cfg = load_config()
    owners = cfg.get('company_owners', {})
    val = owners.get(str(chat_id)) or owners.get(int(chat_id) if str(chat_id).isdigit() else chat_id)
    if val:
        if isinstance(val, dict):
            return val
        return {'companyId': str(val), 'companyName': str(val)}
    return None

def set_company_owner(comp_id, tg_id, comp_name=None):
    cfg = load_config()
    if 'company_owners' not in cfg or not isinstance(cfg['company_owners'], dict):
        cfg['company_owners'] = {}
    if not comp_name:
        comps = load_companies()
        comp_name = comps.get(comp_id, {}).get('name', comp_id)
    cfg['company_owners'][str(tg_id)] = {
        'companyId': comp_id,
        'companyName': comp_name,
        'assignedAt': datetime.now().isoformat()
    }
    save_config(cfg)
    # Also update companies_meta
    comps = load_companies()
    if comp_id in comps:
        owners = comps[comp_id].get('ownerChatIds', [])
        if not isinstance(owners, list): owners = []
        if int(tg_id) not in [int(x) for x in owners]:
            owners.append(int(tg_id))
            comps[comp_id]['ownerChatIds'] = owners
            save_companies(comps)
    return True

def remove_company_owner(tg_id):
    cfg = load_config()
    owners = cfg.get('company_owners', {})
    str_id = str(tg_id)
    if str_id in owners:
        comp_id = owners[str_id].get('companyId') if isinstance(owners[str_id], dict) else owners[str_id]
        del owners[str_id]
        cfg['company_owners'] = owners
        save_config(cfg)
        if comp_id:
            comps = load_companies()
            if comp_id in comps and 'ownerChatIds' in comps[comp_id]:
                comps[comp_id]['ownerChatIds'] = [x for x in comps[comp_id]['ownerChatIds'] if str(x) != str_id]
                save_companies(comps)
        return True
    return False

def to_base36(val: int) -> str:
    chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if val == 0:
        return '0'
    res = []
    while val > 0:
        val, rem = divmod(val, 36)
        res.append(chars[rem])
    return ''.join(reversed(res))

def generate_key(machine_id: str, expiry: str = 'LIFETIME', role: str = 'ADMIN') -> str:
    norm_id = machine_id.strip().upper()
    norm_expiry = (expiry or 'LIFETIME').strip().upper()
    norm_role = (role or 'ADMIN').strip().upper()

    if norm_role in ('ADMIN', 'TYPE', 'PRINT'):
        payload = f"{norm_id}|{norm_expiry}|{norm_role}".encode('utf-8')
        sig_hmac = hmac.new(MASTER_SECRET.encode('utf-8'), payload, hashlib.sha256).hexdigest().upper()
        sig = sig_hmac[:8]
        mach_seg = norm_id.replace('-', '')[:4]
        return f"ACT-{norm_role}-{mach_seg}-{sig[:4]}-{sig[4:8]}"

    payload = f"{norm_id}|{norm_expiry}".encode('utf-8')
    sig_hmac = hmac.new(MASTER_SECRET.encode('utf-8'), payload, hashlib.sha256).hexdigest().upper()
    sig = sig_hmac[:8]

    if norm_expiry == 'LIFETIME':
        exp_code = 'LFT'
    else:
        d_num = int(norm_expiry.replace('-', ''))
        exp_code = 'D' + to_base36(d_num)

    mach_seg = norm_id.replace('-', '')[:4]
    return f"ACT-{exp_code}-{mach_seg}-{sig[:4]}-{sig[4:8]}"

def telegram_api(method: str, params: dict):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    try:
        data = json.dumps(params).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Telegram API error ({method}): {e}")
        return None

def send_message(chat_id, text, reply_markup=None):
    params = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'
    }
    if reply_markup:
        params['reply_markup'] = reply_markup
    return telegram_api('sendMessage', params)

def get_main_keyboard():
    # Faqat Loyiha Egasi (Super Admin) uchun
    return {
        'keyboard': [
            [
                {'text': "📱 Barcha Korxonalar Tizimi (Web App)", 'web_app': {'url': get_webapp_url()}}
            ],
            [
                {'text': '📋 Barcha Qurilmalar'},
                {'text': '🏢 Korxonalar (Sexlar)'}
            ],
            [
                {'text': '👥 Korxona Ownerlari'},
                {'text': '⚡ Kalit Yaratish'}
            ],
            [
                {'text': '🔒 Bloklash / Ochish'},
                {'text': '📊 Statistika'}
            ],
            [
                {'text': '🔄 Yangilash'}
            ]
        ],
        'resize_keyboard': True,
        'is_persistent': True
    }

def get_owner_keyboard(comp_id, comp_name):
    # Faqat Korxona Owneri uchun (Barcha admin funksiyalar bloklangan!)
    return {
        'keyboard': [
            [
                {'text': f"📱 {comp_name} Tizimini Ko'rish (Web App)", 'web_app': {'url': get_webapp_url(comp_id)}}
            ],
            [
                {'text': '🔄 Yangilash'}
            ]
        ],
        'resize_keyboard': True,
        'is_persistent': True
    }

def handle_start(chat_id, first_name):
    if is_super_admin(chat_id):
        webapp_url = get_webapp_url()
        inline_kb = {
            'inline_keyboard': [
                [
                    {'text': "📱 Barcha Korxonalar Tizimi (Web App)", 'web_app': {'url': webapp_url}}
                ]
            ]
        }
        msg = (
            f"👋 <b>Assalomu alaykum, {first_name}!</b>\n\n"
            f"👑 <b>Novda Hisob-Kitob — Loyiha Egasi (Super Admin)</b> boshqaruv botiga xush kelibsiz.\n\n"
            f"⚡ Sizda tizim ustidan to'liq nazorat mavjud: litsenziyalar, yangi korxonalar ochish va korxona ownerlarini tayinlash.\n\n"
            f"👇 <i>Quyidagi menyu tugmalaridan birini tanlang:</i>"
        )
        send_message(chat_id, msg, inline_kb)
        send_message(chat_id, "👇 <i>Asosiy boshqaruv menyusi:</i>", get_main_keyboard())
        return

    comp_info = get_user_company(chat_id)
    if comp_info:
        comp_id = comp_info.get('companyId', 'comp_novda')
        comp_name = comp_info.get('companyName', 'Novda')
        webapp_url = get_webapp_url(comp_id)
        inline_kb = {
            'inline_keyboard': [
                [
                    {'text': f"📱 {comp_name} Tizimini Ko'rish (Web App)", 'web_app': {'url': webapp_url}}
                ]
            ]
        }
        msg = (
            f"👋 <b>Assalomu alaykum, {first_name}!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 Korxona: <b>{comp_name}</b>\n"
            f"👤 Siz <b>Korxona Egasi (Owner)</b> sifatida tasdiqlangansiz.\n\n"
            f"📊 Korxonangizning barcha hisob-kitoblari (oyliklar, sof foyda, modellar, operatsiyalar va topshirilgan pattalar)ni real-vaqtda ko'rish uchun pastdagi tugmani bosing:\n━━━━━━━━━━━━━━━━━━━━"
        )
        send_message(chat_id, msg, inline_kb)
        send_message(chat_id, "👇 <i>Tezkor kirish menyusi:</i>", get_owner_keyboard(comp_id, comp_name))
        return

    # Not authorized
    msg = (
        f"⛔ <b>RUXSAT BERILMAGAN!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
        f"Sizning Telegram ID: <code>{chat_id}</code>\n\n"
        f"Ushbu bot faqat loyiha egasi yoki ruxsat berilgan korxona egalari uchun yopiq tizimdir.\n"
        f"Foydalanish huquqini olish uchun loyiha egasiga (developer) murojaat qiling.\n━━━━━━━━━━━━━━━━━━━━"
    )
    send_message(chat_id, msg)

def handle_list_owners(chat_id):
    if not is_super_admin(chat_id):
        send_message(chat_id, "⛔ Ushbu amal faqat loyiha egasi uchun ruxsat etilgan.")
        return

    cfg = load_config()
    owners = cfg.get('company_owners', {})
    super_admins = cfg.get('super_admin_chat_ids', [DEFAULT_ADMIN_CHAT_ID])

    msg = (
        f"👥 <b>TIZIM FOYDALANUVCHILARI VA OWNERLAR:</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👑 <b>Loyiha Egasi (Super Admin):</b>\n"
    )
    for sa in super_admins:
        msg += f"• <code>{sa}</code> (Barcha huquqlar ochiq)\n"

    msg += f"\n🏢 <b>Korxona Egalari (View-Only):</b>\n"
    if owners:
        for tg_id, info in owners.items():
            c_name = info.get('companyName', 'Korxona') if isinstance(info, dict) else 'Korxona'
            c_id = info.get('companyId', info) if isinstance(info, dict) else info
            msg += f"• <code>{tg_id}</code> &rarr; <b>{c_name}</b> (<code>{c_id}</code>)\n"
    else:
        msg += "<i>Hozircha korxona ownerlari tayinlanmagan.</i>\n"

    msg += (
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💡 <b>Yangi owner tayinlash:</b>\n"
        f"<code>/setowner &lt;korxona_kodi&gt; &lt;telegram_id&gt;</code>\n"
        f"Masalan: <code>/setowner comp_novda 274466315</code>\n\n"
        f"❌ <b>Ownerni o'chirish:</b>\n"
        f"<code>/delowner &lt;telegram_id&gt;</code>\n"
        f"Masalan: <code>/delowner 274466315</code>"
    )
    send_message(chat_id, msg, get_main_keyboard())

def get_device_status_display(dev):
    if dev.get('isBlocked'):
        return "⛔ BLOKLANGAN"
    key = str(dev.get('licenseKey') or '').strip().upper()
    if key.startswith('ACT-LFT') or dev.get('isLifetime'):
        return "👑 Muddatsiz Litsenziya Faol"
    elif key.startswith('ACT-D') or (dev.get('expiry') and dev.get('expiry') != 'None' and 'Trial' not in str(dev.get('expiry'))):
        return f"📅 Litsenziya ({dev.get('expiry')}) Faol"
    elif dev.get('isTrial') and not dev.get('isActivated'):
        return "⏱️ 1 Kunlik Sinov"
    elif dev.get('isActivated') and not dev.get('isTrial'):
        return "✅ Litsenziya Faol"
    elif dev.get('isTrial'):
        return "⏱️ 1 Kunlik Sinov"
    else:
        return "⚠️ Aktivatsiya Kutilmoqda"

def handle_list_devices(chat_id):
    db = load_db()
    if not db:
        send_message(chat_id, "ℹ️ <i>Hozircha ulangan noutbuklar mavjud emas. Yangi noutbuk dasturni ochishi bilan bu yerda chiqadi.</i>", get_main_keyboard())
        return

    send_message(chat_id, f"📊 <b>BARCHA ULANGAN QURILMALAR ({len(db)} ta):</b>\nQurilma ustida amal bajarish uchun tugmalardan foydalaning:")

    for mach_id, dev in db.items():
        is_blocked = dev.get('isBlocked', False)
        status_text = get_device_status_display(dev)
        hostname = dev.get('hostname', 'Noutbuk')
        last_seen = dev.get('lastSeenAt', '')
        if last_seen:
            try:
                dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                last_seen = dt.strftime('%d.%m.%Y %H:%M')
            except Exception:
                pass

        company_name = dev.get('companyName') or 'Asosiy Korxona'
        company_id = dev.get('companyId') or 'company_main'
        role_text = str(dev.get('role') or 'admin').upper()

        card_text = (
            f"💻 <b>Qurilma Kodi:</b> <code>{mach_id}</code>\n"
            f"🏢 <b>Korxona (Sex):</b> <b>{company_name}</b> (<code>{company_id}</code>)\n"
            f"👤 <b>Kompyuter:</b> {hostname} ({dev.get('osUser', 'user')})\n"
            f"🎭 <b>Rol:</b> {role_text}\n"
            f"📊 <b>Holati:</b> {status_text}\n"
            f"🔑 <b>Kalit:</b> <code>{dev.get('licenseKey') or 'Yo`q'}</code>\n"
            f"📅 <b>Oxirgi faollik:</b> {last_seen or 'Yaqinda'}"
        )

        inline_keyboard = [
            [
                {'text': '👑 Admin', 'callback_data': f'approve:{mach_id}:admin'},
                {'text': '⌨️ Type', 'callback_data': f'approve:{mach_id}:type'},
                {'text': '🖨️ Print', 'callback_data': f'approve:{mach_id}:print'}
            ],
            [
                {'text': '🏢 Korxonani Biriktirish', 'callback_data': f'pick_comp:{mach_id}'}
            ],
            [
                {'text': '📅 1 Yil (Admin)', 'callback_data': f'gen_1yr:{mach_id}'},
                {'text': ('🔓 Ochish' if is_blocked else '⛔ Bloklash'), 'callback_data': (f'unblock:{mach_id}' if is_blocked else f'block:{mach_id}')}
            ]
        ]

        send_message(chat_id, card_text, {'inline_keyboard': inline_keyboard})

def handle_list_companies(chat_id):
    comps = load_companies()
    db = load_db()

    msg = f"🏢 <b>RO'YXATDAN O'TGAN KORXONALAR / SEXLAR ({len(comps)} ta):</b>\nHar bir korxona o'zining mustaqil ma'lumotlar bazasiga ega:\n\n"
    buttons = []

    for c_id, c_data in comps.items():
        dev_count = sum(1 for dev in db.values() if (dev.get('companyId') or 'company_main') == c_id)
        val_status = "🟢 Majburiy" if c_data.get('requireTicketValidation', True) else "⚪ Ixtiyoriy"
        msg += f"🏢 <b>{c_data['name']}</b>\n   🆔 Kod: <code>{c_id}</code> | 💻 Ulangan PC: <b>{dev_count} ta</b>\n   ⚙️ Patta tekshiruvi: <b>{val_status}</b>\n\n"
        buttons.append([
            {'text': f"🏢 {c_data['name']} ({dev_count} ta PC)", 'callback_data': f'view_comp:{c_id}'},
            {'text': "📱 Web App", 'web_app': {'url': get_webapp_url(c_id)}}
        ])

    buttons.append([
        {'text': '➕ Yangi Korxona (Sex) Qo`shish', 'callback_data': 'add_new_company'}
    ])

    send_message(chat_id, msg, {'inline_keyboard': buttons})

def handle_key_generator_menu(chat_id):
    db = load_db()
    buttons = []
    
    # Generate quick buttons for known devices
    for mach_id, dev in list(db.items())[:6]:
        hostname = dev.get('hostname', 'PC')
        buttons.append([{'text': f"🔑 {mach_id} ({hostname})", 'callback_data': f'pick_dev:{mach_id}'}])

    buttons.append([{'text': '✍️ Boshqa kodni qo`lda yozish', 'callback_data': 'manual_key_entry'}])

    msg = "⚡ <b>Qaysi qurilmaga kalit yaratmoqchisiz?</b>\nPastdagi qurilmalardan birini bosing yoki kodni qo'lda kiriting:"
    send_message(chat_id, msg, {'inline_keyboard': buttons})

def handle_block_menu(chat_id):
    db = load_db()
    if not db:
        send_message(chat_id, "ℹ️ <i>Hozircha ulangan qurilmalar mavjud emas.</i>", get_main_keyboard())
        return

    buttons = []
    for mach_id, dev in db.items():
        is_blocked = dev.get('isBlocked', False)
        status_icon = "🔴" if is_blocked else "🟢"
        action_name = "🔓 Ochish" if is_blocked else "⛔ Bloklash"
        cb_action = "unblock" if is_blocked else "block"
        buttons.append([
            {'text': f"{status_icon} {mach_id} — {action_name}", 'callback_data': f'{cb_action}:{mach_id}'}
        ])

    msg = "🔒 <b>QURILMANI BLOKLASH YOKI OCHISH:</b>\nAmal bajarish uchun qurilma ustiga bosing:"
    send_message(chat_id, msg, {'inline_keyboard': buttons})

def handle_statistics(chat_id):
    db = load_db()
    total = len(db)
    blocked = sum(1 for d in db.values() if d.get('isBlocked'))
    trial = sum(1 for d in db.values() if d.get('isTrial') and not d.get('isBlocked'))
    licensed = sum(1 for d in db.values() if d.get('isActivated') and not d.get('isTrial') and not d.get('isBlocked'))

    msg = (
        f"📊 <b>TIZIM VA FOYDALANUVCHILAR STATISTIKASI:</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💻 <b>Jami Noutbuklar:</b> {total} ta\n"
        f"👑 <b>Faol Litsenziyalilar:</b> {licensed} ta\n"
        f"⏱️ <b>Sinov Muddati (24h):</b> {trial} ta\n"
        f"⛔ <b>Bloklangan Noutbuklar:</b> {blocked} ta\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🟢 <i>Server: Render Cloud 24/7 faol</i>"
    )
    send_message(chat_id, msg, get_main_keyboard())

def handle_callback_query(cq):
    cq_id = cq['id']
    chat_id = cq['message']['chat']['id']
    data = cq.get('data', '')

    telegram_api('answerCallbackQuery', {'callback_query_id': cq_id})

    parts = data.split(':')
    action = parts[0]
    mach_id = parts[1] if len(parts) > 1 else ''

    db = load_db()

    if action == 'approve':
        role = (parts[2] if len(parts) > 2 else 'admin').upper()
        existing_comp_id = db.get(mach_id, {}).get('companyId')
        
        # 1. Korxona biriktirish MAJBURIY: agar korxona tanlanmagan bo'lsa, oldin korxona tanlatamiz!
        if not existing_comp_id:
            comps = load_companies()
            buttons = []
            for c_id, c_data in comps.items():
                buttons.append([
                    {'text': f"🏢 {c_data['name']}", 'callback_data': f'approve_comp:{mach_id}:{c_id}:{role}'}
                ])
            buttons.append([
                {'text': '➕ Yangi Korxona Qo`shish', 'callback_data': f'add_comp_for:{mach_id}'}
            ])
            send_message(
                chat_id,
                f"⚠️ <b>DIQQAT: KORXONA BIRIKTIRISH MAJBURIY!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                f"💻 Qurilma: <code>{mach_id}</code>\n"
                f"🎭 Tanlangan rol: <b>{role}</b>\n\n"
                f"Dastur ishlashi uchun qurilma qaysi korxona (sex)ga biriktirilsin? <b>Iltimos, korxonani tanlang:</b>",
                {'inline_keyboard': buttons}
            )
            return

        key = generate_key(mach_id, 'LIFETIME', role)
        now_iso = datetime.now().isoformat()
        if mach_id not in db: db[mach_id] = {'machineId': mach_id}
        db[mach_id]['licenseKey'] = key
        db[mach_id]['role'] = role.lower()
        db[mach_id]['isActivated'] = True
        db[mach_id]['isBlocked'] = False
        db[mach_id]['updatedAt'] = now_iso
        save_db(db)

        comp_name = db[mach_id].get('companyName') or existing_comp_id

        # Real-time Firebase sync: immediately activates and sets role on user PC!
        update_firebase_device(mach_id, {
            'companyId': existing_comp_id,
            'companyName': comp_name,
            'role': role.lower(),
            'licenseKey': key,
            'isActivated': True,
            'isBlocked': False,
            'isLifetime': True,
            'updatedAt': now_iso
        })

        role_titles = {
            'ADMIN': '👑 Administrator (To\'liq boshqaruv)',
            'TYPE': '⌨️ Ma\'lumot kirituvchi (Model + Hisob + Ishchilar)',
            'PRINT': '🖨️ Printer operator (Faqat Patta chop etish)'
        }
        reply = (
            f"✅ <b>QURILMAGA YANGI ROL BIRIKTIRILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
            f"💻 Qurilma Kodi: <code>{mach_id}</code>\n"
            f"🏢 Korxona: <b>{comp_name}</b> (<code>{existing_comp_id}</code>)\n"
            f"🎭 Biriktirilgan Rol: <b>{role_titles.get(role, role)}</b>\n"
            f"⚡ <b>Dastur avtomatik tarzda ushbu rolga o'tadi!</b> (Mijoz kalit kiritishi shart emas).\n"
            f"🔑 Zaxira Aktivatsiya Kodi:\n<code>{key}</code>\n━━━━━━━━━━━━━━━━━━━━"
        )
        send_message(chat_id, reply, get_main_keyboard())

    elif action == 'approve_comp':
        comp_id = parts[2] if len(parts) > 2 else 'company_main'
        role = (parts[3] if len(parts) > 3 else 'admin').upper()
        comps = load_companies()
        comp_data = comps.get(comp_id, {'name': comp_id, 'id': comp_id})
        comp_name = comp_data['name']
        req_val = comp_data.get('requireTicketValidation', True)
        now_iso = datetime.now().isoformat()

        key = generate_key(mach_id, 'LIFETIME', role)
        if mach_id not in db: db[mach_id] = {'machineId': mach_id}
        db[mach_id]['companyId'] = comp_id
        db[mach_id]['companyName'] = comp_name
        db[mach_id]['requireTicketValidation'] = req_val
        db[mach_id]['licenseKey'] = key
        db[mach_id]['role'] = role.lower()
        db[mach_id]['isActivated'] = True
        db[mach_id]['isBlocked'] = False
        db[mach_id]['isLifetime'] = True
        db[mach_id]['updatedAt'] = now_iso
        save_db(db)

        update_firebase_device(mach_id, {
            'companyId': comp_id,
            'companyName': comp_name,
            'requireTicketValidation': req_val,
            'role': role.lower(),
            'licenseKey': key,
            'isActivated': True,
            'isBlocked': False,
            'isLifetime': True,
            'updatedAt': now_iso
        })

        role_titles = {
            'ADMIN': '👑 Administrator (To\'liq boshqaruv)',
            'TYPE': '⌨️ Ma\'lumot kirituvchi (Model + Hisob + Ishchilar)',
            'PRINT': '🖨️ Printer operator (Faqat Patta chop etish)'
        }
        reply = (
            f"✅ <b>QURILMA TASDIQLANDI VA KORXONAGA BIRIKTIRILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
            f"💻 Qurilma Kodi: <code>{mach_id}</code>\n"
            f"🏢 Biriktirilgan Korxona: <b>{comp_name}</b> (<code>{comp_id}</code>)\n"
            f"🎭 Biriktirilgan Rol: <b>{role_titles.get(role, role)}</b>\n"
            f"⚡ <b>Dastur darhol ushbu korxona ma'lumotlari bilan faollashadi!</b>\n"
            f"🔑 Zaxira Aktivatsiya Kodi:\n<code>{key}</code>\n━━━━━━━━━━━━━━━━━━━━"
        )
        send_message(chat_id, reply, get_main_keyboard())

    elif action == 'gen_lft':
        key = generate_key(mach_id, 'LIFETIME', 'ADMIN')
        now_iso = datetime.now().isoformat()
        if mach_id not in db: db[mach_id] = {'machineId': mach_id}
        db[mach_id]['licenseKey'] = key
        db[mach_id]['role'] = 'admin'
        db[mach_id]['isActivated'] = True
        db[mach_id]['isBlocked'] = False
        db[mach_id]['updatedAt'] = now_iso
        save_db(db)

        update_firebase_device(mach_id, {
            'role': 'admin',
            'licenseKey': key,
            'isActivated': True,
            'isBlocked': False,
            'isLifetime': True,
            'updatedAt': now_iso
        })

        reply = (
            f"✅ <b>MUDDATSIZ LITSENZIYA KALITI YARATILDI:</b>\n\n"
            f"💻 Qurilma: <code>{mach_id}</code>\n"
            f"🎭 Rol: 👑 Administrator\n"
            f"⚡ <i>Dastur avtomatik tarzda faollashadi.</i>\n"
            f"🔑 Kalit: <code>{key}</code>"
        )
        send_message(chat_id, reply, get_main_keyboard())

    elif action == 'gen_1yr':
        exp_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        key = generate_key(mach_id, exp_date, 'ADMIN')
        now_iso = datetime.now().isoformat()
        if mach_id not in db: db[mach_id] = {'machineId': mach_id}
        db[mach_id]['licenseKey'] = key
        db[mach_id]['role'] = 'admin'
        db[mach_id]['isActivated'] = True
        db[mach_id]['isBlocked'] = False
        db[mach_id]['expiry'] = exp_date
        db[mach_id]['updatedAt'] = now_iso
        save_db(db)

        update_firebase_device(mach_id, {
            'role': 'admin',
            'licenseKey': key,
            'isActivated': True,
            'isBlocked': False,
            'expiry': exp_date,
            'updatedAt': now_iso
        })

        reply = (
            f"📅 <b>1 YILLIK LITSENZIYA KALITI YARATILDI:</b>\n\n"
            f"💻 Qurilma: <code>{mach_id}</code>\n"
            f"📅 Muddat: {exp_date} gacha\n"
            f"⚡ <i>Dastur avtomatik tarzda faollashadi.</i>\n"
            f"🔑 Kalit: <code>{key}</code>"
        )
        send_message(chat_id, reply, get_main_keyboard())

    elif action == 'pick_dev':
        buttons = [
            [
                {'text': '👑 Admin', 'callback_data': f'approve:{mach_id}:admin'},
                {'text': '⌨️ Type', 'callback_data': f'approve:{mach_id}:type'},
                {'text': '🖨️ Print', 'callback_data': f'approve:{mach_id}:print'}
            ]
        ]
        send_message(chat_id, f"💻 <b>Tanlangan Qurilma:</b> <code>{mach_id}</code>\nQaysi rolga o'tkazilsin?", {'inline_keyboard': buttons})

    elif action == 'manual_key_entry':
        user_states[chat_id] = 'awaiting_machine_id'
        send_message(chat_id, "✍️ Iltimos, mijozning <b>Qurilma Kodi</b>ni yuboring (Masalan: <code>9EE3-D5A1-F461-BC42</code>):")

    elif action == 'block':
        now_iso = datetime.now().isoformat()
        if mach_id not in db: db[mach_id] = {'machineId': mach_id}
        db[mach_id]['isBlocked'] = True
        db[mach_id]['isActivated'] = False
        db[mach_id]['updatedAt'] = now_iso
        save_db(db)

        # Real-time Firebase remote kill
        update_firebase_device(mach_id, {
            'isBlocked': True,
            'isActivated': False,
            'blockReason': 'Administrator tomonidan bloklandi',
            'updatedAt': now_iso
        })

        send_message(chat_id, f"⛔ <b>Qurilma bloklandi!</b>\n\n💻 <code>{mach_id}</code> noutbuki masofadan qulflab qo'yildi. Dastur darhol to'xtatiladi.", get_main_keyboard())

    elif action == 'unblock':
        now_iso = datetime.now().isoformat()
        if mach_id in db:
            db[mach_id]['isBlocked'] = False
            db[mach_id]['isActivated'] = True
            db[mach_id]['updatedAt'] = now_iso
            save_db(db)

        # Real-time Firebase remote unblock
        update_firebase_device(mach_id, {
            'isBlocked': False,
            'isActivated': True,
            'updatedAt': now_iso
        })

        send_message(chat_id, f"🔓 <b>Qurilma blokdan chiqarildi!</b>\n\n💻 <code>{mach_id}</code> noutbuki qayta faollashtirildi.", get_main_keyboard())

    elif action == 'pick_comp':
        comps = load_companies()
        buttons = []
        for c_id, c_data in comps.items():
            buttons.append([
                {'text': f"🏢 {c_data['name']}", 'callback_data': f'set_comp:{mach_id}:{c_id}'}
            ])
        buttons.append([
            {'text': '➕ Yangi Korxona Qo`shish', 'callback_data': f'add_comp_for:{mach_id}'}
        ])
        buttons.append([
            {'text': '⬅️ Orqaga', 'callback_data': 'cancel_comp'}
        ])
        send_message(chat_id, f"🏢 <code>{mach_id}</code> qurilmasini qaysi korxona (sex)ga biriktirmoqchisiz?", {'inline_keyboard': buttons})

    elif action == 'set_comp':
        comp_id = parts[2] if len(parts) > 2 else 'company_main'
        comps = load_companies()
        comp_data = comps.get(comp_id, {'name': comp_id, 'id': comp_id})
        comp_name = comp_data['name']
        req_val = comp_data.get('requireTicketValidation', True)
        now_iso = datetime.now().isoformat()

        if mach_id not in db: db[mach_id] = {'machineId': mach_id}
        db[mach_id]['companyId'] = comp_id
        db[mach_id]['companyName'] = comp_name
        db[mach_id]['requireTicketValidation'] = req_val
        db[mach_id]['updatedAt'] = now_iso
        save_db(db)

        update_firebase_device(mach_id, {
            'companyId': comp_id,
            'companyName': comp_name,
            'requireTicketValidation': req_val,
            'updatedAt': now_iso
        })

        dev_role = db[mach_id].get('role')
        if not dev_role or not db[mach_id].get('isActivated'):
            buttons = [
                [
                    {'text': '👑 Admin', 'callback_data': f'approve:{mach_id}:admin'},
                    {'text': '⌨️ Type', 'callback_data': f'approve:{mach_id}:type'},
                    {'text': '🖨️ Print', 'callback_data': f'approve:{mach_id}:print'}
                ]
            ]
            reply = (
                f"🏢 <b>KORXONA TANLANDI: {comp_name}</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                f"💻 Qurilma: <code>{mach_id}</code>\n"
                f"🆔 Korxona Kodi: <code>{comp_id}</code>\n\n"
                f"Dasturni to'liq faollashtirish uchun <b>rolni tanlang:</b>\n━━━━━━━━━━━━━━━━━━━━"
            )
            send_message(chat_id, reply, {'inline_keyboard': buttons})
            return

        reply = (
            f"✅ <b>QURILMA KORXONAGA BIRIKTIRILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
            f"💻 Qurilma Kodi: <code>{mach_id}</code>\n"
            f"🏢 Biriktirilgan Korxona: <b>{comp_name}</b> (<code>{comp_id}</code>)\n"
            f"⚡ <b>Dastur darhol ushbu korxona bulutiga ulanadi!</b>\n━━━━━━━━━━━━━━━━━━━━"
        )
        send_message(chat_id, reply, get_main_keyboard())

    elif action == 'add_new_company':
        user_states[chat_id] = 'awaiting_company_name'
        send_message(chat_id, "✍️ Iltimos, <b>yangi korxona (sex) nomini</b> yozing (Masalan: <code>Ideal Tikuv Fabrikasi</code> yoki <code>Buxoro 2-Sex</code>):")

    elif action == 'add_comp_for':
        user_states[chat_id] = 'awaiting_company_name'
        user_states[f"{chat_id}_for_mach"] = mach_id
        send_message(chat_id, f"✍️ <code>{mach_id}</code> qurilmasi uchun <b>yangi korxona (sex) nomini</b> yozing:")

    elif action == 'view_comp':
        comp_id = parts[1] if len(parts) > 1 else 'company_main'
        comps = load_companies()
        comp_data = comps.get(comp_id, {'name': comp_id, 'id': comp_id})
        comp_name = comp_data['name']
        is_strict = comp_data.get('requireTicketValidation', True)
        strict_icon = "🟢" if is_strict else "⚪"
        strict_label = "Majburiy (Qat'iy tekshiruv)" if is_strict else "Ixtiyoriy (Erkin kiritish)"
        
        comp_devices = [dev for dev in db.values() if (dev.get('companyId') or 'company_main') == comp_id]
        
        cfg = load_config()
        comp_owners = [str(tid) for tid, o in cfg.get('company_owners', {}).items() if (o.get('companyId') if isinstance(o, dict) else o) == comp_id]
        owner_display = ", ".join(f"<code>{x}</code>" for x in comp_owners) if comp_owners else "<i>Tayinlanmagan</i>"

        msg = (
            f"🏢 <b>KORXONA TAFSILOTLARI:</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 Nomi: <b>{comp_name}</b>\n"
            f"🆔 Kodi: <code>{comp_id}</code>\n"
            f"👤 <b>Korxona Owneri:</b> {owner_display}\n"
            f"💻 Ulangan Noutbuklar: <b>{len(comp_devices)} ta</b>\n"
            f"⚙️ <b>Patta/Partiya tekshiruvi:</b> {strict_icon} <b>{strict_label}</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
        )
        if comp_devices:
            for d in comp_devices:
                mach = d.get('machineId', 'Noma\'lum')
                role = str(d.get('role') or 'admin').upper()
                msg += f"• <code>{mach}</code> | {role} | {get_device_status_display(d)}\n"
        else:
            msg += "<i>Hozircha ushbu korxonaga qurilmalar biriktirilmagan.</i>\n"

        toggle_btn_text = "⚪ Ixtiyoriy qilish (O'chirish)" if is_strict else "🟢 Majburiy qilish (Yoqish)"
        buttons = [
            [{'text': f"📱 {comp_name} Tizimini Ko'rish (Web App)", 'web_app': {'url': get_webapp_url(comp_id)}}],
            [{'text': '👤 Owner Biriktirish / O`zgartirish', 'callback_data': f'assign_owner:{comp_id}'}],
            [{'text': f"⚙️ {toggle_btn_text}", 'callback_data': f'toggle_val:{comp_id}'}],
            [{'text': '⬅️ Korxonalar Ro`yxatiga qaytish', 'callback_data': 'back_to_comps'}]
        ]
        send_message(chat_id, msg, {'inline_keyboard': buttons})

    elif action == 'assign_owner':
        comp_id = parts[1] if len(parts) > 1 else 'company_main'
        user_states[chat_id] = f'awaiting_owner_id_{comp_id}'
        send_message(chat_id, f"✍️ <code>{comp_id}</code> korxonasi egasi (owner) uchun <b>Telegram ID</b> raqamini yozing (Masalan: <code>274466315</code>):")

    elif action == 'toggle_val':
        comp_id = parts[1] if len(parts) > 1 else 'company_main'
        comps = load_companies()
        if comp_id in comps:
            current_val = comps[comp_id].get('requireTicketValidation', True)
            new_val = not current_val
            comps[comp_id]['requireTicketValidation'] = new_val
            save_companies(comps)

            now_iso = datetime.now().isoformat()
            db = load_db()
            for mach_id, dev in db.items():
                if (dev.get('companyId') or 'company_main') == comp_id:
                    dev['requireTicketValidation'] = new_val
                    dev['updatedAt'] = now_iso
                    update_firebase_device(mach_id, {
                        'requireTicketValidation': new_val,
                        'updatedAt': now_iso
                    })
            save_db(db)

            # Update Firebase company settings
            try:
                c_url = f"{FIREBASE_RTDB_URL.rstrip('/')}/companies/{comp_id}/settings.json"
                c_req = urllib.request.Request(
                    c_url,
                    data=json.dumps({'requireTicketValidation': new_val}).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='PATCH'
                )
                with urllib.request.urlopen(c_req, timeout=10) as _:
                    pass
            except Exception as e:
                print(f"Company settings write error: {e}")

            status_str = "🟢 <b>Majburiy (Qat'iy tekshiruv)</b>" if new_val else "⚪ <b>Ixtiyoriy (Erkin kiritish — model tekshiruvisiz)</b>"
            reply = (
                f"⚙️ <b>KORXONA SOZLAMASI O'ZGARTIRILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                f"🏢 Korxona: <b>{comps[comp_id]['name']}</b> (<code>{comp_id}</code>)\n"
                f"📋 Konveyer / Partiya / Patta tekshiruvi: {status_str}\n"
                f"⚡ <i>Ushbu korxonadagi barcha dasturlarga yangi sozlama real-vaqtda yetkazildi!</i>\n━━━━━━━━━━━━━━━━━━━━"
            )
            send_message(chat_id, reply, get_main_keyboard())

    elif action == 'back_to_comps':
        handle_list_companies(chat_id)

    elif action == 'cancel_comp':
        send_message(chat_id, "Amal bekor qilindi.", get_main_keyboard())

def main():
    print("=" * 60)
    print("   👑 NOVDA HISOB-KITOB — TELEGRAM ADMIN BOTI (TUGMALI MENYU)")
    print(f"   🤖 Bot: @hisobmonitoringbot")
    print("=" * 60)

    # Start Render Health check server in background thread
    threading.Thread(target=start_health_server, daemon=True).start()

    # Start Anti-sleep keep-alive self ping in background thread
    threading.Thread(target=keep_alive_ping, daemon=True).start()

    offset = 0
    while True:
        try:
            updates = telegram_api('getUpdates', {'offset': offset, 'timeout': 30})
            if updates and updates.get('ok') and updates.get('result'):
                for u in updates['result']:
                    offset = u['update_id'] + 1

                    if 'message' in u:
                        msg = u['message']
                        text = msg.get('text', '').strip()
                        chat_id = msg['chat']['id']
                        user = msg.get('from', {})

                        # Check if user is in a state
                        if user_states.get(chat_id) == 'awaiting_machine_id':
                            user_states[chat_id] = None
                            clean_id = text.upper().strip()
                            buttons = [
                                [
                                    {'text': '👑 Admin Kalit', 'callback_data': f'approve:{clean_id}:admin'},
                                    {'text': '⌨️ Type Kalit', 'callback_data': f'approve:{clean_id}:type'},
                                    {'text': '🖨️ Print Kalit', 'callback_data': f'approve:{clean_id}:print'}
                                ]
                            ]
                            send_message(chat_id, f"💻 <b>Kiritilgan Kod:</b> <code>{clean_id}</code>\nQaysi rol bilan kalit yaratilsin?", {'inline_keyboard': buttons})
                            continue

                        if user_states.get(chat_id) == 'awaiting_company_name':
                            user_states[chat_id] = None
                            comp_name = text.strip()
                            if len(comp_name) < 2:
                                send_message(chat_id, "⚠️ Korxona nomi juda qisqa bo'ldi. Amal bekor qilindi.", get_main_keyboard())
                                continue

                            import re
                            slug = re.sub(r'[^a-zA-Z0-9]', '_', comp_name.lower())
                            slug = re.sub(r'_+', '_', slug).strip('_')
                            if not slug:
                                slug = 'sex_' + str(int(time.time()))[-4:]
                            comp_id = f"comp_{slug[:16]}"

                            comps = load_companies()
                            comps[comp_id] = {
                                'id': comp_id,
                                'name': comp_name,
                                'createdAt': datetime.now().isoformat()
                            }
                            save_companies(comps)

                            pending_mach = user_states.get(f"{chat_id}_for_mach")
                            if pending_mach:
                                user_states[f"{chat_id}_for_mach"] = None
                                now_iso = datetime.now().isoformat()
                                db = load_db()
                                if pending_mach not in db: db[pending_mach] = {'machineId': pending_mach}
                                db[pending_mach]['companyId'] = comp_id
                                db[pending_mach]['companyName'] = comp_name
                                db[pending_mach]['updatedAt'] = now_iso
                                save_db(db)

                                update_firebase_device(pending_mach, {
                                    'companyId': comp_id,
                                    'companyName': comp_name,
                                    'updatedAt': now_iso
                                })

                                reply = (
                                    f"✅ <b>YANGI KORXONA YARATILDI VA QURILMAGA BIRIKTIRILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                                    f"🏢 Korxona: <b>{comp_name}</b> (<code>{comp_id}</code>)\n"
                                    f"💻 Qurilma: <code>{pending_mach}</code>\n"
                                    f"⚡ <b>Dastur darhol ushbu korxona ma'lumotlar bazasiga o'tadi!</b>\n━━━━━━━━━━━━━━━━━━━━"
                                )
                                send_message(chat_id, reply, get_main_keyboard())
                            else:
                                reply = (
                                    f"✅ <b>YANGI KORXONA (SEX) QO'SHILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                                    f"🏢 Nomi: <b>{comp_name}</b>\n"
                                    f"🆔 Kodi: <code>{comp_id}</code>\n\n"
                                    f"Endi kompyuterlarni ushbu korxonaga biriktirishingiz mumkin!"
                                )
                                send_message(chat_id, reply, get_main_keyboard())
                            continue

                        # Check owner assignment state
                        curr_state = user_states.get(chat_id)
                        if curr_state and str(curr_state).startswith('awaiting_owner_id_'):
                            comp_id = curr_state.replace('awaiting_owner_id_', '')
                            user_states[chat_id] = None
                            owner_id = text.strip()
                            if not owner_id.isdigit():
                                send_message(chat_id, "⚠️ Telegram ID faqat raqamlardan iborat bo'lishi kerak. Amal bekor qilindi.", get_main_keyboard())
                                continue
                            set_company_owner(comp_id, owner_id)
                            comps = load_companies()
                            c_name = comps.get(comp_id, {}).get('name', comp_id)
                            reply = (
                                f"✅ <b>KORXONA OWNERI TAYINLANDI!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                                f"🏢 Korxona: <b>{c_name}</b> (<code>{comp_id}</code>)\n"
                                f"👤 Telegram ID: <code>{owner_id}</code>\n\n"
                                f"⚡ Endi ushbu foydalanuvchi botga /start bosganda, faqat o'z korxonasini (Web App) ko'ra oladi."
                            )
                            send_message(chat_id, reply, get_main_keyboard())
                            continue

                        # Check authorization
                        is_admin = is_super_admin(chat_id)
                        user_comp = get_user_company(chat_id)

                        if not is_admin and not user_comp:
                            msg = (
                                f"⛔ <b>RUXSAT BERILMAGAN!</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                                f"Sizning Telegram ID: <code>{chat_id}</code>\n\n"
                                f"Ushbu bot yopiq tizimdir. Foydalanish huquqini olish uchun loyiha egasiga murojaat qiling.\n━━━━━━━━━━━━━━━━━━━━"
                            )
                            send_message(chat_id, msg)
                            continue

                        # If user is a Company Owner (NOT super admin):
                        if user_comp and not is_admin:
                            comp_id = user_comp.get('companyId', 'comp_novda') if isinstance(user_comp, dict) else str(user_comp)
                            comp_name = user_comp.get('companyName', 'Novda') if isinstance(user_comp, dict) else comp_id
                            webapp_url = get_webapp_url(comp_id)

                            if text == '/start' or text == '🔄 Yangilash' or text.startswith('/webapp') or text.startswith('/tizim') or text.startswith('/view') or text.startswith('/owner') or 'Web App' in text:
                                handle_start(chat_id, user.get('first_name', 'Hurmatli foydalanuvchi'))
                            else:
                                send_message(
                                    chat_id,
                                    f"ℹ️ <b>{comp_name}</b> korxonasi egasi (owner) hisoblanasiz.\n"
                                    f"Sizda faqat o'z korxonangiz tizimini ko'rish (View) huquqi mavjud.\n"
                                    f"Boshqalarga ruxsat berish yoki tizim sozlamalarini o'zgartirish faqat Loyiha Egasi (Super Admin) tomonidan amalga oshiriladi.\n\n"
                                    f"Tizimni ko'rish uchun pastdagi tugmani bosing:",
                                    get_owner_keyboard(comp_id, comp_name)
                                )
                            continue

                        # Super Admin Commands Handling
                        if text == '/start' or text == '🔄 Yangilash':
                            handle_start(chat_id, user.get('first_name', 'Admin'))
                        elif text.startswith('/owners') or text == '👥 Korxona Ownerlari':
                            handle_list_owners(chat_id)
                        elif text.startswith('/setowner'):
                            parts = text.split()
                            if len(parts) >= 3 and parts[2].isdigit():
                                c_id, o_id = parts[1], parts[2]
                                set_company_owner(c_id, o_id)
                                comps = load_companies()
                                c_name = comps.get(c_id, {}).get('name', c_id)
                                send_message(chat_id, f"✅ <code>{c_id}</code> ({c_name}) korxonasiga owner biriktirildi: <code>{o_id}</code>", get_main_keyboard())
                            else:
                                send_message(chat_id, "⚠️ Format: <code>/setowner &lt;korxona_kodi&gt; &lt;telegram_id&gt;</code>\nMasalan: <code>/setowner comp_novda 274466315</code>", get_main_keyboard())
                        elif text.startswith('/delowner'):
                            parts = text.split()
                            if len(parts) >= 2:
                                o_id = parts[1]
                                ok = remove_company_owner(o_id)
                                if ok:
                                    send_message(chat_id, f"✅ <code>{o_id}</code> ownerlar ro'yxatidan o'chirildi.", get_main_keyboard())
                                else:
                                    send_message(chat_id, f"⚠️ <code>{o_id}</code> ownerlar ro'yxatida topilmadi.", get_main_keyboard())
                            else:
                                send_message(chat_id, "⚠️ Format: <code>/delowner &lt;telegram_id&gt;</code>", get_main_keyboard())
                        elif text.startswith('/webapp') or text.startswith('/tizim') or text.startswith('/owner') or text.startswith('/view') or text == "📱 Barcha Korxonalar Tizimi (Web App)" or text == "📱 Korxona Tizimini Ko'rish (Web App)":
                            webapp_url = get_webapp_url()
                            msg = (
                                f"📱 <b>NOVDA HISOB-KITOB — KORXONA BOSHQARUVI (WEB APP)</b>\n━━━━━━━━━━━━━━━━━━━━\n"
                                f"👑 <i>Korxonaning butun tizimi (oyliklar, sof foyda, modellar, operatsiya narxlari, partiyalar va skanerlangan pattalar)ni jonli ko'rish uchun quyidagi tugmani bosing:</i>\n\n"
                                f"🌐 {webapp_url}\n━━━━━━━━━━━━━━━━━━━━"
                            )
                            send_message(chat_id, msg, {
                                'inline_keyboard': [
                                    [{'text': "📱 Tizimni Ko'rish (Web App)", 'web_app': {'url': webapp_url}}]
                                ]
                            })
                        elif text == '📋 Barcha Qurilmalar' or text == '/qurilmalar' or text == '/devices':
                            handle_list_devices(chat_id)
                        elif text == '🏢 Korxonalar (Sexlar)' or text == '/korxonalar' or text == '/companies':
                            handle_list_companies(chat_id)
                        elif text == '⚡ Kalit Yaratish' or text == '/kalit':
                            handle_key_generator_menu(chat_id)
                        elif text == '🔒 Bloklash / Ochish' or text == '/blok':
                            handle_block_menu(chat_id)
                        elif text.startswith('/unbind_worker'):
                            parts = text.split()
                            if len(parts) >= 2 and parts[1].isdigit():
                                wid = parts[1]
                                comp_id = 'comp_novda'
                                try:
                                    w_url = f"{FIREBASE_RTDB_URL.rstrip('/')}/companies/{comp_id}/worker_bindings/{wid}.json"
                                    req_w = urllib.request.Request(w_url, headers={'User-Agent': 'NovdaAdmin/1.0'})
                                    with urllib.request.urlopen(req_w, timeout=6) as resp:
                                        w_data = json.loads(resp.read().decode('utf-8'))

                                    req_del1 = urllib.request.Request(w_url, headers={'Content-Type': 'application/json'}, method='DELETE')
                                    with urllib.request.urlopen(req_del1, timeout=8):
                                        pass

                                    if isinstance(w_data, dict) and w_data.get('tg_id'):
                                        old_tg = w_data['tg_id']
                                        tg_url = f"{FIREBASE_RTDB_URL.rstrip('/')}/worker_telegram_bindings/{old_tg}.json"
                                        req_del2 = urllib.request.Request(tg_url, headers={'Content-Type': 'application/json'}, method='DELETE')
                                        with urllib.request.urlopen(req_del2, timeout=8):
                                            pass
                                        send_message(chat_id, f"✅ <b>Ishchi #{wid}</b> Telegram hisobidan muvaffaqiyatli uzildi! (Eski Telegram ID: <code>{old_tg}</code>).\nEndi xodim yangi Telegramdan /start bosib ulanishi mumkin.", get_main_keyboard())
                                    else:
                                        send_message(chat_id, f"✅ <b>Ishchi #{wid}</b> bog'lanishi tozalandi.", get_main_keyboard())
                                except Exception as e:
                                    send_message(chat_id, f"⚠️ Xatolik yuz berdi: {e}", get_main_keyboard())
                            else:
                                send_message(chat_id, "⚠️ Format: <code>/unbind_worker &lt;ishchi_id&gt;</code>\nMasalan: <code>/unbind_worker 27</code>", get_main_keyboard())
                        elif text == '📊 Statistika' or text == '/stats':
                            handle_statistics(chat_id)
                        else:
                            # If they typed a hardware ID directly (e.g. 9EE3-D5A1-F461-BC42)
                            if len(text) >= 16 and '-' in text:
                                clean_id = text.upper().strip()
                                buttons = [
                                    [
                                        {'text': '👑 Admin Kalit', 'callback_data': f'approve:{clean_id}:admin'},
                                        {'text': '⌨️ Type Kalit', 'callback_data': f'approve:{clean_id}:type'},
                                        {'text': '🖨️ Print Kalit', 'callback_data': f'approve:{clean_id}:print'}
                                    ]
                                ]
                                send_message(chat_id, f"💻 <b>Aniqlangan Qurilma Kodi:</b> <code>{clean_id}</code>\nKalit turini tanlang:", {'inline_keyboard': buttons})
                            else:
                                handle_start(chat_id, user.get('first_name', 'Admin'))

                    elif 'callback_query' in u:
                        cq = u['callback_query']
                        cq_chat = cq['message']['chat']['id']
                        if not is_super_admin(cq_chat):
                            telegram_api('answerCallbackQuery', {'callback_query_id': cq['id'], 'text': "⛔ Faqat loyiha egasi bajara oladi!", 'show_alert': True})
                        else:
                            handle_callback_query(cq)

        except Exception as e:
            print(f"Xatolik: {e}")
            time.sleep(3)

if __name__ == '__main__':
    main()
