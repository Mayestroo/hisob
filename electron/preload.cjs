const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbRead: (companyId) => ipcRenderer.invoke('db-read', companyId),
  dbWrite: (data, options) => ipcRenderer.invoke('db-write', data, options),
  dbPatch: (patches, options) => ipcRenderer.invoke('db-patch', patches, options),
  archivesList: (companyId) => ipcRenderer.invoke('archives-list', companyId),
  archivesListMeta: (companyId) => ipcRenderer.invoke('archives-list-meta', companyId),
  archiveSave: (filename, data, companyId) => ipcRenderer.invoke('archive-save', { filename, data, companyId }),
  archiveRead: (filename, companyId) => ipcRenderer.invoke('archive-read', { filename, companyId }),
  backupsList: (companyId) => ipcRenderer.invoke('backups-list', companyId),
  backupRead: (filename, companyId) => ipcRenderer.invoke('backup-read', { filename, companyId }),
  backupRestore: (filename, companyId) => ipcRenderer.invoke('backup-restore', { filename, companyId }),
  getLicenseStatus: () => ipcRenderer.invoke('license-status'),
  activateLicense: (key) => ipcRenderer.invoke('license-activate', key),
  setLicenseCompany: (companyId, companyName) => ipcRenderer.invoke('license-set-company', { companyId, companyName }),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  printHtml: (options) => ipcRenderer.invoke('print-html', options),
  isElectron: true
});
