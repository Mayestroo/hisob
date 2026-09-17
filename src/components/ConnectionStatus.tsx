/**
 * Connection & Sync Status Indicator Component
 * Phase 4 — Real-time Sync & Offline State
 */

import React, { useEffect, useState } from 'react';
import { useOnline } from '../hooks/useOnline';
import { useSyncStore } from '../store/syncStore';
import { getPendingCount } from '../services/offlineQueue';
import { flushOfflineQueue } from '../services/firebaseSync';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const ConnectionStatus: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const online = useOnline();
  const status = useSyncStore((s) => s.status);
  const syncing = status === 'syncing';
  const [pendingCount, setPendingCount] = useState<number>(0);

  const handleManualSync = async () => {
    if (online && pendingCount > 0 && !syncing) {
      try {
        const res = await flushOfflineQueue();
        setPendingCount(res.remaining);
      } catch (err: any) {
        console.error('Failed to flush offline queue:', err);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const checkCount = async () => {
      try {
        const count = await getPendingCount();
        if (mounted) setPendingCount(count);
      } catch (err) {
        console.error('Failed to get pending queue count:', err);
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [online, syncing]);

  return (
    <div
      onClick={handleManualSync}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11.5px',
        fontWeight: 600,
        backgroundColor: online ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: online ? '#6ee7b7' : '#fca5a5',
        border: `1px solid ${online ? 'rgba(52, 211, 153, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
        backdropFilter: 'blur(8px)',
        transition: 'all 0.2s',
        userSelect: 'none',
        cursor: online && pendingCount > 0 ? 'pointer' : 'default',
        ...style
      }}
      title={
        online
          ? syncing
            ? 'Sinxronlanmoqda...'
            : pendingCount > 0
            ? `${pendingCount} ta o'zgarish navbatda. Bosing — qayta yuborish`
            : 'Tarmoq ulangan (Online)'
          : 'Tarmoq uzilgan (Oflayn rejim — o\'zgarishlar lokal saqlanmoqda)'
      }
    >
      {online ? (
        syncing ? (
          <RefreshCw size={13} className="spin-animation" color="#6ee7b7" />
        ) : (
          <Wifi size={13} color="#6ee7b7" />
        )
      ) : (
        <WifiOff size={13} color="#fca5a5" />
      )}

      <span>{online ? (syncing ? 'Sinxron...' : 'Online') : 'Oflayn'}</span>

      {pendingCount > 0 && (
        <span
          style={{
            marginLeft: '2px',
            background: 'var(--status-error)',
            color: '#fff',
            borderRadius: '10px',
            padding: '1px 5px',
            fontSize: '10px',
            fontWeight: 700
          }}
          title={`${pendingCount} ta o'zgarish internet ulanganda avtomatik sinxronlanadi`}
        >
          {pendingCount}
        </span>
      )}
    </div>
  );
};
