/**
 * Real-time Device Remote Control Service
 * Handles instant remote role switching (Admin / Type / Print), blocking, and unblocking
 */

import { ref, onValue, get } from 'firebase/database';
import { getFirebaseDB, IS_FIREBASE_CONFIGURED } from '../config/firebase';
import { useWorkbookStore } from '../store/workbookStore';
import { useAuthStore, applyRolePermissions } from '../store/authStore';

let activeUnsubscribe: (() => void) | null = null;
let lastHandledKey: string | null = null;
let lastHandledRole: string | null = null;
let lastHandledCompanyId: string | null = null;
let lastHandledRequireValidation: boolean | null = null;
let isProcessingRemote = false;

export function initDeviceRemoteListener(machineId: string): () => void {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  const db = getFirebaseDB();
  if (!IS_FIREBASE_CONFIGURED || !db || !machineId) {
    return () => {};
  }

  const deviceRef = ref(db, `devices/${machineId}`);
  activeUnsubscribe = onValue(deviceRef, async (snapshot) => {
    const data = snapshot.val();
    if (!data || isProcessingRemote) return;

    const eAPI = (window as any).electronAPI;

    // 1. Instant Remote Block
    if (data.isBlocked === true) {
      console.warn('[RemoteControl] Qurilma masofadan bloklandi!');
      useWorkbookStore.setState((s) => ({
        licenseStatus: s.licenseStatus
          ? {
              ...s.licenseStatus,
              isBlocked: true,
              message: data.blockReason || 'Administrator tomonidan bloklandi'
            }
          : s.licenseStatus
      }));
      useAuthStore.getState().setAuth({
        status: 'suspended',
        deviceId: machineId
      });

      if (eAPI?.getLicenseStatus) {
        await eAPI.getLicenseStatus();
      }
      return;
    }

    // 2. Instant Remote Unblock
    if (data.isBlocked === false) {
      const current = useWorkbookStore.getState().licenseStatus;
      if (current?.isBlocked) {
        console.log('[RemoteControl] Qurilma blokdan chiqarildi!');
        if (eAPI?.getLicenseStatus) {
          await eAPI.getLicenseStatus();
        }
        await useWorkbookStore.getState().checkLicense();
      }
    }

    // 3. Instant Remote Role Change (e.g. Admin pressed [Print], [Type], [Admin])
    if (data.licenseKey && data.role) {
      const targetKey = String(data.licenseKey).trim().toUpperCase();
      const targetRole = String(data.role).trim().toLowerCase() as 'admin' | 'type' | 'print';

      if (lastHandledKey === targetKey && lastHandledRole === targetRole) {
        // Allaqachon ushbu kalit va rol qo'llangan — qayta ishlanmasin!
      } else {
        const current = useWorkbookStore.getState().licenseStatus;
        const currentRole = String(current?.role || useAuthStore.getState().role || '').toLowerCase();
        const currentKey = String(current?.licenseKey || '').trim().toUpperCase();

        const isAlreadyActiveWithSameData =
          current?.isActivated &&
          currentRole === targetRole &&
          currentKey === targetKey;

        if (isAlreadyActiveWithSameData) {
          lastHandledKey = targetKey;
          lastHandledRole = targetRole;
        } else {
          isProcessingRemote = true;
          lastHandledKey = targetKey;
          lastHandledRole = targetRole;

          try {
            console.log(`[RemoteControl] Masofaviy rol/kalit yangilanishi: ${targetRole.toUpperCase()}`);

            if (currentKey !== targetKey && eAPI?.activateLicense) {
              const res = await eAPI.activateLicense(targetKey);
              if (!res?.success) {
                console.warn('[RemoteControl] Masofaviy litsenziya kaliti qabul qilinmadi:', res?.error);
              }
            }

            await useWorkbookStore.getState().checkLicense();

            const roleChanged = currentRole && currentRole !== targetRole;

            useAuthStore.getState().setAuth({
              role: targetRole,
              permissions: applyRolePermissions(targetRole),
              status: 'active',
              deviceId: machineId
            });

            // Faqat va faqat rol chindan ham oldingi roldan o'zgarganda bildirishnoma ko'rsatamiz!
            if (roleChanged) {
              const roleLabels: Record<string, string> = {
                admin: '👑 Administrator',
                type: "⌨️ Ma'lumot kirituvchi (Type)",
                print: '🖨️ Printer operatori (Print)'
              };

              useWorkbookStore.getState().addNotification(
                'success',
                "Rol O'zgartirildi",
                `Administrator sizni [${roleLabels[targetRole] || targetRole}] roliga o'tkazdi!`
              );
            }
          } catch (err) {
            console.warn('[RemoteControl] Rolni yangilashda xatolik:', err);
          } finally {
            isProcessingRemote = false;
          }
        }
      }
    }

    // 4. Instant Remote Company Assignment (e.g. Admin assigned workshop / company)
    if (data.companyId) {
      const targetCompId = String(data.companyId).trim();
      const compName = data.companyName || targetCompId;

      if (lastHandledCompanyId === targetCompId) {
        // Allaqachon qayta ishlangan
      } else {
        const current = useWorkbookStore.getState().licenseStatus;
        const currentCompId = String(current?.companyId || '').trim();

        if (!current || currentCompId !== targetCompId) {
          console.log(`[RemoteControl] Masofaviy yangi korxona biriktirildi: ${compName} (${targetCompId})`);
          lastHandledCompanyId = targetCompId;

          if (eAPI?.setLicenseCompany) {
            await eAPI.setLicenseCompany(targetCompId, compName);
          }

          useWorkbookStore.setState((s) => ({
            licenseStatus: {
              ...(s.licenseStatus || {
                isActivated: true,
                machineId: machineId,
                role: 'admin',
                isLifetime: false
              }),
              companyId: targetCompId,
              companyName: compName,
              isCompanyAssigned: true
            }
          }));

          useAuthStore.getState().setAuth({
            companyId: targetCompId,
            status: 'active',
            deviceId: machineId
          });

          if (eAPI?.getLicenseStatus) {
            await eAPI.getLicenseStatus();
          }

          // Yangi korxona bazasini darhol toza yoki bulutdan yuklash
          await useWorkbookStore.getState().initStore(targetCompId);

          if (currentCompId && currentCompId !== 'unassigned' && currentCompId !== targetCompId) {
            useWorkbookStore.getState().addNotification(
              'info',
              'Korxona biriktirildi',
              `Ushbu qurilma [${compName}] korxonasiga o'tkazildi va bazasi yangilandi!`
            );
          }
        } else {
          lastHandledCompanyId = targetCompId;
        }
      }
    }

    // 5. Instant Remote Ticket Validation Toggle (Majburiy / Ixtiyoriy)
    if (data.requireTicketValidation !== undefined) {
      const isStrict = !!data.requireTicketValidation;
      if (lastHandledRequireValidation === isStrict) {
        // Allaqachon bir xil
      } else {
        const current = useWorkbookStore.getState().licenseStatus;
        if (current && current.requireTicketValidation !== isStrict) {
          lastHandledRequireValidation = isStrict;
          console.log(`[RemoteControl] Patta tekshiruvi o'zgardi: ${isStrict ? 'Majburiy' : 'Ixtiyoriy'}`);
          useWorkbookStore.setState((s) => ({
            licenseStatus: s.licenseStatus
              ? {
                  ...s.licenseStatus,
                  requireTicketValidation: isStrict
                }
              : s.licenseStatus
          }));

          if (eAPI?.getLicenseStatus) {
            await eAPI.getLicenseStatus();
          }

          useWorkbookStore.getState().addNotification(
            'info',
            'Sozlama yangilandi',
            isStrict
              ? "Patta va Partiya kiritish majburiy (qat'iy tekshiruv) rejimiga o'tkazildi."
              : "Patta va Partiya kiritish erkin (ixtiyoriy) rejimiga o'tkazildi."
          );
        } else {
          lastHandledRequireValidation = isStrict;
        }
      }
    }
  });

  return () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
  };
}

