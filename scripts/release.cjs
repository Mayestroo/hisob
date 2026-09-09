const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');
const DIST_DIR = path.join(ROOT_DIR, 'dist-build');

// 1. Calculate New Version
function bumpVersion(currentVer, type = 'patch') {
  const clean = currentVer.replace(/^v/i, '').trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);

  let [major, minor, patch] = parts;

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else if (type === 'patch') {
    patch += 1;
  } else if (/^\d+\.\d+\.\d+/.test(type)) {
    return type.replace(/^v/i, '').trim();
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

// 2. Update files (.env.local and package.json)
function updateVersionFiles(newVersion) {
  // Update package.json
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  pkg.version = newVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  // Update .env.local if exists
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    let envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
    if (/VITE_APP_VERSION=.*/.test(envContent)) {
      envContent = envContent.replace(/VITE_APP_VERSION=.*/, `VITE_APP_VERSION=${newVersion}`);
    } else {
      envContent += `\nVITE_APP_VERSION=${newVersion}\n`;
    }
    fs.writeFileSync(ENV_LOCAL_PATH, envContent, 'utf-8');
  }
}

// 3. Update Firebase RTDB /app_updates
function updateFirebase(newVersion, downloadUrl, notes) {
  return new Promise((resolve) => {
    let firebaseUrl = 'https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app';
    if (fs.existsSync(ENV_LOCAL_PATH)) {
      const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
      const m = content.match(/VITE_FIREBASE_DATABASE_URL=(.+)/);
      if (m && m[1]) firebaseUrl = m[1].trim();
    }

    const payload = JSON.stringify({
      version: newVersion,
      downloadUrl,
      releaseNotes: notes,
      publishedAt: new Date().toISOString()
    });

    try {
      const putUrl = new URL(`${firebaseUrl.replace(/\/$/, '')}/app_updates.json`);
      const req = https.request(
        putUrl,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          console.log(`[Firebase RTDB] Yangilanish e'lon qilindi (HTTP ${res.statusCode})`);
          resolve(true);
        }
      );

      req.on('error', (err) => {
        console.warn('[Firebase RTDB] Ogohlantirish: Firebase yangilanmadi:', err.message);
        resolve(false);
      });

      req.write(payload);
      req.end();
    } catch (e) {
      console.warn('[Firebase RTDB] Xatolik:', e.message);
      resolve(false);
    }
  });
}

async function main() {
  const bumpType = process.argv[2] || 'patch';
  const customNotes = process.argv[3] || '';

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  const currentVersion = pkg.version || '1.5.9';
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n======================================================`);
  console.log(`🚀 NOVDA AVTOMATIK RELEASE: v${currentVersion} ➔ v${newVersion} (${bumpType})`);
  console.log(`======================================================\n`);

  // Step 1: Update version in files
  console.log(`📝 [1/5] Versiya yangilanmoqda (package.json, .env.local)...`);
  updateVersionFiles(newVersion);
  console.log(`   ✓ Versiya v${newVersion} ga o'rnatildi.`);

  // Step 2: Build frontend
  console.log(`\n🔨 [2/5] Frontend yig'ilmoqda (tsc && vite build)...`);
  execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });
  console.log(`   ✓ Frontend muvaffaqiyatli yig'ildi.`);

  // Step 3: Build Electron installer
  console.log(`\n📦 [3/5] Windows Installer (.exe) yaratilmoqda...`);
  execSync('npx electron-builder --win nsis', { stdio: 'inherit', cwd: ROOT_DIR });

  // Locate the created .exe file
  const files = fs.existsSync(DIST_DIR) ? fs.readdirSync(DIST_DIR) : [];
  const exeFile = files.find((f) => f.includes(newVersion) && f.endsWith('.exe')) || files.find((f) => f.endsWith('.exe'));

  if (!exeFile) {
    console.error(`❌ Xatolik: dist-build papkasida .exe fayl topilmadi!`);
    process.exit(1);
  }

  const exePath = path.join(DIST_DIR, exeFile);
  console.log(`   ✓ Installer tayyor: ${exeFile}`);

  // Step 4: Git tag and push
  console.log(`\n🏷️ [4/5] Git commit va tag yaratilmoqda...`);
  try {
    execSync(`git add package.json .env.local`, { cwd: ROOT_DIR });
    execSync(`git commit -m "chore(release): bump version to v${newVersion}"`, { cwd: ROOT_DIR });
  } catch {}

  try {
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { cwd: ROOT_DIR });
    console.log(`   ✓ Git tag v${newVersion} yaratildi.`);
    console.log(`   Push qilinmoqda (origin master --tags)...`);
    execSync(`git push origin master --tags`, { stdio: 'inherit', cwd: ROOT_DIR });
  } catch (err) {
    console.warn(`   ⚠️ Git push ogohlantirishi:`, err.message);
  }

  // Step 5: Upload to GitHub Releases
  console.log(`\n☁️ [5/5] GitHub Releasesga yuklanmoqda...`);
  const releaseNotes = customNotes || `Novda Hisob-Kitob Tizimi v${newVersion} rasmiy yangilanishi.`;
  const repo = 'Mayestroo/hisob-releases';

  try {
    execSync(`gh release create v${newVersion} "${exePath}" --repo ${repo} --title "v${newVersion}" --notes "${releaseNotes}"`, {
      stdio: 'inherit',
      cwd: ROOT_DIR
    });
    console.log(`   ✓ GitHub Releasesga muvaffaqiyatli yuklandi!`);
  } catch (err) {
    console.log(`   Mavjud release ga yuklashga urinilmoqda (--clobber)...`);
    try {
      execSync(`gh release upload v${newVersion} "${exePath}" --repo ${repo} --clobber`, {
        stdio: 'inherit',
        cwd: ROOT_DIR
      });
      console.log(`   ✓ Fayl GitHub Releasesga yuklandi!`);
    } catch (uploadErr) {
      console.error(`❌ GitHub Releasesga yuklashda xatolik:`, uploadErr.message);
    }
  }

  // Step 6: Update Firebase RTDB so all connected client PCs get update notification instantly
  const directDownloadUrl = `https://github.com/${repo}/releases/download/v${newVersion}/${exeFile}`;
  await updateFirebase(newVersion, directDownloadUrl, releaseNotes);

  console.log(`\n======================================================`);
  console.log(`🎉 RELEASE TAYYOR VA YUKLANDI!`);
  console.log(`   Versiya: v${newVersion}`);
  console.log(`   GitHub:  https://github.com/${repo}/releases/tag/v${newVersion}`);
  console.log(`   Fayl:    ${directDownloadUrl}`);
  console.log(`   Barcha faol kompyuterlar yangilanish haqida xabar oldi!`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal Release Error:', err);
  process.exit(1);
});
