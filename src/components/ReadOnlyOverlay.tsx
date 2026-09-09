/**
 * Read-Only Indicator Banner
 * Phase 4 — RBAC Visual Guidance
 */

import React from 'react';
import { Eye, Lock } from 'lucide-react';

export const ReadOnlyOverlay: React.FC<{ message?: string }> = ({
  message = "Faqat ko'rish rejimi (tahrirlash ruxsati berilmagan)"
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '6px 14px',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#d97706',
        fontSize: '12px',
        fontWeight: 600,
        userSelect: 'none'
      }}
    >
      <Eye size={14} />
      <span>{message}</span>
      <Lock size={13} style={{ marginLeft: '4px', opacity: 0.8 }} />
    </div>
  );
};