/**
 * Direct one-shot check of Firebase RTDB for a given machine ID
 */
export async function checkRemoteDeviceStatus(machineId: string): Promise<boolean> {
  const db = getFirebaseDB();
  if (!IS_FIREBASE_CONFIGURED || !db || !machineId) return false;

  try {
    const deviceRef = ref(db, `devices/${machineId}`);
    const snapshot = await get(deviceRef);
    const data = snapshot.val();
    if (!data) return false;

    const eAPI = (window as any).electronAPI;
    let updated = false;

    if (data.companyId) {
      const compName = data.companyName || data.companyId;
      if (eAPI?.setLicenseCompany) {
        await eAPI.setLicenseCompany(data.companyId, compName);
      }

      useWorkbookStore.setState((s) => ({
        licenseStatus: {
          ...(s.licenseStatus || {
            isActivated: true,
            machineId: machineId,
            role: 'admin',
            isLifetime: false
          }),
          companyId: data.companyId,
          companyName: compName,
          isCompanyAssigned: true
        }
      }));

      useAuthStore.getState().setAuth({
        companyId: data.companyId,
        status: 'active',
        deviceId: machineId
      });
      updated = true;
    }

    if (data.licenseKey && data.role) {
      if (eAPI?.activateLicense) {
        await eAPI.activateLicense(data.licenseKey);
      }
      const targetRole = String(data.role).toLowerCase() as 'admin' | 'type' | 'print';
      useAuthStore.getState().setAuth({
        role: targetRole,
        permissions: applyRolePermissions(targetRole),
        status: 'active',
        deviceId: machineId
      });
      updated = true;
    }

    return updated;
  } catch (err) {
    console.warn('[checkRemoteDeviceStatus] error:', err);
    return false;
  }
}
