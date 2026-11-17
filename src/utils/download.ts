import { Platform } from 'react-native';

/**
 * Enregistre un fichier texte (export CSV) : partage du téléphone si possible (iPhone : « Enregistrer dans
 * Fichiers », e-mail, WhatsApp…), sinon téléchargement par le navigateur.
 */
export async function saveTextFile(name: string, text: string, mime = 'text/csv'): Promise<'partage' | 'telecharge'> {
  if (Platform.OS !== 'web') throw new Error('Export disponible dans la version web de l’application.');
  const g = globalThis as unknown as {
    document: Document;
    navigator: Navigator & { canShare?: (d: ShareData) => boolean };
    URL: typeof URL;
  };
  // BOM : Excel lit correctement les accents.
  const blob = new Blob(['﻿', text], { type: `${mime};charset=utf-8` });
  const file = typeof File !== 'undefined' ? new File([blob], name, { type: mime }) : null;
  const mobile = /iPhone|iPad|iPod|Android/.test(g.navigator.userAgent);
  if (mobile && file && g.navigator.canShare?.({ files: [file] })) {
    try {
      await g.navigator.share({ files: [file], title: name });
      return 'partage';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'partage';
      // Partage refusé : on retombe sur le téléchargement.
    }
  }
  const url = g.URL.createObjectURL(blob);
  const a = g.document.createElement('a');
  a.href = url;
  a.download = name;
  g.document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => g.URL.revokeObjectURL(url), 10_000);
  return 'telecharge';
}
