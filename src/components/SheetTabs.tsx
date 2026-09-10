import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  FileSpreadsheet,
  Layers,
  Plus,
  Search,
  MoreVertical,
  Edit3,
  Copy,
  Trash2,
  X
} from 'lucide-react';
import { useWorkbookStore } from '../store/workbookStore';
import { SYSTEM_SHEET_NAMES } from '../constants/sheetConstants';
import { ModelConfig } from '../types/workbook';

interface ContextMenuState {
  x: number;
  y: number;
  sheetName: string;
}

export const SheetTabs: React.FC = () => {
  const activeSheet = useWorkbookStore((s) => s.activeSheet);
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);
  const models = useWorkbookStore((s) => s.models);
  const openModal = useWorkbookStore((s) => s.openModal);
  const deleteModel = useWorkbookStore((s) => s.deleteModel);
  const renameModel = useWorkbookStore((s) => s.renameModel);
  const addModel = useWorkbookStore((s) => s.addModel);
  const addNotification = useWorkbookStore((s) => s.addNotification);

  const [searchFilter, setSearchFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // In-app modal states (replaces window.prompt and window.confirm which fail in Electron)
  const [renameTargetModel, setRenameTargetModel] = useState<ModelConfig | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTargetModel, setDeleteTargetModel] = useState<ModelConfig | null>(null);

  // Close context menu on outside click or ESC
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('contextmenu', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('contextmenu', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getTargetModel = (name: string) => {
    return models.find((m) => m.name === name || m.hisobSheetName === name);
  };

  const isSystemSheet = (name: string) => {
    return (SYSTEM_SHEET_NAMES as readonly string[]).includes(name);
  };

  const handleTabContextMenu = useCallback((e: React.MouseEvent, name: string) => {
    e.preventDefault();
    e.stopPropagation();

    const xPos = Math.max(10, Math.min(e.clientX, window.innerWidth - 240));
    const yPos = Math.max(10, Math.min(e.clientY, window.innerHeight - 260));
    setContextMenu({
      x: xPos,
      y: yPos,
      sheetName: name
    });
  }, []);

  // Context Menu Actions
  const handleOpenSheet = () => {
    if (contextMenu) {
      setActiveSheet(contextMenu.sheetName);
      setContextMenu(null);
    }
  };

  const handleDeleteSheet = () => {
    if (!contextMenu) return;
    const model = getTargetModel(contextMenu.sheetName);
    if (!model) {
      addNotification('warning', 'Ogohlantirish', 'Tizimning asosiy varag\'ini o\'chirib bo\'lmaydi.');
      setContextMenu(null);
      return;
    }

    if (models.length <= 1) {
      addNotification('error', 'Xatolik', 'Oxirgi modelni o\'chirib bo\'lmaydi.');
      setContextMenu(null);
      return;
    }

    setDeleteTargetModel(model);
    setContextMenu(null);
  };

  const confirmDeleteModel = () => {
    if (deleteTargetModel) {
      deleteModel(deleteTargetModel.id);
      setDeleteTargetModel(null);
    }
  };

  const handleRenameSheet = () => {
    if (!contextMenu) return;
    const model = getTargetModel(contextMenu.sheetName);
    if (!model) {
      addNotification('info', 'Ma\'lumot', 'Faqat modellar nomini o\'zgartirish mumkin.');
      setContextMenu(null);
      return;
    }

    setRenameValue(model.name);
    setRenameTargetModel(model);
    setContextMenu(null);
  };

  const submitRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTargetModel) return;
    const clean = renameValue.trim();
    if (!clean) {
      addNotification('warning', 'Ogohlantirish', 'Model nomi bo\'sh bo\'lishi mumkin emas.');
      return;
    }
    if (clean !== renameTargetModel.name) {
      renameModel(renameTargetModel.id, clean);
    }
    setRenameTargetModel(null);
  };

  const handleDuplicateModel = () => {
    if (!contextMenu) return;
    const model = getTargetModel(contextMenu.sheetName);
    if (!model) {
      openModal({ type: 'new_model' });
      setContextMenu(null);
      return;
    }

    const cloneName = `${model.name}_Nusxa`;
    addModel(cloneName, {
      templateType: 'clone',
      cloneFromId: model.id,
      title: `Модел- ${cloneName}`,
      party: model.party || '',
      color: model.color || 'Кора',
      size: model.size || 'XL'
    });
    setContextMenu(null);
  };

  // Filtered models list
  const filteredModels = models.filter((m) =>
    !searchFilter.trim() ||
    m.name.toLowerCase().includes(searchFilter.toLowerCase().trim()) ||
    m.hisobSheetName.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <aside
      className="excel-sidebar"
      onContextMenu={(e) => handleTabContextMenu(e, activeSheet)}
    >
      {/* 1. Header: Section title + Add model button */}
      <div className="excel-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutDashboard size={16} color="var(--primary)" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
            Varaqlar
          </span>
        </div>
        <button
          onClick={() => openModal({ type: 'new_model' })}
          className="soft-btn soft-btn-primary"
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Yangi model qo'shish (+)"
        >
          <Plus size={12} />
          <span>Model</span>
        </button>
      </div>

      {/* 2. Quick Search (visible if 3+ models) */}
      {models.length >= 3 && (
        <div style={{ padding: '6px 8px 2px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '8px', top: '7px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Model qidirish..."
              className="soft-input"
              style={{
                height: '26px',
                paddingLeft: '26px',
                paddingRight: searchFilter ? '22px' : '8px',
                fontSize: '11.5px',
                borderRadius: 'var(--radius-sm)',
                width: '100%'
              }}
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 0
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Navigation Content Area */}
      <div className="excel-sidebar-content">
        {/* Section: Asosiy Varaqlar */}
        <div className="excel-sidebar-section-title">
          <span>Asosiy</span>
        </div>

        <button
          className={`excel-sidebar-item ${activeSheet === 'Umumiy' ? 'active' : ''}`}
          onClick={() => setActiveSheet('Umumiy')}
          onContextMenu={(e) => handleTabContextMenu(e, 'Umumiy')}
          title="Umumiy oylik hisobot va ishchilar maoshi"
        >
          <Wallet size={15} color={activeSheet === 'Umumiy' ? 'var(--primary)' : '#10b981'} />
          <span style={{ flex: 1, fontWeight: activeSheet === 'Umumiy' ? 700 : 500 }}>
            Umumiy Hisobot
          </span>
        </button>

        <button
          className={`excel-sidebar-item ${activeSheet === 'Patta' ? 'active' : ''}`}
          onClick={() => setActiveSheet('Patta')}
          onContextMenu={(e) => handleTabContextMenu(e, 'Patta')}
          title="Pattalar chop etish va partiyalarni boshqarish"
        >
          <FileText size={15} color={activeSheet === 'Patta' ? 'var(--primary)' : '#f59e0b'} />
          <span style={{ flex: 1, fontWeight: activeSheet === 'Patta' ? 700 : 500 }}>
            Patta (Chiqarish)
          </span>
        </button>

        <button
          className={`excel-sidebar-item ${activeSheet === 'Patta-hisob' ? 'active' : ''}`}
          onClick={() => setActiveSheet('Patta-hisob')}
          onContextMenu={(e) => handleTabContextMenu(e, 'Patta-hisob')}
          title="Topshirilgan pattalar jurnali va arxivi"
        >
          <FileSpreadsheet size={15} color={activeSheet === 'Patta-hisob' ? 'var(--primary)' : '#06b6d4'} />
          <span style={{ flex: 1, fontWeight: activeSheet === 'Patta-hisob' ? 700 : 500 }}>
            Patta-Hisob (Jurnal)
          </span>
        </button>

        <button
          className={`excel-sidebar-item ${activeSheet === 'Konveyer' || activeSheet === 'Конвейер' ? 'active' : ''}`}
          onClick={() => setActiveSheet('Konveyer')}
          onContextMenu={(e) => handleTabContextMenu(e, 'Konveyer')}
          title="Konveyer operatsiyalari va taqsimoti"
        >
          <Layers size={15} color={activeSheet === 'Konveyer' || activeSheet === 'Конвейер' ? 'var(--primary)' : '#8b5cf6'} />
          <span style={{ flex: 1, fontWeight: activeSheet === 'Konveyer' || activeSheet === 'Конвейер' ? 700 : 500 }}>
            Konveyer
          </span>
        </button>

        {/* Section: Modellar */}
        <div className="excel-sidebar-section-title" style={{ marginTop: '8px' }}>
          <span>Modellar ({models.length})</span>
        </div>

        {filteredModels.map((m) => {
          const isPattaActive = activeSheet === m.name;
          const isHisobActive = activeSheet === m.hisobSheetName;

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                marginBottom: '4px',
                background: (isPattaActive || isHisobActive) ? 'var(--bg-surface-subtle)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 0'
              }}
            >
              {/* Model Patta Item (Primary) */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <button
                  className={`excel-sidebar-item ${isPattaActive ? 'active' : ''}`}
                  onClick={() => setActiveSheet(m.name)}
                  onContextMenu={(e) => handleTabContextMenu(e, m.name)}
                  title={`${m.name} — Patta kiritish varag'i (O'ng tugma: amallar)`}
                  style={{ flex: 1 }}
                >
                  <FileText size={14} color={isPattaActive ? 'var(--primary)' : '#0284c7'} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </span>
                </button>

                {/* 3-dots Context Menu button */}
                <button
                  type="button"
                  onClick={(e) => handleTabContextMenu(e, m.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '28px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    borderRadius: 'var(--radius-sm)'
                  }}
                  title="Model amallari (nomini o'zgartirish, o'chirish...)"
                >
                  <MoreVertical size={13} />
                </button>
              </div>

              {/* Model Hisob Item (Indented) */}
              <button
                className={`excel-sidebar-item ${isHisobActive ? 'active' : ''}`}
                onClick={() => setActiveSheet(m.hisobSheetName)}
                onContextMenu={(e) => handleTabContextMenu(e, m.hisobSheetName)}
                title={`${m.hisobSheetName} — Model hisob-kitob varag'i`}
                style={{
                  paddingLeft: '26px',
                  fontSize: '11.5px',
                  color: isHisobActive ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                <FileSpreadsheet size={13} color={isHisobActive ? 'var(--primary)' : '#6366f1'} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}-hisob
                </span>
              </button>
            </div>
          );
        })}

        {filteredModels.length === 0 && (
          <div style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Model topilmadi
          </div>
        )}
      </div>

      {/* 4. Footer Status Info */}
      <div className="excel-sidebar-footer">
        <span>Jami: {models.length} ta model</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          Tayyor
        </span>
      </div>

      {/* Modern Context Menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 9999,
            minWidth: '210px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'menuSlideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header pill indicator */}
          <div style={{
            padding: '6px 10px 8px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              Varaq: {contextMenu.sheetName}
            </span>
            <span style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: 'var(--radius-full)',
              background: isSystemSheet(contextMenu.sheetName) ? 'var(--bg-surface-subtle)' : 'var(--primary-light)',
              color: isSystemSheet(contextMenu.sheetName) ? 'var(--text-secondary)' : 'var(--primary)'
            }}>
              {isSystemSheet(contextMenu.sheetName) ? 'Tizim' : 'Model'}
            </span>
          </div>

          {/* 1. Open Sheet */}
          <button
            onClick={handleOpenSheet}
            className="context-menu-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-subtle)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <FileSpreadsheet size={14} color="var(--primary)" />
            <span>Varaqni ochish</span>
          </button>

          {/* 2. Add New Model */}
          <button
            onClick={() => {
              openModal({ type: 'new_model' });
              setContextMenu(null);
            }}
            className="context-menu-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-subtle)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Plus size={14} color="var(--status-teal)" />
            <span>Yangi model qo'shish</span>
          </button>

          {/* 3. Rename Model (Model sheets only) */}
          {!isSystemSheet(contextMenu.sheetName) && (
            <button
              onClick={handleRenameSheet}
              className="context-menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Edit3 size={14} color="var(--accent-indigo)" />
              <span>Nomini o'zgartirish...</span>
            </button>
          )}

          {/* 4. Duplicate/Clone Model (Model sheets only) */}
          {!isSystemSheet(contextMenu.sheetName) && (
            <button
              onClick={handleDuplicateModel}
              className="context-menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Copy size={14} color="var(--status-purple)" />
              <span>Nusxa olish (Klonlash)</span>
            </button>
          )}

          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

          {/* 5. Delete Action */}
          {!isSystemSheet(contextMenu.sheetName) ? (
            <button
              onClick={handleDeleteSheet}
              className="context-menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#ef4444',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Trash2 size={14} color="#ef4444" />
              <span>Modelni o'chirish (Delete)</span>
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 10px',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                fontStyle: 'italic',
                cursor: 'not-allowed',
                userSelect: 'none'
              }}
              title="Umumiy, Patta va Konveyer tizimning asosiy varaqlari hisoblanadi"
            >
              <Trash2 size={13} color="var(--text-muted)" />
              <span>O'chirib bo'lmaydi (Tizim)</span>
            </div>
          )}
        </div>
      )}

      {/* Modern In-App Rename Modal (100% compatible with Windows/Electron) */}
      {renameTargetModel && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9999 }}
          onClick={() => setRenameTargetModel(null)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: '440px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Edit3 size={18} />
                <span style={{ fontSize: '15px', fontWeight: 800 }}>Model nomini o'zgartirish</span>
              </div>
              <button
                type="button"
                onClick={() => setRenameTargetModel(null)}
                className="soft-btn soft-btn-secondary"
                style={{ width: '28px', height: '28px', padding: 0, borderRadius: 'var(--radius-full)' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={submitRename}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    «{renameTargetModel.name}» uchun yangi nom:
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenameTargetModel(null);
                    }}
                    className="soft-input"
                    style={{ width: '100%', height: '36px', fontSize: '14px', fontWeight: 600 }}
                    placeholder="Yangi nom..."
                  />
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Eslatma: Modelga tegishli barcha varaqlar (<strong>{renameValue || '...'}</strong> va <strong>{renameValue || '...'}-hisob</strong>) hamda hisob-kitoblar avtomatik yangilanadi.
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px' }}>
                <button
                  type="button"
                  onClick={() => setRenameTargetModel(null)}
                  className="soft-btn soft-btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim()}
                  className="soft-btn soft-btn-primary"
                  style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern In-App Delete Confirmation Modal */}
      {deleteTargetModel && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9999 }}
          onClick={() => setDeleteTargetModel(null)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: '460px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <Trash2 size={18} />
                <span style={{ fontSize: '15px', fontWeight: 800 }}>Modelni o'chirish</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetModel(null)}
                className="soft-btn soft-btn-secondary"
                style={{ width: '28px', height: '28px', padding: 0, borderRadius: 'var(--radius-full)' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                Haqiqatan ham <strong>«{deleteTargetModel.name}»</strong> modelini, uning barcha tegishli varaqlari (<strong>{deleteTargetModel.name}</strong> va <strong>{deleteTargetModel.hisobSheetName}</strong>) hamda hisob-kitoblarini butunlay o'chirmoqchimisiz?
              </div>
              <div style={{ fontSize: '11.5px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                Ogohlantirish: Ushbu amalni ortga qaytarib bo'lmaydi!
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px' }}>
              <button
                type="button"
                onClick={() => setDeleteTargetModel(null)}
                className="soft-btn soft-btn-secondary"
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={confirmDeleteModel}
                className="soft-btn"
                style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 700, background: '#ef4444', color: '#fff' }}
              >
                Ha, o'chirilsin
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
