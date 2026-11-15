import type { DeviceState } from './types';

/**
 * Appareil d'un employé qui a rejoint un lobby (pas celui du gérant qui l'a créé).
 * Il travaille sous l'abonnement du restaurant tant qu'il est dans le lobby, sans accès à l'abonnement.
 * Les anciens liens sans indication (`host` absent) sont traités comme des employés.
 */
export function isLobbyMember(device: Pick<DeviceState, 'lobby'> | null | undefined): boolean {
  return !!device?.lobby && device.lobby.host !== true;
}
