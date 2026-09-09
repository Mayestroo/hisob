import React, { useState, useEffect } from 'react';
import { useWorkbookStore } from '../../store/workbookStore';
import { X, Database, RotateCcw, Clock, Star, ShieldCheck, Cloud, CloudDownload } from 'lucide-react';

interface BackupItem {
  filename: string;
  size: number;
  createdAt: string;
  isArchive?: boolean;
  filledOpsCount?: number;
  workersCount?: number;
  modelsCount?: number;
}

export const BackupManagerModal: React.FC = () => {
  const modalType = useWorkbookStore((s) => s.modalState.type);
  const closeModal = useWorkbookStore((s) => s.closeModal);
  const addNotification = useWorkbookStore((s) => s.addNotification);
  const initStore = useWorkbookStore((s) => s.initStore);
  const setLoadingMessage = useWorkbookStore((s) => s.setLoadingMessage);
  const licenseStatus = useWorkbookStore((s) => s.licenseStatus);
  const restoreFromCloud = useWorkbookStore((s) => s.restoreFromCloud);

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudRestoring, setIsCloudRestoring] = useState(false);

  const activeCompanyId = licenseStatus?.companyId;
  const activeCompanyName = licenseStatus?.companyName || activeCompanyId || 'Biriktirilmagan';

  useEffect(() => {
    if (modalType === 'backup_manager') {
      fetchBackups();
    }
  }, [modalType]);

  const handleCloudRestore = async () => {
    if (!activeCompanyId || activeCompanyId === 'unassigned') {
      addNotification('warning', 'Korxona yo\'q', 'Ushbu kompyuterga hali korxona biriktirilmagan!');
      return;
    }

    if (
      !window.confirm(
        `Haqiqatan ham [${activeCompanyName}] korxonasi bulutidan ma'lumotlarni tiklamoqchimisiz?\n\nLokal bazadagi barcha modellar, pattalar va partiyalar o'sha korxonaning bulutidagi so'nggi holati bilan yangilanadi.`
      )
    ) {
      return;
    }

    setIsCloudRestoring(true);
    closeModal();
    try {
      await restoreFromCloud(activeCompanyId);
    } finally {
      setIsCloudRestoring(false);
    }
  };

  const fetchBackups = async () => {
    setIsLoading(true);
    const eAPI = (window as any).electronAPI;

    if (eAPI && eAPI.backupsList) {
      try {
        const res = await eAPI.backupsList();
        if (res.success && res.backups) {
          setBackups(res.backups);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('IPC backups-list failed', err);
      }
    }

    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`Haqiqatan ham ushbu zaxira nusxasini tiklamoqchimisiz?\n\nJoriy o'zgarishlar ushbu zaxiradagi holatga qaytariladi.`)) return;
    
    setLoadingMessage("Zaxira nusxasi tiklanmoqda...");
    closeModal();

    try {
      const eAPI = (window as any).electronAPI;

      if (eAPI && eAPI.backupRestore) {
        const res = await eAPI.backupRestore(filename);
        if (res.success) {
          await initStore();
          addNotification('success', 'Tiklandi', `Zaxira nusxasi muvaffaqiyatli tiklandi!`);
          return;
        } else {
          addNotification('error', 'Xatolik', res.error || 'Tiklashda xatolik yuz berdi');
          return;
        }
      }

      const res = await fetch('/api/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        await initStore();
        addNotification('success', 'Tiklandi', `Zaxira nusxasi muvaffaqiyatli tiklandi!`);
      } else {
        addNotification('error', 'Xatolik', 'Tiklashda xatolik yuz berdi.');
      }
    } catch (err: any) {
      addNotification('error', 'Xatolik', err.message || 'Tiklashda xatolik yuz berdi');
    } finally {
      setTimeout(() => {
        setLoadingMessage(null);
      }, 400);
    }
  };

  const formatDisplayTime = (b: BackupItem) => {
    const matchLocal = b.filename.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (matchLocal) {
      const [, y, m, d, hh, mm, ss] = matchLocal;
      return `${d}.${m}.${y}, ${hh}:${mm}:${ss}`;
    }

    const matchIso = b.filename.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (matchIso) {
      const [, y, m, d, hh, mm, ss] = matchIso;
      const utcDate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
      return utcDate.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    if (b.createdAt) {
      try {
        return new Date(b.createdAt).toLocaleString('ru-RU');
      } catch {}
    }
    return b.filename;
  };

  if (modalType !== 'backup_manager') return null;

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <Database size={20} />
            <span style={{ fontWeight: 800 }}>Doimiy Zaxiralar & Baza Tarixi</span>
          </div>
          <button
            onClick={closeModal}
            className="soft-btn soft-btn-secondary"
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: 'var(--radius-full)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
            background: 'var(--primary-light)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
              <ShieldCheck size={16} />
              <span>Avtomatik xavfsizlik himoyasi:</span>
            </div>
            <div>Har bir asosiy amal (jonatish, qaytarish, yangi operatsiya) da to'liq zaxira saqlanadi.</div>
            <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
              Istalgan zaxira yonidagi <strong>"Tiklash"</strong> tugmasini bosib, o'sha paytdagi ma'lumotlarni qaytarib olishingiz mumkin.
            </div>
          </div>

          {/* Cloud Disaster Recovery Card */}
          <div
            style={{
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
              background: 'rgba(59, 130, 246, 0.07)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#2563eb', marginBottom: '3px' }}>
                <Cloud size={16} />
                <span>Bulutdan Tiklash (Avariyaviy Tiklash):</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                Biriktirilgan korxona: <strong style={{ color: '#2563eb' }}>{activeCompanyName}</strong> {activeCompanyId ? `(${activeCompanyId})` : ''}
              </div>
              <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                Agar kompyuter bazasi o'chib ketgan bo'lsa, faqatgina ushbu korxonaning barcha modellar va pattalarini Firebase bulutidan qayta tiklang.
              </div>
            </div>

            <button
              onClick={handleCloudRestore}
              disabled={!activeCompanyId || activeCompanyId === 'unassigned' || isCloudRestoring}
              className="soft-btn"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                borderRadius: 'var(--radius-full)',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
              title="Faqat ushbu korxona bulutidagi bazani tiklash"
            >
              <CloudDownload size={15} />
              <span>Bulutdan Tiklash</span>
            </button>
          </div>

          <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Mavjud zaxiralar ({backups.length} ta):</span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-muted)' }}>
              Toshkent vaqti bilan
            </span>
          </div>

          <div style={{
            maxHeight: '380px',
            overflowY: 'auto',
            overflowX: 'hidden',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)'
          }}>
            {isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>
            ) : backups.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Hozircha saqlangan zaxiralar yo'q.
              </div>
            ) : (
              <table className="excel-table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ height: '36px', background: 'var(--bg-surface-subtle)' }}>
                    <th className="col-header" style={{ textAlign: 'left', paddingLeft: '14px' }}>Zaxira vaqti & Turi</th>
                    <th className="col-header" style={{ textAlign: 'center', width: '140px' }}>Ma'lumotlar</th>
                    <th className="col-header" style={{ textAlign: 'center', width: '110px' }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => {
                    const isBeforeReset = b.filename.includes('before_reset');
                    const formattedTime = formatDisplayTime(b);

                    return (
                      <tr
                        key={b.filename}
                        style={{
                          height: '42px',
                          backgroundColor: isBeforeReset ? '#fefce8' : 'var(--bg-surface)'
                        }}
                      >
                        <td style={{ paddingLeft: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isBeforeReset ? (
                              <Star size={16} color="#d97706" fill="#fef3c7" />
                            ) : (
                              <Clock size={15} color="var(--primary)" />
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: isBeforeReset ? '#b45309' : 'var(--text-primary)' }}>
                                {isBeforeReset ? 'Qaytarishdan oldingi zaxira' : 'Avtomatik zaxira'}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                {formattedTime}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {b.workersCount !== undefined ? `${b.workersCount} ta ishchi` : ''}
                          </div>
                          <div style={{ fontSize: '11px', color: (b.filledOpsCount || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                            {(b.filledOpsCount || 0) > 0 ? `${b.filledOpsCount} ta hisob yozuvi` : `${(b.size / 1024).toFixed(1)} KB`}
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleRestore(b.filename)}
                            className={isBeforeReset ? "soft-btn" : "soft-btn soft-btn-secondary"}
                            style={{
                              padding: '4px 12px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11.5px',
                              background: isBeforeReset ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined,
                              color: isBeforeReset ? '#ffffff' : 'var(--primary)'
                            }}
                            title="Ushbu zaxira holatiga qaytarish"
                          >
                            <RotateCcw size={12} />
                            <span>Tiklash</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={closeModal}
            className="soft-btn soft-btn-primary"
            style={{ borderRadius: 'var(--radius-full)', padding: '6px 20px' }}
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
