import React, { useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { SheetTabs } from './components/SheetTabs';
import { PattaView } from './components/PattaView';
import { PattaBatchView } from './components/PattaBatchView';
import { HisobView } from './components/HisobView';
import { UmumiyView } from './components/UmumiyView';

// Phase 6: Code Splitting for heavy views & modals
const PattaHisobView = React.lazy(() => import('./components/PattaHisobView').then(m => ({ default: m.PattaHisobView })));
const KonveyerView = React.lazy(() => import('./components/KonveyerView').then(m => ({ default: m.KonveyerView })));

import { NewOperationModal } from './components/modals/NewOperationModal';
import { DeleteOperationModal } from './components/modals/DeleteOperationModal';
import { NewModelModal } from './components/modals/NewModelModal';
import { LicenseActivationModal } from './components/modals/LicenseActivationModal';

const WorkerManagerModal = React.lazy(() => import('./components/modals/WorkerManagerModal').then(m => ({ default: m.WorkerManagerModal })));
const WorkerDetailModal = React.lazy(() => import('./components/modals/WorkerDetailModal').then(m => ({ default: m.WorkerDetailModal })));
const BackupManagerModal = React.lazy(() => import('./components/modals/BackupManagerModal').then(m => ({ default: m.BackupManagerModal })));
const PeriodManagerModal = React.lazy(() => import('./components/modals/PeriodManagerModal').then(m => ({ default: m.PeriodManagerModal })));
const DeveloperModal = React.lazy(() => import('./components/modals/DeveloperModal').then(m => ({ default: m.DeveloperModal })));
const AppUpdateModal = React.lazy(() => import('./components/modals/AppUpdateModal').then(m => ({ default: m.AppUpdateModal })));

import { NotificationToast } from './components/NotificationToast';
import { LoadingOverlay } from './components/LoadingOverlay';
import { useWorkbookStore } from './store/workbookStore';
import { PermissionGuard } from './components/PermissionGuard';
import { AccessDenied } from './components/AccessDenied';
import { SYSTEM_SHEET_NAMES } from './constants/sheetConstants';
import { subscribeToAppUpdates } from './services/updateService';

export const App: React.FC = () => {
  const activeSheet = useWorkbookStore((s) => s.activeSheet);
  const models = useWorkbookStore((s) => s.models);
  const setActiveSheet = useWorkbookStore((s) => s.setActiveSheet);
  const jonatish = useWorkbookStore((s) => s.jonatish);
  const addNotification = useWorkbookStore((s) => s.addNotification);
  const initStore = useWorkbookStore((s) => s.initStore);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__store = useWorkbookStore;
      (window as any).__workbookStoreRef = useWorkbookStore;
    }
    initStore();
  }, [initStore]);

  // Periodic license check (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      useWorkbookStore.getState().checkLicense();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Real-time app updates subscription (Firebase RTDB)
  useEffect(() => {
    const unsub = subscribeToAppUpdates();
    return () => {
      unsub();
    };
  }, []);

  // Keyboard Shortcuts (Ctrl+S, F5, Ctrl+PageUp/Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        useWorkbookStore.getState().saveToDisk(undefined, { forceBackup: true });
        addNotification('success', 'Saqlandi', 'Barcha ma\'lumotlar muvaffaqiyatli saqlandi!');
      }

      // F5 to trigger Jonatish if on patta sheet
      if (e.key === 'F5') {
        e.preventDefault();
        if (!activeSheet.endsWith('-hisob') && activeSheet !== 'Umumiy') {
          jonatish(activeSheet);
        }
      }

      // Ctrl + PageDown -> Next sheet
      const currentSheets = [...SYSTEM_SHEET_NAMES, ...models.flatMap((m) => [m.name, m.hisobSheetName])];
      if ((e.ctrlKey || e.metaKey) && e.key === 'PageDown') {
        e.preventDefault();
        const currentIdx = currentSheets.indexOf(activeSheet as any);
        if (currentIdx >= 0 && currentIdx < currentSheets.length - 1) {
          setActiveSheet(currentSheets[currentIdx + 1]);
        }
      }

      // Ctrl + PageUp -> Previous sheet
      if ((e.ctrlKey || e.metaKey) && e.key === 'PageUp') {
        e.preventDefault();
        const currentIdx = currentSheets.indexOf(activeSheet as any);
        if (currentIdx > 0) {
          setActiveSheet(currentSheets[currentIdx - 1]);
        }
      }

      // Escape -> Close active modal
      if (e.key === 'Escape') {
        const state = useWorkbookStore.getState();
        if (state.modalState.type) {
          e.preventDefault();
          state.closeModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSheet, jonatish, setActiveSheet, addNotification]);

  // Determine current view with RBAC Permission Guarding
  const renderActiveSheetView = () => {
    if (activeSheet === 'Umumiy') {
      return (
        <PermissionGuard
          permission="view:umumiy"
          fallback={
            <AccessDenied
              requiredPermission="view:umumiy"
              message="Umumiy oylik hisobotni ko'rish faqat Admin va Ma'lumot kirituvchi (Type) roli uchun ruxsat etilgan."
            />
          }
        >
          <UmumiyView />
        </PermissionGuard>
      );
    }

    if (activeSheet === 'Patta') {
      return (
        <PermissionGuard
          permission="view:patta"
          fallback={
            <AccessDenied
              requiredPermission="view:patta"
              message="Pattalar ro'yxatini ko'rish uchun sizning rolingizda ruxsat yo'q."
            />
          }
        >
          <PattaBatchView />
        </PermissionGuard>
      );
    }

    if (activeSheet === 'Patta-hisob') {
      return (
        <PermissionGuard
          permission="view:patta-hisob"
          fallback={
            <AccessDenied
              requiredPermission="view:patta-hisob"
              message="Patta hisobotini ko'rish uchun sizning rolingizda ruxsat yo'q."
            />
          }
        >
          <PattaHisobView />
        </PermissionGuard>
      );
    }

    if (activeSheet === 'Konveyer' || activeSheet === 'Конвейер') {
      return (
        <PermissionGuard
          permission="edit:hisob"
          fallback={
            <AccessDenied
              requiredPermission="edit:hisob"
              message="Konveyer varag'ini ko'rish va tahrirlash faqat Admin va Ma'lumot kirituvchi (Type) roli uchun ruxsat etilgan."
            />
          }
        >
          <KonveyerView />
        </PermissionGuard>
      );
    }

    if (activeSheet.endsWith('-hisob')) {
      const modelId = activeSheet.replace('-hisob', '');
      const model = models.find((m) => m.id === modelId) || models[0];
      if (!model) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
            <p className="text-lg font-medium mb-1">Hech qanday model mavjud emas</p>
            <p className="text-sm opacity-75">Iltimos, pastki menyudan yangi model qo'shing yoki "Patta-Hisob" varaqasiga o'ting.</p>
          </div>
        );
      }
      return (
        <PermissionGuard
          permission="edit:hisob"
          fallback={
            <AccessDenied
              requiredPermission="edit:hisob"
              message="Model hisob-kitobini ko'rish va kiritish faqat Admin va Ma'lumot kirituvchi (Type) roli uchun ruxsat etilgan."
            />
          }
        >
          <HisobView key={model.id} model={model} />
        </PermissionGuard>
      );
    }

    const model = models.find((m) => m.id === activeSheet) || models[0];
    if (!model) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
          <p className="text-lg font-medium mb-1">Hech qanday model mavjud emas</p>
          <p className="text-sm opacity-75">Iltimos, pastki menyudan yangi model qo'shing yoki "Patta-Hisob" varaqasiga o'ting.</p>
        </div>
      );
    }
    return (
      <PermissionGuard
        permission="view:patta"
        fallback={
          <AccessDenied
            requiredPermission="view:patta"
            message="Patta varaqasini ko'rish uchun sizning rolingizda ruxsat yo'q."
          />
        }
      >
        <PattaView key={model.id} model={model} />
      </PermissionGuard>
    );
  };

  const modalType = useWorkbookStore((s) => s.modalState.type);

  return (
    <div className="excel-app">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Active Sheet Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <React.Suspense
          fallback={
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px', gap: '8px' }}>
              <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '18px' }} />
              Yuklanmoqda...
            </div>
          }
        >
          {renderActiveSheetView()}
        </React.Suspense>
      </div>

      {/* Sheet Tabs */}
      <SheetTabs />

      {/* Modals & Toasts & Loading Overlay */}
      <LicenseActivationModal />
      <React.Suspense fallback={null}>
        {modalType === 'developer_info' && <DeveloperModal />}
        {modalType === 'period_manager' && <PeriodManagerModal />}
        {modalType === 'new_model' && <NewModelModal />}
        {modalType === 'new_operation' && <NewOperationModal />}
        {modalType === 'delete_operation' && <DeleteOperationModal />}
        {modalType === 'worker_manager' && <WorkerManagerModal />}
        {modalType === 'worker_detail' && <WorkerDetailModal />}
        {modalType === 'backup_manager' && <BackupManagerModal />}
        {modalType === 'app_update' && <AppUpdateModal />}
      </React.Suspense>
      <NotificationToast />
      <LoadingOverlay />
    </div>
  );
};

export default App;
