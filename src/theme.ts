import { Platform, type ViewStyle } from 'react-native';

import type { TableState } from './store/selectors';
import type { LineStatus, Station } from './store/types';

export { paymentLabel, roleEmoji, roleLabel } from './labels';

/**
 * Thème « verre sombre » : fond noir bleuté avec halos de couleur, panneaux translucides,
 * accent bleu glacier, couleurs d'état vives (lisibles d'un coup d'œil en plein service).
 * Règle : tout le texte est clair sur fond sombre ; `onAccent` est le seul texte foncé
 * (sur un fond d'accent ou de couleur vive).
 */
export const colors = {
  /** Surfaces sombres opaques (en-têtes, écrans de code, héros). */
  ink: '#0B0D15',
  ink2: '#12151F',
  ink3: '#2A3042',
  /** Accent (boutons principaux, sélection, liens). */
  accent: '#A9C7FF',
  accentLight: '#CFE0FF',
  accentSoft: 'rgba(120, 160, 255, 0.16)',
  /** Accent utilisé comme couleur de texte. */
  accentText: '#A9C7FF',
  /** Texte foncé posé sur l'accent ou sur une couleur vive. */
  onAccent: '#06070C',
  onDark: '#F2F7FF',
  onDarkMuted: '#AEB6C4',

  bg: '#07080D',
  /** Fond opaque des fenêtres (feuilles, modales). */
  surface: '#0F121B',
  /** Panneau de verre. */
  card: 'rgba(255, 255, 255, 0.065)',
  /** Champs de saisie et choix non sélectionnés. */
  field: 'rgba(255, 255, 255, 0.09)',
  text: '#F2F7FF',
  muted: '#AEB6C4',
  border: 'rgba(255, 255, 255, 0.16)',
  line: 'rgba(255, 255, 255, 0.09)',

  primary: '#A9C7FF',
  primarySoft: 'rgba(120, 160, 255, 0.16)',
  dark: '#0B0D15',

  free: '#34D399',
  freeSoft: 'rgba(52, 211, 153, 0.16)',
  busy: '#60A5FA',
  busySoft: 'rgba(96, 165, 250, 0.18)',
  ready: '#FBBF24',
  readySoft: 'rgba(251, 191, 36, 0.18)',
  toSend: '#C084FC',
  toSendSoft: 'rgba(192, 132, 252, 0.18)',
  danger: '#E5484D',
  dangerSoft: 'rgba(229, 72, 77, 0.2)',
  wine: '#FA579E',
};

/** Police du thème : Space Grotesk (SIL OFL, assets/fonts). */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayHeavy: 'SpaceGrotesk_700Bold',
  displayItalic: 'SpaceGrotesk_500Medium',
};

const web = Platform.OS === 'web';
/** Style réservé au web (dégradés, flou) : ignoré sur iOS / Android natifs. */
const webOnly = (style: Record<string, string>): ViewStyle => (web ? (style as ViewStyle) : {});

/** Fond d'écran : noir bleuté avec trois halos (bleu, violet, rose). */
export const screenBg: ViewStyle = {
  backgroundColor: colors.bg,
  ...webOnly({
    backgroundImage: [
      'radial-gradient(90% 55% at 8% 0%, rgba(77, 140, 255, 0.20), rgba(77, 140, 255, 0) 60%)',
      'radial-gradient(80% 50% at 100% 14%, rgba(143, 82, 245, 0.16), rgba(143, 82, 245, 0) 60%)',
      'radial-gradient(70% 45% at 50% 100%, rgba(250, 87, 158, 0.09), rgba(250, 87, 158, 0) 60%)',
    ].join(', '),
  }),
};

/** Reflet d'un panneau de verre (liseré lumineux en haut, ombre douce). Sans flou : reste fluide dans les listes. */
export const shadow: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.10), 0 10px 28px rgba(0, 0, 0, 0.32)' } as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
}) as ViewStyle;

/** Verre dépoli pour les éléments fixes (barre d'onglets, bandeaux) : flou de l'arrière-plan sur le web. */
export const frosted: ViewStyle = webOnly({
  backdropFilter: 'blur(22px) saturate(160%)',
  WebkitBackdropFilter: 'blur(22px) saturate(160%)',
});

/** Dégradé des boutons principaux et des éléments sélectionnés (web). */
export const accentGradient: ViewStyle = webOnly({
  backgroundImage: 'linear-gradient(135deg, #BBD4FF 0%, #A9C7FF 45%, #C7B6FF 100%)',
});

/** Halo des grands panneaux sombres (héros, en-têtes). */
export const heroGlow: ViewStyle = webOnly({
  backgroundImage:
    'radial-gradient(120% 90% at 0% 0%, rgba(77, 140, 255, 0.28), rgba(77, 140, 255, 0) 55%), radial-gradient(90% 80% at 100% 100%, rgba(143, 82, 245, 0.22), rgba(143, 82, 245, 0) 60%)',
});

/** Texte lisible (clair ou foncé) sur une couleur de fond « #RRGGBB ». */
export function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return colors.text;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? colors.onAccent : '#FFFFFF';
}

/** Couleurs des catégories de la carte : vives, lisibles sur fond sombre. */
export const categoryPalette = [
  '#34D399',
  '#FF9438',
  '#FA579E',
  '#60A5FA',
  '#C084FC',
  '#FBBF24',
  '#2DD4BF',
  '#F87171',
  '#8F9BFF',
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
  en_preparation: { label: 'En préparation', color: colors.accentText, soft: colors.accentSoft },
  pret: { label: 'Prêt', color: colors.ready, soft: colors.readySoft },
  servi: { label: 'Servi', color: colors.free, soft: colors.freeSoft },
};

export const stationLabel: Record<Station, string> = { cuisine: 'Cuisine', bar: 'Bar' };

/** En-têtes de navigation communs à tous les écrans. */
export const headerStyle = {
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: colors.accent,
  headerTitleStyle: { fontFamily: fonts.display, color: colors.onDark, fontSize: 19 },
  headerShadowVisible: false,
};
