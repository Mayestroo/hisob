const fs = require('fs');
const path = require('path');

// .env.local dan Firebase URL ni o'qish (yoki default URL)
function getFirebaseDatabaseUrl() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_FIREBASE_DATABASE_URL\s*=\s*(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return 'https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app';
}

async function backupFirebase() {
  const dbUrl = getFirebaseDatabaseUrl().replace(/\/$/, '');
  console.log(`[Backup] Firebase bazasidan yuklab olinmoqda: ${dbUrl}`);

  const targetUrl = `${dbUrl}/.json`;
  const startTime = Date.now();
  
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Firebase ga so'rov xatosi: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Backup] Ma'lumotlar yuklab olindi (${duration}s)`);

  const backupsDir = path.resolve(__dirname, '..', 'data', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  const fileName = `firebase_backup_${timestamp}.json`;
  const filePath = path.join(backupsDir, fileName);

  const formattedJson = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, formattedJson, 'utf8');

  // Shuningdek har doim eng so'nggi holat uchun 'firebase_backup_latest.json' yaratamiz
  const latestPath = path.join(backupsDir, 'firebase_backup_latest.json');
  fs.writeFileSync(latestPath, formattedJson, 'utf8');

  const sizeKb = (Buffer.byteLength(formattedJson, 'utf8') / 1024).toFixed(2);

  console.log(`\n================ BACKUP HISOBOTI ================`);
  console.log(`Holati: MUVAFFFAQIYATLI SAQLANDI`);
  console.log(`Fayl nomi: ${fileName}`);
  console.log(`To'liq yo'l: ${filePath}`);
  console.log(`Hajmi: ${sizeKb} KB`);
  console.log(`Top-level bo'limlar:`, Object.keys(data || {}));
  
  if (data && data.companies) {
    console.log(`Kompaniyalar ro'yxati:`, Object.keys(data.companies));
    for (const [compId, compData] of Object.entries(data.companies)) {
      const syncDataKeys = compData?.syncData ? Object.keys(compData.syncData) : [];
      const archivesKeys = compData?.archives ? Object.keys(compData.archives) : [];
      console.log(`  - [${compId}]: syncData kalitlari (${syncDataKeys.length} ta), arxivlar (${archivesKeys.length} ta)`);
    }
  }

  if (data && data.devices) {
    console.log(`Qurilmalar (devices) soni:`, Object.keys(data.devices).length);
  }

  console.log(`=================================================\n`);
  return { filePath, latestPath, sizeKb, fileName };
}

backupFirebase().catch((err) => {
  console.error('[Backup Xatosi]:', err);
  process.exit(1);
});
