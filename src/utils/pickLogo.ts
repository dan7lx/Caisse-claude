import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type ImageSource = 'galerie' | 'appareil';

interface SquareOptions {
  size: number;
  format: SaveFormat;
  compress: number;
  mime: string;
}

/**
 * Ouvre la galerie ou l'appareil photo, recadre en carré centré et réduit l'image.
 * Retourne l'image en data URI (enregistrée avec les données, partagée avec l'équipe du lobby), ou null si annulé.
 */
async function pickSquare(source: ImageSource, o: SquareOptions): Promise<string | null> {
  const permission =
    source === 'appareil' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.canAskAgain === false) {
    throw new Error(
      source === 'appareil'
        ? 'Autorisez l’accès à l’appareil photo dans les réglages du téléphone.'
        : 'Autorisez l’accès aux photos dans les réglages du téléphone.',
    );
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === 'appareil' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const side = Math.min(asset.width || o.size, asset.height || o.size);
  const actions = [];
  // Recadrage carré centré (l'éditeur n'existe pas sur le web).
  if (asset.width && asset.height && asset.width !== asset.height) {
    actions.push({
      crop: {
        originX: Math.round((asset.width - side) / 2),
        originY: Math.round((asset.height - side) / 2),
        width: side,
        height: side,
      },
    });
  }
  actions.push({ resize: { width: o.size, height: o.size } });
  const out = await manipulateAsync(asset.uri, actions, { compress: o.compress, format: o.format, base64: true });
  if (!out.base64) throw new Error('Image illisible.');
  return `data:${o.mime};base64,${out.base64}`;
}

/** Logo du commerce : carré de 256 px (PNG, fond transparent conservé). */
export const pickLogo = (): Promise<string | null> =>
  pickSquare('galerie', { size: 256, format: SaveFormat.PNG, compress: 0.85, mime: 'image/png' });

/**
 * Photo d'un produit : carré de 240 px en JPEG léger (environ 10 à 20 Ko), pour que la carte entière
 * reste petite dans la mémoire du téléphone et dans la synchronisation du lobby.
 */
export const pickProductPhoto = (source: ImageSource): Promise<string | null> =>
  pickSquare(source, { size: 240, format: SaveFormat.JPEG, compress: 0.6, mime: 'image/jpeg' });
