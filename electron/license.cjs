const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

const MASTER_SECRET = process.env.NOVDA_LICENSE_SECRET || 'NOVDA_2026_MASTER_SECRET_SECURITY_SALT_KEY_HISOB_PROD';
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000; // 1 Day (24 Hours)

// Cloud License & Telemetry Hub (Supports Firebase / Custom Cloud Sync)
let CLOUD_CONFIG = {
  // Realtime sync & telemetry endpoint for Novda
  rtdbUrl: 'https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app'
};

/**
 * Get permanent hardware identifier on Windows / other OS
 * Format: XXXX-XXXX-XXXX-XXXX (e.g. 9EE3-D5A1-F461-BC42)
 */
function getHardwareId() {
  let raw = '';

  // 1. Try Windows Registry MachineGuid
  if (process.platform === 'win32') {
    try {
      const regOut = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        encoding: 'utf-8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const match = regOut.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9\-]+)/);
      if (match && match[1]) {
        raw += match[1].trim();
      }
    } catch (e) {}

    // 2. Try WMIC / PowerShell BIOS/Baseboard serial
    try {
      const biosOut = execSync('wmic bios get serialnumber', {
        encoding: 'utf-8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const lines = biosOut.split('\n').map(l => l.trim()).filter(l => l && !l.toLowerCase().includes('serialnumber'));
      if (lines.length > 0) {
        raw += '_' + lines[0];
      }
    } catch (e) {}
  }

  // Fallback / complement with CPU & OS parameters
  const cpus = os.cpus();
  const cpuModel = cpus && cpus[0] ? cpus[0].model : 'CPU';
  const hostname = os.hostname();
  const username = os.userInfo ? os.userInfo().username : 'user';

  raw += `_${cpuModel}_${hostname}_${username}_hardware_id_seed`;

  // Create clean, standard 16-hex code (XXXX-XXXX-XXXX-XXXX)
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  const part1 = hash.substring(0, 4);
  const part2 = hash.substring(4, 8);
  const part3 = hash.substring(8, 12);
  const part4 = hash.substring(12, 16);

  return `${part1}-${part2}-${part3}-${part4}`;
}

/**
 * Generate Activation Key for a Machine ID
 * expiry: 'LIFETIME' or 'YYYY-MM-DD'
 * role: 'ADMIN' | 'TYPE' | 'PRINT'
 */
function generateActivationKey(machineId, expiry = 'LIFETIME', role = 'ADMIN') {
  const normId = machineId.trim().toUpperCase();
  const normExpiry = (expiry || 'LIFETIME').trim().toUpperCase();
  const normRole = (role || 'ADMIN').trim().toUpperCase();

  // If role is specific (ADMIN, TYPE, PRINT)
  if (normRole === 'ADMIN' || normRole === 'TYPE' || normRole === 'PRINT') {
    const payload = `${normId}|${normExpiry}|${normRole}`;
    const hmac = crypto.createHmac('sha256', MASTER_SECRET).update(payload).digest('hex').toUpperCase();
    const sig = hmac.substring(0, 8);
    const machSegment = normId.replace(/-/g, '').substring(0, 4);
    return `ACT-${normRole}-${machSegment}-${sig.substring(0, 4)}-${sig.substring(4, 8)}`;
  }

  // Legacy format fallback
  const payload = `${normId}|${normExpiry}`;
  const hmac = crypto.createHmac('sha256', MASTER_SECRET).update(payload).digest('hex').toUpperCase();
  const sig = hmac.substring(0, 8);
  let expCode = 'LFT';
  if (normExpiry !== 'LIFETIME') {
    const dStr = normExpiry.replace(/-/g, '');
    expCode = 'D' + parseInt(dStr, 10).toString(36).toUpperCase();
  }
  const machSegment = normId.replace(/-/g, '').substring(0, 4);
  return `ACT-${expCode}-${machSegment}-${sig.substring(0, 4)}-${sig.substring(4, 8)}`;
}

/**
 * Validate Activation Key against Machine ID
 */
function verifyActivationKey(machineId, activationKey) {
  if (!activationKey || typeof activationKey !== 'string') {
    return { valid: false, reason: 'Kalit kiritilmagan' };
  }

  const normId = machineId.trim().toUpperCase();
  const cleanKey = activationKey.trim().toUpperCase();

  const parts = cleanKey.split('-');
  if (parts.length !== 5 || parts[0] !== 'ACT') {
    return { valid: false, reason: 'Kalit formati noto\'g\'ri (Format: ACT-XXXX-XXXX-XXXX-XXXX)' };
  }

  const codeSegment = parts[1];
  const machSegment = parts[2];
  const currentMachSegment = normId.replace(/-/g, '').substring(0, 4);

  if (machSegment !== currentMachSegment) {
    return { valid: false, reason: 'Bu kalit boshqa kompyuter uchun yaratilgan' };
  }

  // Role-based activation key check (ACT-ADMIN, ACT-TYPE, ACT-PRINT)
  if (codeSegment === 'ADMIN' || codeSegment === 'TYPE' || codeSegment === 'PRINT') {
    const role = codeSegment.toLowerCase();
    const expectedKey = generateActivationKey(normId, 'LIFETIME', codeSegment);
    if (cleanKey === expectedKey) {
      return {
        valid: true,
        expiry: 'LIFETIME',
        isLifetime: true,
        role: role
      };
    }
    return { valid: false, reason: 'Kalit xato yoki buzilgan' };
  }

  // Legacy key check (ACT-LFT-... or ACT-D...)
  let expiry = 'LIFETIME';
  if (codeSegment !== 'LFT') {
    if (!codeSegment.startsWith('D')) {
      return { valid: false, reason: 'Kalit formati noto\'g\'ri' };
    }
    const dateNum = parseInt(codeSegment.substring(1), 36);
    const dateStr = String(dateNum);
    if (dateStr.length === 8) {
      expiry = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    } else {
      return { valid: false, reason: 'Kalit muddati aniqlanmadi' };
    }
  }

  if (expiry !== 'LIFETIME') {
    const expDate = new Date(expiry + 'T23:59:59');
    if (new Date() > expDate) {
      return { valid: false, reason: `Litsenziya muddati tugagan (${expiry})` };
    }
  }

  const expectedKey = generateActivationKey(normId, expiry, 'LEGACY');
  if (cleanKey === expectedKey) {
    return {
      valid: true,
      expiry,
      isLifetime: expiry === 'LIFETIME',
      role: 'admin'
    };
  }

  return { valid: false, reason: 'Kalit xato yoki buzilgan' };
}

/**
 * 1-Day Trial Manager
 */
function getTrialFilePath(userDataDir) {
  return path.join(userDataDir, 'trial.lic');
}

function getBlockedFilePath(userDataDir) {
  return path.join(userDataDir, 'blocked.lic');
}

function getOrInitTrial(userDataDir, machineId) {
  const trialPath = getTrialFilePath(userDataDir);
  const now = Date.now();

  if (fs.existsSync(trialPath)) {
    try {
      const raw = fs.readFileSync(trialPath, 'utf-8');
      const data = JSON.parse(raw);

      // Verify signature
      const expectedSig = crypto.createHmac('sha256', MASTER_SECRET)
        .update(`${machineId}|${data.startedAt}`)
        .digest('hex').substring(0, 16);

      if (data.signature !== expectedSig) {
        return { isTrialActive: false, isTrialExpired: true, reason: 'Sinov ma\'lumotlari buzilgan' };
      }

      // Check for clock roll-back tamper
      if (now < (data.lastSeen || data.startedAt)) {
        return { isTrialActive: false, isTrialExpired: true, reason: 'Vaqt o\'zgartirilganligi sababli sinov muddati to\'xtatildi' };
      }

      // Update last seen
      data.lastSeen = now;
      try { fs.writeFileSync(trialPath, JSON.stringify(data, null, 2), 'utf-8'); } catch (e) {}

      const elapsed = now - data.startedAt;
      if (elapsed < TRIAL_DURATION_MS) {
        const remainingMs = TRIAL_DURATION_MS - elapsed;
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return {
          isTrialActive: true,
          isTrialExpired: false,
          startedAt: data.startedAt,
          endsAt: data.startedAt + TRIAL_DURATION_MS,
          remainingHours,
          remainingMinutes,
          remainingText: `${remainingHours} soat ${remainingMinutes} daqiqa`
        };
      } else {
        return { isTrialActive: false, isTrialExpired: true, reason: '1 kunlik bepul sinov muddati tugagan' };
      }
    } catch (e) {
      return { isTrialActive: false, isTrialExpired: true, reason: 'Sinov fayli o\'qilmadi' };
    }
  }

  // Initialize 1-Day Trial for first launch
  const startedAt = now;
  const signature = crypto.createHmac('sha256', MASTER_SECRET)
    .update(`${machineId}|${startedAt}`)
    .digest('hex').substring(0, 16);

  const trialData = {
    machineId,
    startedAt,
    lastSeen: startedAt,
    signature
  };

  try {
    fs.writeFileSync(trialPath, JSON.stringify(trialData, null, 2), 'utf-8');
    return {
      isTrialActive: true,
      isTrialExpired: false,
      startedAt,
      endsAt: startedAt + TRIAL_DURATION_MS,
      remainingHours: 24,
      remainingMinutes: 0,
      remainingText: '24 soat'
    };
  } catch (e) {
    return { isTrialActive: false, isTrialExpired: true, reason: 'Sinov faylini yaratib bo\'lmadi' };
  }
}

/**
 * License file management
 */
function getLicenseFilePath(userDataDir) {
  return path.join(userDataDir, 'license.lic');
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '1526974123';

let hasNotifiedStartup = false;
let lastNotificationTime = 0;
const NOTIFY_MIN_INTERVAL_MS = 60 * 60 * 1000; // Har soatda ko'pi bilan 1 marta

function notifyTelegramBot(userDataDir, currentStatus) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return;
    }
    // 1. Agar qurilma allaqachon faollashtirilgan va korxona biriktirilgan bo'lsa ->
    // Telegramga xabar jo'natish UMUMAN KERAK EMAS!
    const isConfiguredAndActive =
      currentStatus.isActivated &&
      !currentStatus.isBlocked &&
      currentStatus.companyId &&
      currentStatus.companyId !== 'unassigned';

    if (isConfiguredAndActive) {
      return;
    }

    // 2. Birinchi marta o'rnatilib ochilganda adminga faqat 1 MARTA so'rov yuboriladi
    const notifiedTagPath = path.join(userDataDir, 'initial_setup_notified.tag');
    if (fs.existsSync(notifiedTagPath)) {
      return;
    }

    // Tag faylini belgilab qo'yamiz
    try {
      fs.writeFileSync(notifiedTagPath, `${currentStatus.machineId || ''}|${Date.now()}`, 'utf-8');
    } catch (e) {}

    const machId = currentStatus.machineId || getHardwareId();
    const hostname = os.hostname();
    const username = os.userInfo ? os.userInfo().username : 'user';

    const text = `🆕 <b>YANGI QURILMA SO'ROVI!</b>\n━━━━━━━━━━━━━━━━━━━━\n💻 <b>Qurilma Kodi:</b> <code>${machId}</code>\n👤 <b>Kompyuter:</b> ${hostname} (${username})\n🏢 <b>Korxona:</b> ⚠️ <i>Biriktirilmagan (Majburiy)</i>\n📊 <b>Holati:</b> ⏳ Korxona va rol biriktirish kutilmoqda\n📅 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}\n━━━━━━━━━━━━━━━━━━━━\n<i>Qurilma dasturga birinchi marta kirdi. Dastur ishlashi uchun korxona va rolni belgilang:</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🏢 Korxona Biriktirish (Majburiy)', callback_data: `pick_comp:${machId}` }
        ],
        [
          { text: '👑 Admin', callback_data: `approve:${machId}:admin` },
          { text: '⌨️ Type', callback_data: `approve:${machId}:type` },
          { text: '🖨️ Print', callback_data: `approve:${machId}:print` }
        ],
        [
          { text: '⛔ Bloklash', callback_data: `block:${machId}` }
        ]
      ]
    };

    const sendData = JSON.stringify({
      chat_id: TELEGRAM_ADMIN_CHAT_ID,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });

    const postReq = https.request(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(sendData)
      },
      timeout: 4000
    });
    postReq.on('error', () => {});
    postReq.write(sendData);
    postReq.end();
  } catch (e) {}
}

let lastCloudSyncTime = 0;
const CLOUD_SYNC_MIN_INTERVAL_MS = 60 * 1000; // Ko'pi bilan har 1 daqiqada 1 marta

/**
 * Cloud Telemetry & Remote Kill Check
 */
function syncWithCloud(userDataDir, currentStatus, force = false) {
  // 1. Yangi qurilma bo'lsa, faqat birinchi marta adminga so'rov yuborish
  notifyTelegramBot(userDataDir, currentStatus);

  if (!CLOUD_CONFIG.rtdbUrl) return;

  const now = Date.now();
  if (!force && (now - lastCloudSyncTime < CLOUD_SYNC_MIN_INTERVAL_MS)) {
    return;
  }
  lastCloudSyncTime = now;

  const machineId = currentStatus.machineId || getHardwareId();
  const telemetry = {
    machineId,
    hostname: os.hostname(),
    osUser: os.userInfo ? os.userInfo().username : 'user',
    platform: os.platform(),
    isActivated: !!currentStatus.isActivated,
    isTrial: !!currentStatus.isTrial,
    isLifetime: !!currentStatus.isLifetime,
    expiry: currentStatus.expiry || (currentStatus.isTrial ? 'Trial 24h' : 'None'),
    licenseKey: currentStatus.licenseKey || '',
    appVersion: '1.3.0',
    lastSeenAt: new Date().toISOString()
  };

  try {
    const url = `${CLOUD_CONFIG.rtdbUrl}/devices/${machineId}.json`;
    const dataStr = JSON.stringify(telemetry);
    const parsedUrl = new URL(url);
    const blockPath = getBlockedFilePath(userDataDir);
    const licPath = getLicenseFilePath(userDataDir);

    // 1. Send telemetry patch
    const patchReq = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      },
      timeout: 4000
    });
    patchReq.on('error', () => {});
    patchReq.on('timeout', () => patchReq.destroy());
    patchReq.write(dataStr);
    patchReq.end();

    // 2. Fetch full current device state from Firebase to check remote block or remote role assignment
    const getReq = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 4000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const resp = JSON.parse(body);
          if (!resp) return;

          // A) Remote Kill Switch (Block)
          if (resp.isBlocked === true) {
            fs.writeFileSync(blockPath, JSON.stringify({
              blockedAt: resp.updatedAt || new Date().toISOString(),
              reason: resp.blockReason || 'Ma\'muriyat tomonidan bloklangan'
            }, null, 2), 'utf-8');
          } else if (resp.isBlocked === false && fs.existsSync(blockPath)) {
            // Unblock
            try { fs.unlinkSync(blockPath); } catch (e) {}
          }

          // B) Remote Role Assignment, Activation Key, Company Assignment & Validation Setting
          if (resp.companyId || resp.companyName || resp.requireTicketValidation !== undefined || (resp.licenseKey && resp.role && !resp.isBlocked)) {
            let licObj = {};
            if (fs.existsSync(licPath)) {
              try { licObj = JSON.parse(fs.readFileSync(licPath, 'utf-8')) || {}; } catch (e) {}
            }
            let changed = false;
            if (resp.companyId && licObj.companyId !== resp.companyId) {
              licObj.companyId = resp.companyId;
              changed = true;
            }
            if (resp.companyName && licObj.companyName !== resp.companyName) {
              licObj.companyName = resp.companyName;
              changed = true;
            }
            if (resp.requireTicketValidation !== undefined && licObj.requireTicketValidation !== resp.requireTicketValidation) {
              licObj.requireTicketValidation = resp.requireTicketValidation;
              changed = true;
            }
            if (resp.licenseKey && resp.role && !resp.isBlocked && licObj.key !== resp.licenseKey) {
              const check = verifyActivationKey(machineId, resp.licenseKey);
              if (check.valid) {
                licObj.key = resp.licenseKey;
                licObj.role = check.role || resp.role;
                licObj.activatedAt = licObj.activatedAt || new Date().toISOString();
                licObj.isLifetime = Boolean(check.isLifetime);
                changed = true;
                const trialPath = getTrialFilePath(userDataDir);
                if (fs.existsSync(trialPath)) {
                  try { fs.unlinkSync(trialPath); } catch (e) {}
                }
              }
            }
            if (changed) {
              fs.writeFileSync(licPath, JSON.stringify(licObj, null, 2), 'utf-8');
            }
          }
        } catch (e) {}
      });
    });
    getReq.on('error', () => {});
    getReq.on('timeout', () => getReq.destroy());
    getReq.end();
  } catch (e) {}
}

function checkLicenseStatus(userDataDir) {
  const machineId = getHardwareId();
  const licPath = getLicenseFilePath(userDataDir);
  const blockPath = getBlockedFilePath(userDataDir);

  // 0. Check if device is blocked by admin (Remote Kill Switch)
  if (fs.existsSync(blockPath)) {
    try {
      const blockData = JSON.parse(fs.readFileSync(blockPath, 'utf-8'));
      return {
        isActivated: false,
        isTrial: false,
        isBlocked: true,
        machineId,
        message: blockData.reason || 'Sizning qurilmangiz ma\'muriyat tomonidan bloklandi. Dasturdan foydalanish to\'xtatildi.'
      };
    } catch (e) {
      return {
        isActivated: false,
        isTrial: false,
        isBlocked: true,
        machineId,
        message: 'Sizning qurilmangiz ma\'muriyat tomonidan bloklandi.'
      };
    }
  }

  let statusResult = null;

  // 1. If permanent/valid license exists
  let companyId = null;
  let companyName = null;
  let requireTicketValidation = true;
  if (fs.existsSync(licPath)) {
    try {
      const raw = fs.readFileSync(licPath, 'utf-8');
      const licData = JSON.parse(raw);
      if (licData.companyId) companyId = licData.companyId;
      if (licData.companyName) companyName = licData.companyName;
      if (licData.requireTicketValidation !== undefined) {
        requireTicketValidation = licData.requireTicketValidation;
      }

      const check = verifyActivationKey(machineId, licData.key);
      if (check.valid) {
        statusResult = {
          isActivated: true,
          isTrial: false,
          isBlocked: false,
          machineId,
          licenseKey: licData.key,
          role: check.role || licData.role || 'admin',
          companyId,
          companyName,
          isCompanyAssigned: !!companyId,
          requireTicketValidation,
          expiry: check.expiry,
          isLifetime: check.isLifetime,
          activatedAt: licData.activatedAt,
          message: check.isLifetime ? 'Muddatsiz litsenziya faol' : `Litsenziya faol (${check.expiry} gacha)`
        };
      }
    } catch (err) {}
  }

  // 2. Check 1-Day Trial
  if (!statusResult) {
    const trial = getOrInitTrial(userDataDir, machineId);
    if (trial.isTrialActive) {
      statusResult = {
        isActivated: true,
        isTrial: true,
        isBlocked: false,
        machineId,
        role: 'admin',
        companyId,
        companyName,
        isCompanyAssigned: !!companyId,
        requireTicketValidation,
        remainingHours: trial.remainingHours,
        remainingMinutes: trial.remainingMinutes,
        remainingText: trial.remainingText,
        trialEndsAt: trial.endsAt,
        message: `1 kunlik sinov muddati: ${trial.remainingText} qoldi`
      };
    } else {
      statusResult = {
        isActivated: false,
        isTrial: false,
        isTrialExpired: true,
        isBlocked: false,
        machineId,
        role: null,
        companyId,
        companyName,
        isCompanyAssigned: !!companyId,
        requireTicketValidation,
        message: '1 kunlik bepul sinov muddati tugagan. Dasturdan foydalanish uchun aktivatsiya kalitini kiriting.'
      };
    }
  }

  // Trigger background cloud sync & telemetry
  try {
    syncWithCloud(userDataDir, statusResult);
  } catch (e) {}

  return statusResult;
}

function saveLicense(userDataDir, key) {
  const machineId = getHardwareId();
  const check = verifyActivationKey(machineId, key);

  if (!check.valid) {
    return { success: false, error: check.reason };
  }

  // Clear any blocked marker on valid activation if requested
  const blockPath = getBlockedFilePath(userDataDir);
  if (fs.existsSync(blockPath)) {
    try { fs.unlinkSync(blockPath); } catch (e) {}
  }

  const licPath = getLicenseFilePath(userDataDir);
  let existingCompanyId = 'company_main';
  let existingCompanyName = 'Asosiy Korxona';
  let existingRequireTicketValidation = true;
  if (fs.existsSync(licPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(licPath, 'utf-8'));
      if (prev.companyId) existingCompanyId = prev.companyId;
      if (prev.companyName) existingCompanyName = prev.companyName;
      if (prev.requireTicketValidation !== undefined) existingRequireTicketValidation = prev.requireTicketValidation;
    } catch (e) {}
  }

  const data = {
    key: key.trim().toUpperCase(),
    machineId,
    role: check.role || 'admin',
    companyId: existingCompanyId,
    companyName: existingCompanyName,
    requireTicketValidation: existingRequireTicketValidation,
    expiry: check.expiry,
    isLifetime: check.isLifetime,
    activatedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(licPath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Sync active license to cloud
    syncWithCloud(userDataDir, {
      machineId,
      isActivated: true,
      isTrial: false,
      isLifetime: check.isLifetime,
      expiry: check.expiry,
      licenseKey: data.key
    }, true);

    return {
      success: true,
      licenseInfo: data
    };
  } catch (err) {
    return { success: false, error: 'Litsenziyani saqlashda xatolik: ' + err.message };
  }
}

function setLicenseCompany(userDataDir, companyId, companyName) {
  try {
    const licPath = getLicenseFilePath(userDataDir);
    let licObj = {};
    if (fs.existsSync(licPath)) {
      try {
        licObj = JSON.parse(fs.readFileSync(licPath, 'utf-8')) || {};
      } catch (e) {}
    }
    licObj.companyId = companyId;
    licObj.companyName = companyName || companyId;
    fs.writeFileSync(licPath, JSON.stringify(licObj, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Korxonani saqlashda xatolik: ' + err.message };
  }
}

module.exports = {
  getHardwareId,
  generateActivationKey,
  verifyActivationKey,
  checkLicenseStatus,
  saveLicense,
  setLicenseCompany,
  syncWithCloud
};
