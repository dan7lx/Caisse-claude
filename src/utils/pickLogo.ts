import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Ouvre la galerie, recadre en carré et réduit le logo à 256 px.
 * Retourne l'image en data URI (partagée avec l'équipe du lobby), ou null si annulé.
 */
export async function pickLogo(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.canAskAgain === false) {
    throw new Error('Autorisez l’accès aux photos dans les réglages du téléphone.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const side = Math.min(asset.width || 256, asset.height || 256);
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
  actions.push({ resize: { width: 256, height: 256 } });
  const out = await manipulateAsync(asset.uri, actions, { compress: 0.85, format: SaveFormat.PNG, base64: true });
  if (!out.base64) throw new Error('Image illisible.');
  return `data:image/png;base64,${out.base64}`;
}
