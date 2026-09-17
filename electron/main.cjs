const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const child_process = require('child_process');
const license = require('./license.cjs');

let mainWindow;

// ==================== SINGLE INSTANCE LOCK ====================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // If another instance is already running, quit immediately
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // If user attempted to launch a second instance, focus and restore our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

// ==================== DATA LAYER ====================
function getDataDir() {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'NovdaData');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function getActiveCompanyId() {
  try {
    const lic = license.checkLicenseStatus(app.getPath('userData'));
    return lic?.companyId || 'company_main';
  } catch {
    return 'company_main';
  }
}

function getCompanyDbPath(companyId) {
  const compId = companyId || getActiveCompanyId();
  const safeCompId = (compId || 'company_main').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getDataDir(), `hisob_database_${safeCompId}.json`);
}

function getBackupsDir(companyId) {
  const compId = companyId || getActiveCompanyId();
  const safeCompId = compId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(getDataDir(), 'backups', safeCompId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getArchivesDir(companyId) {
  const compId = companyId || getActiveCompanyId();
  const safeCompId = compId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(getDataDir(), 'archives', safeCompId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLocalTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function readDb(companyId) {
  const compId = companyId || getActiveCompanyId();
  const p = getCompanyDbPath(compId);
  
  if (!fs.existsSync(p)) {
    // Migration fallback: if company specific db doesn't exist, check legacy hisob_database.json
    const legacyPath = path.join(getDataDir(), 'hisob_database.json');
    if (fs.existsSync(legacyPath)) {
      try {
        const legacyData = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
        // Only allow legacy data if it matches company_main or matches the current company
        if (compId === 'company_main' || !legacyData.companyId || legacyData.companyId === compId) {
          return legacyData;
        }
      } catch {}
    }
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// Serialized per-company write queues to prevent read-modify-write races
const companyWriteQueues = new Map();

function enqueueCompanyWrite(companyId, task) {
  const safeCompId = companyId || 'company_main';
  const currentPromise = companyWriteQueues.get(safeCompId) || Promise.resolve();
  const nextPromise = currentPromise
    .catch(() => {})
    .then(() => task());
  companyWriteQueues.set(safeCompId, nextPromise);
  return nextPromise;
}

async function writeDbAsync(data, companyId) {
  const compId = companyId || data?.companyId || getActiveCompanyId();
  if (data && typeof data === 'object') {
    data.companyId = compId;
  }
  const p = getCompanyDbPath(compId);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${p}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const json = JSON.stringify(data);
  await fs.promises.writeFile(tempPath, json, 'utf-8');

  try {
    await fs.promises.rename(tempPath, p);
  } catch (renameErr) {
    if (renameErr.code === 'EEXIST' || renameErr.code === 'EPERM') {
      try {
        await fs.promises.unlink(p);
      } catch {}
      await fs.promises.rename(tempPath, p);
    } else {
      try { await fs.promises.unlink(tempPath); } catch {}
      throw renameErr;
    }
  }
}

const companyBackupTimes = new Map();
async function maybeCreateBackup(data, force = false, companyId) {
  const compId = companyId || data?.companyId || getActiveCompanyId();
  const now = Date.now();
  const lastTime = companyBackupTimes.get(compId) || 0;
  if (!force && (now - lastTime < 3 * 60 * 1000)) {
    return;
  }
  companyBackupTimes.set(compId, now);
  try {
    const compBackupDir = getBackupsDir(compId);
    if (!fs.existsSync(compBackupDir)) {
      fs.mkdirSync(compBackupDir, { recursive: true });
    }
    const ts = getLocalTimestamp();
    const nonce = Math.random().toString(36).slice(2, 6);
    const backupPath = path.join(compBackupDir, `backup_${ts}_${nonce}.json`);
    const tempBackupPath = `${backupPath}.tmp`;
    await fs.promises.writeFile(tempBackupPath, JSON.stringify(data), 'utf-8');
    await fs.promises.rename(tempBackupPath, backupPath);

    // Asynchronously prune older backups (keep last 30) without blocking
    setImmediate(async () => {
      try {
        const files = (await fs.promises.readdir(compBackupDir)).filter(f => f.endsWith('.json')).sort();
        if (files.length > 30) {
          for (const f of files.slice(0, files.length - 30)) {
            try { await fs.promises.unlink(path.join(compBackupDir, f)); } catch {}
          }
        }
      } catch {}
    });
  } catch (err) {
    console.warn('[Main] Backup write error:', err);
  }
}

// ==================== IPC HANDLERS ====================
ipcMain.handle('db-read', (event, targetCompanyId) => {
  return { success: true, data: readDb(targetCompanyId) };
});

ipcMain.handle('db-write', async (event, data, options = {}) => {
  const compId = options?.companyId || data?.companyId || getActiveCompanyId();
  return enqueueCompanyWrite(compId, async () => {
    try {
      await writeDbAsync(data, compId);
      const isMajor = options?.forceBackup || false;
      await maybeCreateBackup(data, isMajor, compId);
      return { success: true, savedAt: new Date().toISOString() };
    } catch (err) {
      console.error('[Main] db-write error:', err);
      return { success: false, error: err.message };
    }
  });
});

// Phase 5: Fast Delta Patch IPC with serialized queue
ipcMain.handle('db-patch', async (event, patches, options = {}) => {
  const compId = options?.companyId || patches?.companyId || getActiveCompanyId();
  return enqueueCompanyWrite(compId, async () => {
    try {
      const current = readDb(compId) || {};
      const updated = { ...current, ...patches, companyId: compId, updatedAt: new Date().toISOString() };
      await writeDbAsync(updated, compId);
      return { success: true, savedAt: updated.updatedAt };
    } catch (err) {
      console.error('[Main] db-patch error:', err);
      return { success: false, error: err.message };
    }
  });
});

function getArchiveIndexPath(companyId) {
  return path.join(getArchivesDir(companyId), 'index.json');
}

function updateArchiveIndex(entry, companyId) {
  try {
    const p = getArchiveIndexPath(companyId);
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
    }
    list = list.filter(i => i.filename !== entry.filename);
    list.unshift(entry);
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {}
}

function sanitizeArchiveFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const base = path.basename(filename);
  if (!/^[a-zA-Z0-9_\-.]+\.json$/i.test(base)) return null;
  return base;
}

function resolveSecurePath(dir, filename) {
  const safeName = sanitizeArchiveFilename(filename);
  if (!safeName) return null;
  const resolvedDir = path.resolve(dir);
  const target = path.resolve(resolvedDir, safeName);
  if (!target.startsWith(resolvedDir + path.sep) && target !== resolvedDir) {
    return null;
  }
  return target;
}

ipcMain.handle('archives-list-meta', (event, companyId) => {
  try {
    const p = getArchiveIndexPath(companyId);
    if (fs.existsSync(p)) {
      return { success: true, archives: JSON.parse(fs.readFileSync(p, 'utf-8')) };
    }
    return { success: true, archives: [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('archives-list', (event, companyId) => {
  try {
    const p = getArchiveIndexPath(companyId);
    if (fs.existsSync(p)) {
      try {
        const cached = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (Array.isArray(cached) && cached.length > 0) {
          return { success: true, archives: cached };
        }
      } catch {}
    }

    const dir = getArchivesDir(companyId);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort().reverse();
    const list = files.map(filename => {
      try {
        const fullPath = resolveSecurePath(dir, filename);
        if (!fullPath) return { filename };
        const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          filename,
          period: raw.period,
          archivedAt: raw.archivedAt,
          workersCount: (raw.workers || []).length
        };
      } catch { return { filename }; }
    });

    try { fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8'); } catch {}
    return { success: true, archives: list };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('archive-save', (event, { filename, data, companyId }) => {
  try {
    const dir = getArchivesDir(companyId);
    const filepath = resolveSecurePath(dir, filename);
    if (!filepath) {
      return { success: false, error: 'Xavfsizlik xatosi: Noto\'g\'ri fayl nomi' };
    }
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    updateArchiveIndex({
      filename: path.basename(filepath),
      period: data.period,
      archivedAt: data.archivedAt || new Date().toISOString(),
      workersCount: (data.workers || []).length
    }, companyId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('archive-read', (event, args) => {
  try {
    const rawFilename = typeof args === 'string' ? args : args?.filename;
    const companyId = typeof args === 'object' ? args?.companyId : undefined;
    const aDir = getArchivesDir(companyId);
    const bDir = getBackupsDir(companyId);

    let filepath = resolveSecurePath(aDir, rawFilename);
    if (!filepath || !fs.existsSync(filepath)) {
      filepath = resolveSecurePath(bDir, rawFilename);
    }
    if (!filepath || !fs.existsSync(filepath)) {
      return { success: false, error: 'Fayl topilmadi yoki ruxsat berilmagan' };
    }
    return { success: true, data: JSON.parse(fs.readFileSync(filepath, 'utf-8')) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backups-list', (event, companyId) => {
  try {
    const bDir = getBackupsDir(companyId);
    const aDir = getArchivesDir(companyId);

    const bFiles = fs.existsSync(bDir) ? fs.readdirSync(bDir).filter(f => f.endsWith('.json')).map(f => ({ filename: f, dir: bDir, isArchive: false })) : [];
    const aFiles = fs.existsSync(aDir) ? fs.readdirSync(aDir).filter(f => f.endsWith('.json')).map(f => ({ filename: f, dir: aDir, isArchive: true })) : [];

    const all = [...aFiles, ...bFiles];
    const backups = all.map(item => {
      try {
        const fullPath = path.join(item.dir, item.filename);
        const stat = fs.statSync(fullPath);
        const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        
        let filledOpsCount = 0;
        for (const m of (raw.models || [])) {
          for (const wOps of Object.values(m.hisobQuantities || {})) {
            filledOpsCount += Object.keys(wOps || {}).length;
          }
        }

        return {
          filename: item.filename,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          isArchive: item.isArchive,
          filledOpsCount,
          workersCount: (raw.workers || []).length,
          modelsCount: (raw.models || []).length
        };
      } catch {
        return {
          filename: item.filename,
          size: 0,
          createdAt: '',
          isArchive: item.isArchive,
          filledOpsCount: 0,
          workersCount: 0,
          modelsCount: 0
        };
      }
    }).sort((a, b) => (b.filename > a.filename ? 1 : -1));

    return { success: true, backups };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup-read', (event, args) => {
  try {
    const rawFilename = typeof args === 'string' ? args : args?.filename;
    const companyId = typeof args === 'object' ? args?.companyId : undefined;
    const bDir = getBackupsDir(companyId);
    const aDir = getArchivesDir(companyId);

    let filepath = resolveSecurePath(bDir, rawFilename);
    if (!filepath || !fs.existsSync(filepath)) {
      filepath = resolveSecurePath(aDir, rawFilename);
    }
    if (!filepath || !fs.existsSync(filepath)) {
      return { success: false, error: 'Zaxira fayli topilmadi yoki ruxsat berilmagan' };
    }
    return { success: true, data: JSON.parse(fs.readFileSync(filepath, 'utf-8')) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup-restore', async (event, args) => {
  try {
    const rawFilename = typeof args === 'string' ? args : args?.filename;
    const companyId = typeof args === 'object' ? args?.companyId : undefined;
    const bDir = getBackupsDir(companyId);
    const aDir = getArchivesDir(companyId);

    let filepath = resolveSecurePath(bDir, rawFilename);
    if (!filepath || !fs.existsSync(filepath)) {
      filepath = resolveSecurePath(aDir, rawFilename);
    }
    if (!filepath || !fs.existsSync(filepath)) {
      return { success: false, error: 'Zaxira fayli topilmadi yoki ruxsat berilmagan' };
    }
    const raw = await fs.promises.readFile(filepath, 'utf-8');
    const data = JSON.parse(raw);
    await writeDbAsync(data, companyId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('license-status', () => {
  try {
    const userData = app.getPath('userData');
    return license.checkLicenseStatus(userData);
  } catch (err) {
    return {
      isActivated: false,
      machineId: license.getHardwareId(),
      message: err.message
    };
  }
});

ipcMain.handle('license-activate', (event, key) => {
  try {
    const userData = app.getPath('userData');
    return license.saveLicense(userData, key);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('license-set-company', (event, { companyId, companyName }) => {
  try {
    const userData = app.getPath('userData');
    return license.setLicenseCompany(userData, companyId, companyName);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-data-dir', () => {
  return getDataDir();
});

ipcMain.handle('print-html', async (event, { html, title }) => {
  return new Promise((resolve) => {
    let printWin = new BrowserWindow({
      show: false,
      parent: mainWindow || undefined,
      title: title || 'Novda-hisob-kitob - Print',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: false
      }
    });

    const tempDir = app.getPath('temp');
    const tempFile = path.join(tempDir, `patta_print_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`);

    fs.writeFile(tempFile, html, 'utf-8', (writeErr) => {
      if (writeErr) {
        if (printWin && !printWin.isDestroyed()) printWin.close();
        return resolve({ success: false, failureReason: writeErr.message });
      }

      printWin.loadFile(tempFile);

      printWin.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          if (!printWin || printWin.isDestroyed()) {
            return resolve({ success: false, failureReason: 'Window destroyed' });
          }

          printWin.webContents.print(
            {
              silent: false,
              printBackground: true,
              color: true
            },
            (success, failureReason) => {
              try {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              } catch {}
              try {
                if (printWin && !printWin.isDestroyed()) printWin.close();
              } catch {}
              resolve({ success, failureReason });
            }
          );
        }, 300);
      });

      printWin.webContents.on('did-fail-load', (e, code, desc) => {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {}
        try {
          if (printWin && !printWin.isDestroyed()) printWin.close();
        } catch {}
        resolve({ success: false, failureReason: desc });
      });
    });
  });
});

// ==================== AUTO UPDATER ====================
function downloadFile(url, destPath, onProgress, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects while downloading update'));

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return reject(new Error('Noto\'g\'ri URL formati: ' + url));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, (res) => {
      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http')) {
          nextUrl = new URL(nextUrl, url).toString();
        }
        res.resume();
        return downloadFile(nextUrl, destPath, onProgress, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Yuklab olishda xatolik: HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress) {
          const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          onProgress({ downloadedBytes, totalBytes, percent });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(destPath));
      });

      fileStream.on('error', (err) => {
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
        reject(err);
      });
    });

    req.on('error', (err) => {
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
      reject(err);
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Yuklab olish vaqti tugadi (Timeout)'));
    });
  });
}

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

let lastDownloadedUpdatePath = null;

const TRUSTED_UPDATE_HOSTS = [
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'release.novda.uz',
  'hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app',
  'firebasestorage.googleapis.com'
];

function isAllowedUpdateUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_UPDATE_HOSTS.some((host) => hostname === host || hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

ipcMain.handle('download-app-update', async (event, { url, version }) => {
  if (!url) return { success: false, error: 'URL kiritilmagan' };
  if (!isAllowedUpdateUrl(url)) {
    return {
      success: false,
      error: 'Xavfsizlik xatosi: Ishonchsiz yangilanish serveri yoki protokol (Faqat ruxsat berilgan HTTPS qabul qilinadi)'
    };
  }
  const tempDir = app.getPath('temp');
  const safeVer = (version || 'latest').replace(/[^a-zA-Z0-9.-]/g, '_');
  const destPath = path.join(tempDir, `Novda-Update-${safeVer}.exe`);

  try {
    await downloadFile(url, destPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-update-progress', progress);
      }
    });
    lastDownloadedUpdatePath = destPath;
    return { success: true, filePath: destPath };
  } catch (err) {
    console.error('Update download error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-app-update', async (event, { filePath }) => {
  const tempDir = app.getPath('temp');
  const resolvedPath = path.resolve(filePath || '');
  const resolvedTemp = path.resolve(tempDir);

  if (
    !filePath ||
    !resolvedPath.startsWith(resolvedTemp + path.sep) ||
    !resolvedPath.toLowerCase().endsWith('.exe') ||
    (lastDownloadedUpdatePath && resolvedPath !== path.resolve(lastDownloadedUpdatePath)) ||
    !fs.existsSync(resolvedPath)
  ) {
    return { success: false, error: 'Xavfsizlik xatosi: Noto\'g\'ri yoki tekshirilmagan o\'rnatuvchi fayli' };
  }
  try {
    const child = child_process.spawn(resolvedPath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 400);

    return { success: true };
  } catch (err) {
    console.error('Update install error:', err);
    return { success: false, error: err.message };
  }
});

// ==================== WINDOW ====================
function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Novda - Hisob-Kitob Tizimi',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a'
  });

  const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexHtml);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`did-fail-load: ${errorCode} - ${errorDescription}`);
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('render-process-gone:', details);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

process.on('uncaughtException', (err) => {
  console.error('Main process uncaughtException:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
