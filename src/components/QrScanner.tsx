import jsQR from 'jsqr';
import { createElement, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { haptic } from '../utils/haptics';
import { Button } from './ui';

interface Props {
  onClose: () => void;
  /** Texte lu dans le QR code. Retourne un message d'erreur pour continuer à scanner, ou null pour fermer. */
  onScan: (text: string) => string | null;
}

/** Plus grand côté de l'image analysée : assez pour un QR sur un écran, léger pour le téléphone. */
const MAX_SIDE = 640;

const mediaDevices = () => (Platform.OS === 'web' ? (globalThis as { navigator?: Navigator }).navigator?.mediaDevices : undefined);

/**
 * Lecteur de QR code par la caméra arrière (application web : iPhone, Android, ordinateur).
 * Analyse 4 images par seconde avec jsQR ; aucune image ne quitte le téléphone.
 * À afficher seulement quand le scan est demandé : chaque ouverture repart de zéro.
 */
export function QrScanner({ onClose, onScan }: Props) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const unsupported =
    Platform.OS !== 'web'
      ? 'Le scan est disponible dans l’application web. Saisissez le code du lobby.'
      : !mediaDevices()?.getUserMedia
        ? 'Ce navigateur ne donne pas accès à la caméra. Saisissez le code du lobby.'
        : null;
  const error = unsupported ?? cameraError;

  useEffect(() => {
    const media = mediaDevices();
    if (!video || !media?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    media
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        await video.play().catch(() => undefined);
        timer = setInterval(() => {
          if (stopped || !ctx || video.readyState < 2 || !video.videoWidth) return;
          const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (!found?.data) return;
          const problem = onScanRef.current(found.data);
          if (problem) {
            setHint(problem);
            return;
          }
          haptic.success();
          stop();
        }, 250);
      })
      .catch((e: unknown) => {
        const name = e instanceof Error ? e.name : '';
        setCameraError(
          name === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages, ou saisissez le code du lobby.'
            : 'Caméra indisponible. Saisissez le code du lobby.',
        );
      });
    return stop;
  }, [video]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <Text style={styles.title}>Scanner le QR code</Text>
        <Text style={styles.text}>Visez le QR code affiché sur le téléphone du gérant (Équipe › Inviter).</Text>
        <View style={styles.frame}>
          {Platform.OS === 'web' && !error
            ? createElement('video', {
                ref: setVideo,
                playsInline: true,
                muted: true,
                autoPlay: true,
                'aria-label': 'Caméra',
                style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
              })
            : null}
          {error ? <Text style={styles.error}>{error}</Text> : <View pointerEvents="none" style={styles.target} />}
        </View>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <Button title="Saisir le code à la place" variant="secondary" icon="keypad-outline" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 24, paddingTop: 60, gap: 16, alignItems: 'stretch' },
  title: { fontFamily: fonts.displayHeavy, fontSize: 26, color: colors.onDark, textAlign: 'center' },
  text: { color: colors.onDarkMuted, textAlign: 'center', lineHeight: 20 },
  frame: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: {
    position: 'absolute',
    width: '64%',
    height: '64%',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  error: { color: colors.onDark, textAlign: 'center', padding: 20, lineHeight: 21 },
  hint: { color: colors.ready, textAlign: 'center', fontWeight: '700' },
});
