#!/usr/bin/env python3
"""
Novda Hisob-Kitob — Litsenziya Kaliti Generatori (Admin uchun)
Ishlatish:
    python generate_license.py
yoki:
    python generate_license.py B155-1841-E2E3-7FA9 --lifetime
    python generate_license.py B155-1841-E2E3-7FA9 --expire 2027-12-31
"""

import sys
import hmac
import hashlib

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

MASTER_SECRET = 'NOVDA_2026_MASTER_SECRET_SECURITY_SALT_KEY_HISOB_PROD'

def to_base36(val: int) -> str:
    chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if val == 0:
        return '0'
    res = []
    while val > 0:
        val, rem = divmod(val, 36)
        res.append(chars[rem])
    return ''.join(reversed(res))

def generate_key(machine_id: str, expiry: str = 'LIFETIME') -> str:
    norm_id = machine_id.strip().upper()
    norm_expiry = (expiry or 'LIFETIME').strip().upper()
    payload = f"{norm_id}|{norm_expiry}".encode('utf-8')

    sig_hmac = hmac.new(MASTER_SECRET.encode('utf-8'), payload, hashlib.sha256).hexdigest().upper()
    sig = sig_hmac[:8]

    if norm_expiry == 'LIFETIME':
        exp_code = 'LFT'
    else:
        d_num = int(norm_expiry.replace('-', ''))
        exp_code = 'D' + to_base36(d_num)

    mach_seg = norm_id.replace('-', '')[:4]
    key = f"ACT-{exp_code}-{mach_seg}-{sig[:4]}-{sig[4:8]}"
    return key

def main():
    print("=" * 60)
    print("   👑 NOVDA HISOB-KITOB — LITSENZIYA GENERATORI")
    print("=" * 60)

    if len(sys.argv) > 1:
        machine_id = sys.argv[1]
        expiry = 'LIFETIME'
        if '--expire' in sys.argv:
            idx = sys.argv.index('--expire')
            if idx + 1 < len(sys.argv):
                expiry = sys.argv[idx + 1]
    else:
        machine_id = input("\n👤 Mijozning Qurilma Kodini kiriting (masalan: B155-1841-E2E3-7FA9): ").strip()
        if not machine_id:
            print("❌ Qurilma kodi kiritilmadi!")
            return

        print("\n📅 Litsenziya muddatini tanlang:")
        print("   1) Muddatsiz (Umrbod / Cheksiz)")
        print("   2) 1 Yil")
        print("   3) 6 Oy")
        print("   4) 1 Oy (Sinov)")
        print("   5) Boshqa aniq sana (YYYY-MM-DD)")

        choice = input("Tanlov (1-5, default 1): ").strip()

        from datetime import datetime, timedelta
        now = datetime.now()

        if choice == '2':
            expiry = (now + timedelta(days=365)).strftime('%Y-%m-%d')
        elif choice == '3':
            expiry = (now + timedelta(days=182)).strftime('%Y-%m-%d')
        elif choice == '4':
            expiry = (now + timedelta(days=30)).strftime('%Y-%m-%d')
        elif choice == '5':
            expiry = input("Tugash sanasini kiriting (YYYY-MM-DD, masalan 2027-12-31): ").strip()
        else:
            expiry = 'LIFETIME'

    key = generate_key(machine_id, expiry)

    print("\n" + "=" * 60)
    print(f"✅ QURILMA KODI:       {machine_id.upper()}")
    print(f"📅 MUDDATI:            {'Muddatsiz (Umrbod)' if expiry == 'LIFETIME' else expiry + ' gacha'}")
    print("-" * 60)
    print(f"🔑 AKTIVATSIYA KALITI:  {key}")
    print("=" * 60)
    print("\nUshbu kalitni mijozga yuboring. U dasturga kiritib faollashtiradi.")

if __name__ == '__main__':
    main()
