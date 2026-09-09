/**
 * usePermission — declarative permission check
 * Phase 4 — RBAC
 */

import { useAuthStore, useCan, useCanAny } from '../store/authStore';
import type { Permission } from '../types/sync';

export { useCan, useCanAny };

/**
 * usePermission — alias for useCan (consistent naming)
 */
export function usePermission(permission: Permission): boolean {
  return useCan(permission);
}

/**
 * useAnyPermission — alias for useCanAny
 */
export function useAnyPermission(...permissions: Permission[]): boolean {
  return useCanAny(...permissions);
}

/**
 * useRole — current user role
 */
export const useRoleFromAuth = () => useAuthStore((s) => s.role);
