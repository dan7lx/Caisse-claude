import type { Session } from '../store/StoreProvider';
import type { AppState, StaffMember } from '../store/types';
import { sha256 } from '../utils/sha256';
import { hashManagerPin, isAdminCode } from './license';

/** Peut ouvrir la Gestion (gérant autorisé ou administrateur). */
export function canManage(state: AppState, session: Session): boolean {
  return session.admin || (session.manager && state.security.managerCanManage);
}

/** Peut créer un lobby pour son équipe. */
export function canCreateLobby(state: AppState, session: Session): boolean {
  return session.admin || (session.manager && state.security.managerCanCreateLobby);
}

/** Identifie un code saisi : administrateur, gérant, ou inconnu. */
export function identifyCode(state: AppState, code: string): 'admin' | 'manager' | null {
  if (isAdminCode(code)) return 'admin';
  const hash = state.security.managerPinHash;
  if (hash && hashManagerPin(code, state.license.id) === hash) return 'manager';
  return null;
}

/** Empreinte du code personnel d'un employé. */
export function hashStaffPin(pin: string, licenseId: string): string {
  return sha256(`caisse-resto:employe:${licenseId}:${pin.trim()}`);
}

/** Employé correspondant à un code personnel. */
export function identifyStaff(state: AppState, code: string): StaffMember | undefined {
  const hash = hashStaffPin(code, state.license.id);
  return state.staff.find((m) => m.pinHash === hash);
}
