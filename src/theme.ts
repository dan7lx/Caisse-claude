import type { LineStatus, PaymentMethod, Station } from './store/types';
import type { TableState } from './store/selectors';

export const colors = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  primary: '#EA580C',
  primarySoft: '#FFEDD5',
  dark: '#1F2937',
  free: '#16A34A',
  freeSoft: '#DCFCE7',
  busy: '#2563EB',
  busySoft: '#DBEAFE',
  ready: '#D97706',
  readySoft: '#FEF3C7',
  toSend: '#9333EA',
  toSendSoft: '#F3E8FF',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
};

export const categoryPalette = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
];

export const tableStateStyle: Record<TableState, { label: string; color: string; soft: string }> = {
  libre: { label: 'Libre', color: colors.free, soft: colors.freeSoft },
  occupee: { label: 'Occupée', color: colors.busy, soft: colors.busySoft },
  a_envoyer: { label: 'À envoyer', color: colors.toSend, soft: colors.toSendSoft },
  pret: { label: 'Prêt à servir', color: colors.ready, soft: colors.readySoft },
};

export const lineStatusStyle: Record<LineStatus, { label: string; color: string; soft: string }> = {
  brouillon: { label: 'Non envoyé', color: colors.toSend, soft: colors.toSendSoft },
  envoye: { label: 'Envoyé', color: colors.busy, soft: colors.busySoft },
  en_preparation: { label: 'En préparation', color: colors.primary, soft: colors.primarySoft },
  pret: { label: 'Prêt', color: colors.ready, soft: colors.readySoft },
  servi: { label: 'Servi', color: colors.free, soft: colors.freeSoft },
};

export const stationLabel: Record<Station, string> = { cuisine: 'Cuisine', bar: 'Bar' };

export const paymentLabel: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  autre: 'Autre',
};
