import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit3, Copy, FileSpreadsheet } from 'lucide-react';
import { useWorkbookStore } from '../store/workbookStore';
import { SYSTEM_SHEET_NAMES } from '../constants/sheetConstants';

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
  const theme = useWorkbookStore((s) => s.theme);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const scrollTabs = (offset: number) => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Close context menu on any outside click or ESC key
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

  // Dynamic sheet list: System sheets, then Model pairs
  const sheetList: string[] = [...SYSTEM_SHEET_NAMES];
  for (const m of models) {
    sheetList.push(m.name);
    sheetList.push(m.hisobSheetName);
  }

  const isDark = theme === 'dark';

  const getSheetColor = (name: string, isActive: boolean) => {
    if (!isActive) return { bg: 'transparent', text: 'var(--text-secondary)', dot: 'var(--text-muted)' };
    
    if (name === 'Umumiy') {
      return { 
        bg: isDark ? 'rgba(52, 211, 153, 0.18)' : '#ecfdf5', 
        text: isDark ? '#34d399' : '#059669', 
        dot: '#10b981' 
      };
    }
    if (name === 'Patta') {
      return { 
        bg: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7', 
        text: isDark ? '#fbbf24' : '#d97706', 
        dot: '#f59e0b' 
      };
    }
    if (name === 'Patta-hisob') {
      return { 
        bg: isDark ? 'rgba(6, 182, 212, 0.18)' : '#ecfeff', 
        text: isDark ? '#38bdf8' : '#0891b2', 
        dot: '#06b6d4' 
      };
    }
    if (name === 'Konveyer') {
      return { 
        bg: isDark ? 'rgba(139, 92, 246, 0.18)' : '#f5f3ff', 
        text: isDark ? '#a78bfa' : '#7c3aed', 
        dot: '#8b5cf6' 
      };
    }
    if (name.endsWith('-hisob')) {
      return { 
        bg: isDark ? 'rgba(99, 102, 241, 0.18)' : '#eef2ff', 
        text: isDark ? '#818cf8' : '#4f46e5', 
        dot: '#6366f1' 
      };
    }
    return { 
      bg: isDark ? 'rgba(56, 189, 248, 0.18)' : '#f0f9ff', 
      text: isDark ? '#38bdf8' : '#0284c7', 
      dot: '#0ea5e9' 
    };
  };

  const handleTabContextMenu = useCallback((e: React.MouseEvent, name: string) => {
    e.preventDefault();
    e.stopPropagation();

    const xPos = Math.max(10, Math.min(e.clientX, window.innerWidth - 230));
    setContextMenu({
      x: xPos,
      y: e.clientY,
      sheetName: name
    });
  }, []);

  const getTargetModel = (name: string) => {
    return models.find((m) => m.name === name || m.hisobSheetName === name);
  };

  const isSystemSheet = (name: string) => {
    return (SYSTEM_SHEET_NAMES as readonly string[]).includes(name);
  };

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

    const confirmDelete = window.confirm(
      `«${model.name}» modelini va uning barcha tegishli varaqlari (${model.name}, ${model.hisobSheetName}) hamda hisob-kitoblarini butunlay o'chirishni tasdiqlaysizmi?`
    );

    if (confirmDelete) {
      deleteModel(model.id);
    }
    setContextMenu(null);
  };

  const handleRenameSheet = () => {
    if (!contextMenu) return;
    const model = getTargetModel(contextMenu.sheetName);
    if (!model) {
      addNotification('info', 'Ma\'lumot', 'Faqat modellar nomini o\'zgartirish mumkin.');
      setContextMenu(null);
      return;
    }

    const newName = window.prompt(`«${model.name}» modelining yangi nomini kiriting:`, model.name);
    if (newName && newName.trim() && newName.trim() !== model.name) {
      renameModel(model.id, newName.trim());
    }
    setContextMenu(null);
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

  return (
    <nav className="excel-bottom-bar" onContextMenu={(e) => handleTabContextMenu(e, activeSheet)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button className="tab-nav-btn" onClick={() => scrollTabs(-150)} title="Chapga siljitish">
          <ChevronLeft size={16} />
        </button>
        <button className="tab-nav-btn" onClick={() => scrollTabs(150)} title="O'ngga siljitish">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="sheet-tabs-container" ref={tabsContainerRef}>
        {sheetList.map((name) => {
          const isActive = activeSheet === name;
          const colors = getSheetColor(name, isActive);

          return (
            <button
              key={name}
              className={`sheet-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSheet(name)}
              onContextMenu={(e) => handleTabContextMenu(e, name)}
              title={`${name} (O'ng tugma: qo'shimcha amallar)`}
              style={{
                backgroundColor: isActive ? colors.bg : undefined,
                color: isActive ? colors.text : undefined
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: colors.dot,
                  flexShrink: 0
                }}
              />
              <span>{name}</span>
            </button>
          );
        })}

        {/* Modern Plus Button inside tabs list */}
        <button
          onClick={() => openModal({ type: 'new_model' })}
          className="sheet-tab"
          style={{
            color: 'var(--primary)',
            fontWeight: 600,
            background: 'var(--primary-light)',
            border: '1px dashed rgba(16, 185, 129, 0.4)'
          }}
          title="Yangi model va varaqlar qo'shish (+)"
        >
          <Plus size={13} />
          <span>Yangi model</span>
        </button>
      </div>

      <div className="status-bar-right">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          Tayyor
        </span>
      </div>

      {/* Modern Excel Right-Click Context Menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            bottom: '42px',
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
            <Plus size={14} color="var(--accent-blue)" />
            <span>Yangi model qo'shish...</span>
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
    </nav>
  );
};
