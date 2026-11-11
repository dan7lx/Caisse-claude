import { useWindowDimensions } from 'react-native';

export interface Layout {
  width: number;
  height: number;
  /** Petits téléphones (iPhone SE 1re génération, Android compacts). */
  small: boolean;
  /** Téléphones standard en portrait. */
  phone: boolean;
  /** Tablettes et grands écrans. */
  tablet: boolean;
  landscape: boolean;
  /** Facteur d'échelle des polices et espacements (0,88 sur petit écran, 1 sinon). */
  scale: number;
}

/** Adapte l'affichage à la taille de l'écran (tous téléphones iPhone et Android, tablettes). */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const small = width < 360;
  return {
    width,
    height,
    small,
    phone: width < 600,
    tablet: width >= 768,
    landscape: width > height,
    scale: small ? 0.88 : 1,
  };
}

/** Nombre de colonnes d'une grille selon la largeur disponible et la largeur minimale d'une case. */
export function columnsFor(width: number, minCell: number, max = 6): number {
  return Math.max(2, Math.min(max, Math.floor(width / minCell)));
}
