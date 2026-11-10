import { Platform } from 'react-native';

import type { TableState } from './store/selectors';
import type { LineStatus, PaymentMethod, Station } from './store/types';

/** Palette « brasserie de prestige » : noir chaud, or, ivoire et couleurs profondes. */
export const colors = {
  ink: '#16120F',
  ink2: '#231D18',
  ink3: '#3A3029',
  gold: '#C9A24B',
  goldLight: '#E4C77F',
  goldSoft: '#F4EAD2',
  goldDeep: '#8E6D25',
  onDark: '#F6F0E4',
  onDarkMuted: '#A89A88',

  bg: '#F4EDE1',
  card: '#FFFDF8',
  text: '#1E1915',
  muted: '#7A6E62',
  border: '#E5D9C4',
  line: '#EEE5D5',

  primary: '#C9A24B',
  primarySoft: '#F4EAD2',
  dark: '#16120F',

  free: '#2F7D5B',
  freeSoft: '#E1EFE6',
  busy: '#2B5A8C',
  busySoft: '#E0E9F3',
  ready: '#C27C0E',
  readySoft: '#FBEED3',
  toSend: '#7A3E8E',
  toSendSoft: '#F1E4F3',
  danger: '#B3261E',
  dangerSoft: '#F7E0DC',
  wine: '#6E2639',
};

export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displayHeavy: 'PlayfairDisplay_800ExtraBold',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
};

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 18px rgba(22, 18, 15, 0.08)' },
  default: {
    shadowColor: '#16120F',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});

export const categoryPalette = [
  '#2F7D5B',
  '#B5502A',
  '#A23B6B',
  '#2B5A8C',
  '#6E2639',
  '#6B4F3A',
  '#C27C0E',
  '#3E6B6B',
  '#5B4A8B',
];

export const tableStateStyle: Record<TableState, { label: string; color: string; soft: string }> = {
  libre: { label: 'Libre', color: colors.free, soft: colors.freeSoft },
  occupee: { label: 'En cours', color: colors.busy, soft: colors.busySoft },
  a_envoyer: { label: 'À envoyer', color: colors.toSend, soft: colors.toSendSoft },
  pret: { label: 'Prêt à servir', color: colors.ready, soft: colors.readySoft },
};

export const lineStatusStyle: Record<LineStatus, { label: string; color: string; soft: string }> = {
  brouillon: { label: 'À envoyer', color: colors.toSend, soft: colors.toSendSoft },
  envoye: { label: 'Envoyé', color: colors.busy, soft: colors.busySoft },
  en_preparation: { label: 'En préparation', color: colors.goldDeep, soft: colors.goldSoft },
  pret: { label: 'Prêt', color: colors.ready, soft: colors.readySoft },
  servi: { label: 'Servi', color: colors.free, soft: colors.freeSoft },
};

export const stationLabel: Record<Station, string> = { cuisine: 'Cuisine', bar: 'Bar' };

export const paymentLabel: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  autre: 'Autre',
};

/** En-têtes sombres et dorés communs à tous les écrans. */
export const headerStyle = {
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: colors.gold,
  headerTitleStyle: { fontFamily: fonts.display, color: colors.onDark, fontSize: 20 },
  headerShadowVisible: false,
};
