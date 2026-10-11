// Avisos sonoros (sin archivos): tonos con WebAudio. Los usan el panel del
// dueño (pedidos, mesas, reservas) y la pantalla de cada sector.
//
// Los navegadores no dejan sonar audio hasta que la persona toca la página
// alguna vez. Por eso hay UN solo AudioContext para toda la app: se
// "desbloquea" con el primer toque/tecla y desde ahí suena aunque la pestaña
// esté en segundo plano. Antes se creaba uno por aviso, y si el panel se
// abría y nadie lo tocaba, los avisos no sonaban nunca.

export type AlertSound = "default" | "order" | "table" | "reservation";

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

const getCtor = (): AudioCtor | null => {
  if (typeof window === "undefined") return null;
  return window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    ?? null;
};

const getContext = (): AudioContext | null => {
  if (ctx) return ctx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    ctx.onstatechange = () => listeners.forEach(listener => listener());
  } catch {
    ctx = null;
  }
  return ctx;
};

/** true si hay audio pero el navegador todavía no lo deja sonar (falta un toque). */
export function isAudioLocked(): boolean {
  if (!getCtor()) return false;
  // Sin contexto todavía no se crea uno solo para preguntar (el navegador se
  // queja de un audio sin gesto): alcanza con saber si ya hubo un toque.
  if (!ctx) {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    return activation ? !activation.hasBeenActive : true;
  }
  return ctx.state !== "running";
}

/** Avisa cuando cambia isAudioLocked() (para mostrar u ocultar "Activar sonido"). */
export function onAudioStateChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Intenta habilitar el audio. Tiene que llamarse desde un toque o una tecla. */
export function unlockAudio(): Promise<boolean> {
  const context = getContext();
  if (!context) return Promise.resolve(false);
  if (context.state === "running") return Promise.resolve(true);
  return context.resume()
    .then(() => {
      // Safari necesita que algo suene dentro del gesto: un tono mudo alcanza.
      const osc = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.01);
      listeners.forEach(listener => listener());
      return context.state === "running";
    })
    .catch(() => false);
}

// Primer gesto en cualquier parte de la app: desbloquea el audio y deja de escuchar.
if (typeof window !== "undefined") {
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const onGesture = () => {
    void unlockAudio().then(ok => {
      if (ok) events.forEach(event => window.removeEventListener(event, onGesture, true));
    });
  };
  events.forEach(event => window.addEventListener(event, onGesture, { capture: true, passive: true }));
}

// [frecuencia (Hz), comienzo (s)] de cada nota. Cada aviso tiene su melodía
// para reconocerlo sin mirar la pantalla.
const MELODIES: Record<AlertSound, [number, number][]> = {
  // Dos tonos cortos (el aviso de siempre).
  default: [[880, 0], [1175, 0.18]],
  // Pedido nuevo: tres tonos ascendentes, dos veces.
  order: [[784, 0], [988, 0.15], [1319, 0.3], [784, 0.75], [988, 0.9], [1319, 1.05]],
  // Mesa abierta: "ding-dong" grave.
  table: [[659, 0], [523, 0.32], [659, 0.8], [523, 1.12]],
  // Reserva: dos tonos agudos suaves.
  reservation: [[1047, 0], [1568, 0.2], [1047, 0.6], [1568, 0.8]],
};

/** Toca el aviso. Si el audio sigue bloqueado no suena (el aviso visual queda). */
export function playAlert(sound: AlertSound = "default") {
  try {
    const context = getContext();
    if (!context) return;
    if (context.state !== "running") void context.resume().catch(() => undefined);
    const start = context.currentTime + 0.02;
    for (const [frequency, offset] of MELODIES[sound]) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const at = start + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(context.destination);
      osc.start(at);
      osc.stop(at + 0.24);
    }
  } catch {
    // Sin audio disponible: el aviso visual alcanza.
  }
}

/** Aviso corto de siempre (pantalla de sector, prueba del botón de sonido). */
export function beep() {
  playAlert("default");
}
