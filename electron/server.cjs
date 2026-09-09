const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function setupServer(customDataDir, distDir) {
  const app = express();
  const PORT = 3001;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const DATA_DIR = customDataDir || path.join(__dirname, '..', 'data');
  const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
  const ARCHIVES_DIR = path.join(DATA_DIR, 'archives');
  const DB_FILE = path.join(DATA_DIR, 'hisob_database.json');
  const LOG_FILE = path.join(DATA_DIR, 'history_log.txt');
  const LIVE_EXCEL_FILE = path.join(DATA_DIR, 'Novda_Hisob_Oxirgi.xlsx');

  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  if (!fs.existsSync(ARCHIVES_DIR)) fs.mkdirSync(ARCHIVES_DIR, { recursive: true });

  // If DB_FILE does not exist in customDataDir, seed from packaged template if available
  if (!fs.existsSync(DB_FILE)) {
    const templateDb = path.join(__dirname, '..', 'data', 'hisob_database.json');
    if (fs.existsSync(templateDb)) {
      try {
        fs.copyFileSync(templateDb, DB_FILE);
      } catch (e) {}
    }
  }

  function saveExcelFile(data) {
    try {
      const { models = [], workers = [] } = data;
      if (!models.length || !workers.length) return;

      const wb = XLSX.utils.book_new();

      // Master Umumiy Sheet
      const umumiyData = [];
      umumiyData.push(['№', 'F.I.O', 'Sof foyda', 'Staj', 'Avans', 'Jarima', 'Umumiy']);
      umumiyData.push(['', '', '', '', '', '', '']);

      let totalUmumiy = 0;
      let totalStaj = 0;
      let totalAvans = 0;
      let totalJarima = 0;
      let totalSofFoyda = 0;

      for (const worker of workers) {
        let workerUmumiy = 0;
        for (const model of models) {
          const workerQtyMap = (model.hisobQuantities && model.hisobQuantities[worker.id]) || {};
          for (const op of model.operations || []) {
            const qty = workerQtyMap[op.name] || 0;
            workerUmumiy += (qty * op.rate);
          }
        }
        const staj = worker.staj || 0;
        const avans = worker.avans || 0;
        const jarima = worker.jarima || 0;
        const sofFoyda = workerUmumiy - avans - staj - jarima;

        totalUmumiy += workerUmumiy;
        totalStaj += staj;
        totalAvans += avans;
        totalJarima += jarima;
        totalSofFoyda += sofFoyda;

        umumiyData.push([
          worker.id,
          worker.name,
          sofFoyda,
          staj > 0 ? staj : '',
          avans > 0 ? avans : '',
          jarima > 0 ? jarima : '',
          workerUmumiy
        ]);
      }

      umumiyData.push(['ЖАМИ', '', totalSofFoyda, totalStaj, totalAvans, totalJarima, totalUmumiy]);

      const wsUmumiy = XLSX.utils.aoa_to_sheet(umumiyData);
      XLSX.utils.book_append_sheet(wb, wsUmumiy, 'Umumiy');

      for (const model of models) {
        const pattaData = [];
        pattaData.push(['№', model.title || `Модел- ${model.name}`, '', '', '', '', '', '', '', '']);
        pattaData.push(['', 'Сана- ', '', '', model.party || '', '', '', `Ранг ${model.color || ''}`, 'Размер', 'сони ']);
        pattaData.push(['', '', '', '', '', '', '', '', model.size || 'XL', '']);
        pattaData.push(['', '', '', '', 'Номер', 'Исм фамилия', '', '', 'Брак иш', '']);

        (model.pattaOpsOrder || []).forEach((opName, idx) => {
          pattaData.push([idx + 1, opName, '', '', '', '', '', '', '', '']);
        });

        const wsPatta = XLSX.utils.aoa_to_sheet(pattaData);
        XLSX.utils.book_append_sheet(wb, wsPatta, model.name);

        const hisobData = [];
        const header1 = ['', ''];
        const header2 = ['№', 'Исм фамилия'];
        const opTotals = {};

        for (const op of model.operations || []) {
          header1.push(op.name, '');
          header2.push(op.rate, 'Сони');
          opTotals[op.name] = { amount: 0, qty: 0 };
        }
        header1.push('ЖАМИ');
        header2.push('');
        hisobData.push(header1, header2);

        let grandTotalAmount = 0;
        for (const worker of workers) {
          const row = [worker.id, worker.name];
          let workerTot = 0;
          const wMap = (model.hisobQuantities && model.hisobQuantities[worker.id]) || {};

          for (const op of model.operations || []) {
            const qty = wMap[op.name] || 0;
            const amount = qty * op.rate;
            row.push(amount > 0 ? amount : '', qty > 0 ? qty : '');
            workerTot += amount;
            opTotals[op.name].amount += amount;
            opTotals[op.name].qty += qty;
          }
          row.push(workerTot > 0 ? workerTot : 0);
          grandTotalAmount += workerTot;
          hisobData.push(row);
        }

        const totalRow = ['ЖАМИ', ''];
        for (const op of model.operations || []) {
          totalRow.push(opTotals[op.name].amount || 0, opTotals[op.name].qty || 0);
        }
        totalRow.push(grandTotalAmount);
        hisobData.push(totalRow);

        const wsHisob = XLSX.utils.aoa_to_sheet(hisobData);
        XLSX.utils.book_append_sheet(wb, wsHisob, model.hisobSheetName || `${model.name}-hisob`);
      }

      XLSX.set_fs(fs);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(LIVE_EXCEL_FILE, buf);
    } catch (err) {
      console.error('[Excel Sync Error]:', err);
    }
  }

  // API Routes
  app.get('/api/data', (req, res) => {
    try {
      if (!fs.existsSync(DB_FILE)) {
        return res.json({ success: true, data: null });
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const json = JSON.parse(raw);
      res.json({ success: true, data: json });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/data', async (req, res) => {
    try {
      const data = req.body;
      if (!data) return res.status(400).json({ error: 'No data provided' });

      await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');

      // Generate excel asynchronously in background without blocking the client response
      setImmediate(() => {
        try {
          saveExcelFile(data);
        } catch (excelErr) {
          console.error('[Server] Background excel save error:', excelErr);
        }
      });

      res.json({ success: true, savedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/archives', (req, res) => {
    try {
      if (!fs.existsSync(ARCHIVES_DIR)) return res.json({ success: true, archives: [] });
      const files = fs.readdirSync(ARCHIVES_DIR).filter(f => f.endsWith('.json')).reverse();
      const list = files.map(filename => {
        const fullPath = path.join(ARCHIVES_DIR, filename);
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(raw);
        const excelName = filename.replace('.json', '.xlsx');
        const hasExcel = fs.existsSync(path.join(ARCHIVES_DIR, `Novda_Hisob_${excelName}`));
        return {
          filename,
          excelFilename: `Novda_Hisob_${excelName}`,
          hasExcel,
          period: data.period,
          archivedAt: data.archivedAt,
          workersCount: (data.workers || []).length
        };
      });
      res.json({ success: true, archives: list });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/log-transaction', async (req, res) => {
    try {
      const entry = req.body;
      const logLine = `[${new Date().toISOString()}] Transaction: ${JSON.stringify(entry)}\n`;
      await fs.promises.appendFile(LOG_FILE, logLine, 'utf-8');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/archive-period', async (req, res) => {
    try {
      const archiveData = req.body;
      if (!archiveData) return res.status(400).json({ error: 'No data provided' });
      const filename = archiveData.period?.archiveFilename || `archive_${Date.now()}.json`;
      const target = path.join(ARCHIVES_DIR, filename);
      await fs.promises.writeFile(target, JSON.stringify(archiveData, null, 2), 'utf-8');
      res.json({ success: true, filename });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/backups', (req, res) => {
    try {
      const bFiles = fs.existsSync(BACKUPS_DIR)
        ? fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json')).map((f) => ({ filename: f, dir: BACKUPS_DIR, isArchive: false }))
        : [];
      const aFiles = fs.existsSync(ARCHIVES_DIR)
        ? fs.readdirSync(ARCHIVES_DIR).filter((f) => f.endsWith('.json')).map((f) => ({ filename: f, dir: ARCHIVES_DIR, isArchive: true }))
        : [];
      const all = [...aFiles, ...bFiles];
      const backups = all.map((item) => {
        try {
          const fullPath = path.join(item.dir, item.filename);
          const stat = fs.statSync(fullPath);
          const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          return {
            filename: item.filename,
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
            isArchive: item.isArchive,
            workersCount: (raw.workers || []).length,
            modelsCount: (raw.models || []).length
          };
        } catch {
          return { filename: item.filename, size: 0, createdAt: '', isArchive: item.isArchive, workersCount: 0, modelsCount: 0 };
        }
      }).sort((a, b) => (b.filename > a.filename ? 1 : -1));
      res.json({ success: true, backups });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/restore-backup', async (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) return res.status(400).json({ error: 'Filename is required' });
      let filepath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(filepath)) {
        filepath = path.join(ARCHIVES_DIR, filename);
      }
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ success: false, error: 'Zaxira fayli topilmadi' });
      }
      const raw = await fs.promises.readFile(filepath, 'utf-8');
      const data = JSON.parse(raw);
      await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/download-archive/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      const target = path.join(ARCHIVES_DIR, filename);
      if (!fs.existsSync(target)) {
        return res.status(404).send('Arxiv fayli topilmadi');
      }
      res.download(target, filename);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Serve Frontend Bundle
  if (distDir && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(distDir, 'index.html'));
      } else {
        next();
      }
    });
  }

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[Novda Server] Running on http://127.0.0.1:${PORT}`);
  });

  return server;
}

module.exports = { setupServer };
