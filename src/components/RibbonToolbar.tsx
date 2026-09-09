import React, { useState } from 'react';
import { 
  Send, 
  PlusCircle, 
  Trash2, 
  Download, 
  Users, 
  Calculator,
  ArrowRightLeft,
  FileCheck,
  Layers
} from 'lucide-react';
import { useWorkbookStore } from '../store/workbookStore';

export const RibbonToolbar: React.FC = () => {
  const [activeRibbonTab, setActiveRibbonTab] = useState<'home' | 'operations' | 'report'>('home');
  const activeSheet = useWorkbookStore((s) => s.activeSheet);
  const jonatish = useWorkbookStore((s) => s.jonatish);
  const openModal = useWorkbookStore((s) => s.openModal);
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);
  const exportExcel = useWorkbookStore((s) => s.exportExcel);
  const addNotification = useWorkbookStore((s) => s.addNotification);

  const isHisob = activeSheet.endsWith('-hisob');
  const isUmumiy = activeSheet === 'Umumiy';
  const currentModelId = isHisob ? activeSheet.replace('-hisob', '') : activeSheet;

  const handleJonatish = () => {
    if (isUmumiy) {
      addNotification('info', 'Eslatma', 'Patta varag\'iga o\'tib ishchi raqamlarini jo\'nating.');
      return;
    }
    if (isHisob) {
      setActiveSheet(currentModelId);
    }
    jonatish(currentModelId);
  };

  const handleOpenNewOpModal = () => {
    if (isUmumiy) {
      addNotification('info', 'Eslatma', 'Model patta yoki hisob varag\'iga o\'tib operatsiya qo\'shing.');
      return;
    }
    openModal({ type: 'new_operation', modelId: currentModelId });
  };

  const handleOpenDeleteOpModal = () => {
    if (isUmumiy) {
      addNotification('info', 'Eslatma', 'Model patta yoki hisob varag\'iga o\'tib operatsiya o\'chiring.');
      return;
    }
    openModal({ type: 'delete_operation', modelId: currentModelId });
  };

  const handleOpenWorkerManager = () => {
    openModal({ type: 'worker_manager' });
  };

  const toggleHisobPatta = () => {
    if (isUmumiy) {
      setActiveSheet('Basiman');
    } else if (isHisob) {
      setActiveSheet(currentModelId);
    } else {
      setActiveSheet(`${currentModelId}-hisob`);
    }
  };

  return (
    <nav className="excel-ribbon">
      <div className="ribbon-tabs">
        <button 
          className={`ribbon-tab-btn ${activeRibbonTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveRibbonTab('home')}
        >
          Bosh sahifa
        </button>
        <button 
          className={`ribbon-tab-btn ${activeRibbonTab === 'operations' ? 'active' : ''}`}
          onClick={() => setActiveRibbonTab('operations')}
        >
          Operatsiyalar & Ishchilar
        </button>
        <button 
          className={`ribbon-tab-btn ${activeRibbonTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveRibbonTab('report')}
        >
          Hisobot & Eksport
        </button>
      </div>

      <div className="ribbon-content">
        {activeRibbonTab === 'home' && (
          <>
            {/* Group 1: Core Primary Action */}
            <div className="ribbon-group">
              <button 
                className="ribbon-btn primary" 
                onClick={handleJonatish}
                title="Kiritilgan ma'lumotlarni hisob varag'iga jo'natish (VBA Jonatish)"
                style={{ padding: '7px 18px', minWidth: '96px' }}
              >
                <Send size={16} />
                <span>Jo'natish</span>
              </button>
            </div>

            {/* Group 2: Models & Operations */}
            <div className="ribbon-group">
              <button 
                className="ribbon-btn" 
                onClick={() => openModal({ type: 'new_model' })}
                title="Yangi kiyim modeli va hisob varag'i ochish"
              >
                <Layers size={16} color="#0284c7" />
                <span>Yangi model</span>
              </button>
              <button 
                className="ribbon-btn" 
                onClick={handleOpenNewOpModal}
                title="Modelga yangi operatsiya va narx qo'shish"
              >
                <PlusCircle size={16} color="#10b981" />
                <span>Operatsiya (+)</span>
              </button>
              <button 
                className="ribbon-btn" 
                onClick={handleOpenDeleteOpModal}
                title="Model operatsiyasini o'chirish"
              >
                <Trash2 size={16} color="#ef4444" />
                <span>O'chirish</span>
              </button>
            </div>

            {/* Group 3: Switch View */}
            <div className="ribbon-group">
              <button 
                className="ribbon-btn-horizontal" 
                onClick={toggleHisobPatta}
                title={isHisob ? "Patta varag'iga qaytish" : "Hisob-kitob varag'iga o'tish"}
              >
                <ArrowRightLeft size={14} color="#6366f1" />
                <span>{isHisob ? "Pattaga o'tish" : "Hisobga o'tish"}</span>
              </button>
              <button 
                className="ribbon-btn-horizontal" 
                onClick={() => setActiveSheet('Umumiy')}
                title="Umumiy oylik hisobot varag'iga o'tish"
              >
                <Calculator size={14} color="#059669" />
                <span>Umumiy</span>
              </button>
            </div>

            {/* Group 4: Workers */}
            <div className="ribbon-group">
              <button 
                className="ribbon-btn-horizontal" 
                onClick={handleOpenWorkerManager}
                title="Ishchilar ro'yxatini ko'rish va yangi ishchi qo'shish"
              >
                <Users size={14} color="#0ea5e9" />
                <span>Ishchilar & Staj</span>
              </button>
            </div>
          </>
        )}

        {activeRibbonTab === 'operations' && (
          <>
            <div className="ribbon-group">
              <button className="ribbon-btn primary" onClick={handleOpenNewOpModal}>
                <PlusCircle size={16} />
                <span>Operatsiya qo'shish</span>
              </button>
              <button className="ribbon-btn" onClick={handleOpenDeleteOpModal}>
                <Trash2 size={16} color="#ef4444" />
                <span>Operatsiyani o'chirish</span>
              </button>
            </div>
            <div className="ribbon-group">
              <button className="ribbon-btn-horizontal" onClick={handleOpenWorkerManager}>
                <Users size={14} color="#0284c7" />
                <span>Markaziy ishchilar ro'yxati</span>
              </button>
            </div>
          </>
        )}

        {activeRibbonTab === 'report' && (
          <>
            <div className="ribbon-group">
              <button className="ribbon-btn primary" onClick={exportExcel}>
                <Download size={16} />
                <span>Excel (.xlsx) yuklab olish</span>
              </button>
              <button className="ribbon-btn" onClick={() => setActiveSheet('Umumiy')}>
                <FileCheck size={16} color="#059669" />
                <span>Bosh hisobot</span>
              </button>
            </div>
            <div className="ribbon-group">
              <button 
                className="ribbon-btn-horizontal" 
                onClick={() => openModal({ type: 'backup_manager' })}
                title="Barcha saqlangan zaxira nusxalarini ko'rish"
              >
                <FileCheck size={14} color="#10b981" />
                <span>Baza Zaxiralari</span>
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};
