import type { PaymentMethod, Role } from './store/types';

// Libellés partagés (sans dépendance à React Native : utilisables par l'impression et les tests).

export const paymentLabel: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  autre: 'Autre',
};

export const roleLabel: Record<Role, string> = { serveur: 'Salle', cuisine: 'Cuisine', bar: 'Bar' };
export const roleEmoji: Record<Role, string> = { serveur: '🙋', cuisine: '🧑‍🍳', bar: '🍸' };
