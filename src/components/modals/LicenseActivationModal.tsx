import React, { useState } from 'react';
import { useWorkbookStore } from '../../store/workbookStore';
import { ShieldCheck, ShieldAlert, Key, Copy, Check, Send, X, Clock, AlertTriangle, Ban } from 'lucide-react';
import { useTrialCountdown } from '../../hooks/useTrialCountdown';

export const LicenseActivationModal: React.FC = () => {
  const licenseStatus = useWorkbookStore((s) => s.licenseStatus);
  const activateWithKey = useWorkbookStore((s) => s.activateWithKey);
  const modalType = useWorkbookStore((s) => s.modalState.type);
  const closeModal = useWorkbookStore((s) => s.closeModal);
  const countdown = useTrialCountdown(licenseStatus);
  const [inputKey, setInputKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!licenseStatus) return null;

  const isActivated = licenseStatus.isActivated;
  const isTrial = licenseStatus.isTrial;
  const isTrialExpired = licenseStatus.isTrialExpired;
  const isBlocked = licenseStatus.isBlocked;
  const isManuallyOpened = modalType === 'license_activation';

  if (isActivated && !isTrialExpired && !isBlocked && !isManuallyOpened) return null;

  const machineId = licenseStatus.machineId || 'UNKNOWN';
  const canClose = (isActivated && !isTrialExpired && !isBlocked) || (isTrial && !isBlocked);

  const handleCopy = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMsg('Iltimos, aktivatsiya kalitini kiriting');
      return;
    }

    setIsActivating(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await activateWithKey(inputKey.trim());
    setIsActivating(false);

    if (res.success) {
      setSuccessMsg('Dastur muvaffaqiyatli faollashtirildi! Dasturdan to\'liq foydalanishingiz mumkin.');
      setTimeout(() => {
        closeModal();
      }, 1500);
    } else {
      setErrorMsg(res.error || 'Kalit xato yoki ushbu qurilmaga mos kelmadi.');
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        backgroundColor: canClose ? 'rgba(15, 23, 42, 0.65)' : 'rgba(10, 15, 30, 0.95)'
      }}
      onClick={canClose ? closeModal : undefined}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '560px',
          borderRadius: 'var(--radius-xl)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            background: isBlocked
              ? 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)'
              : isActivated && !isTrial
              ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
              : isTrial
              ? 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #991b1b 0%, #450a0a 100%)',
            padding: '24px',
            color: '#ffffff',
            position: 'relative'
          }}
        >
          {canClose && (
            <button
              onClick={closeModal}
              className="soft-btn soft-btn-secondary"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: 'none'
              }}
            >
              <X size={16} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isBlocked ? (
                <Ban size={28} color="#fca5a5" />
              ) : isActivated && !isTrial ? (
                <ShieldCheck size={28} color="#6ee7b7" />
              ) : isTrial ? (
                <Clock size={28} color="#7dd3fc" />
              ) : (
                <ShieldAlert size={28} color="#fca5a5" />
              )}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                {isBlocked
                  ? 'Qurilma Bloklangan'
                  : isActivated && !isTrial
                  ? 'Litsenziya Faollashtirilgan'
                  : isTrialExpired
                  ? 'Sinov Muddati Tugadi'
                  : isTrial
                  ? 'Sinov Muddati (Trial)'
                  : 'Dastur Aktivatsiyasi'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.9 }}>
                {isBlocked
                  ? 'Ushbu qurilma administrator tomonidan bloklangan'
                  : isActivated && !isTrial
                  ? licenseStatus.isLifetime
                    ? 'Cheksiz (Lifetime) litsenziya faol'
                    : `Amal qilish muddati: ${licenseStatus.expiry}`
                  : isTrialExpired
                  ? 'Dasturdan foydalanish uchun litsenziya kalitini kiriting'
                  : isTrial
                  ? `Qolgan vaqt: ${countdown ? `${countdown.formattedText} (${countdown.formattedClock})` : (licenseStatus.remainingText || '24 soat')}`
                  : 'Litsenziya kalitini kiriting'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Machine ID Box */}
          <div
            style={{
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Sizning Qurilma ID raqamingiz:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="soft-btn soft-btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: 'var(--radius-full)' }}
              >
                {copied ? <Check size={12} color="var(--primary)" /> : <Copy size={12} />}
                <span>{copied ? 'Nusxalandi!' : 'Nusxa olish'}</span>
              </button>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                wordBreak: 'break-all',
                background: 'var(--bg-surface)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {machineId}
            </div>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current License Details if active */}
          {isActivated && !isTrial && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12.5px'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Joriy Faol Rol: </span>
                <span style={{ fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                  {licenseStatus.role || 'admin'}
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Litsenziya faol
                </div>
              </div>
            </div>
          )}

          {/* Activation Form — Always available for changing or updating license keys */}
          <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {isActivated && !isTrial
                  ? 'Aktivatsiya kalitini o\'zgartirish yoki yangilash:'
                  : 'Aktivatsiya kalitini kiriting:'}
              </label>
              <input
                type="text"
                placeholder="Masalan: ACT-PRINT-9EE3-XXXX-XXXX"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="soft-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}
              />
            </div>

            <button
              type="submit"
              disabled={isActivating || !inputKey.trim()}
              className="soft-btn soft-btn-primary"
              style={{ height: '40px', fontSize: '13px' }}
            >
              <Key size={15} />
              <span>{isActivating ? 'Tekshirilmoqda...' : isActivated && !isTrial ? 'Kalitni Yangilash' : 'Faollashtirish'}</span>
            </button>
          </form>

          {/* Telegram Contact Banner */}
          <div
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0369a1' }}>
                Litsenziya kalitini olish:
              </div>
              <div style={{ fontSize: '11.5px', color: '#0284c7', marginTop: '2px' }}>
                ID raqamingizni administratorga yuboring
              </div>
            </div>

            <a
              href="https://t.me/mayestr0"
              target="_blank"
              rel="noopener noreferrer"
              className="soft-btn soft-btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                padding: '6px 14px',
                fontSize: '12px',
                textDecoration: 'none',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <Send size={13} />
              <span>@mayestr0</span>
            </a>
          </div>
        </div>

        {canClose && (
          <div className="modal-footer">
            <button
              onClick={closeModal}
              className="soft-btn soft-btn-primary"
              style={{ borderRadius: 'var(--radius-full)', padding: '6px 20px' }}
            >
              Yopish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
