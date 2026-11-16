import { Platform } from 'react-native';

// Signal sonore des alertes (web) : deux bips courts générés par Web Audio, sans fichier son.
// Sur iPhone, le son n'est autorisé qu'après un premier toucher : `unlockSound` est appelé au premier geste.

type AudioCtx = { currentTime: number; destination: unknown; state: string; resume: () => Promise<void> } & {
  createOscillator: () => {
    type: string;
    frequency: { setValueAtTime: (v: number, t: number) => void };
    connect: (n: unknown) => void;
    start: (t: number) => void;
    stop: (t: number) => void;
  };
  createGain: () => {
    gain: { setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void };
    connect: (n: unknown) => void;
  };
};

let ctx: AudioCtx | null = null;

function audio(): AudioCtx | null {
  if (Platform.OS !== 'web') return null;
  if (ctx) return ctx;
  const g = globalThis as { AudioContext?: new () => AudioCtx; webkitAudioContext?: new () => AudioCtx };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** À appeler lors d'un geste de l'utilisateur : débloque le son pour la suite. */
export function unlockSound() {
  const a = audio();
  if (a && a.state !== 'running') a.resume().catch(() => undefined);
}

/** Deux bips (aigu pour un nouveau bon, plus grave pour « prêt » ou une annulation). */
export function playAlertSound(kind: 'haut' | 'bas' = 'haut') {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const base = kind === 'haut' ? 880 : 620;
  [0, 0.22].forEach((offset, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    const t = a.currentTime + offset;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(i === 0 ? base : base * 1.25, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

/** Vibration (Android, navigateurs qui la permettent ; sans effet sur iPhone). */
export function vibrate() {
  const nav = (globalThis as { navigator?: { vibrate?: (p: number[]) => boolean } }).navigator;
  try {
    nav?.vibrate?.([120, 60, 120]);
  } catch {
    // non disponible
  }
}
