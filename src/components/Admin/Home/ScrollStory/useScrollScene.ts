import { useEffect, type RefObject } from "react";

// Motor de las escenas del relato de la landing: cada sección es alta (varias
// pantallas) y tiene un escenario pegajoso de 100svh con un <canvas>. El
// avance del scroll dentro de la sección (0 → 1) se suaviza y se pasa a la
// escena en cada cuadro, y también se publica como --p en la sección para
// que el CSS anime los textos sin re-renderizar React.

export interface SceneEnv {
  accent: string;
  ink: string;
  bg: string;
  font: string;
  sans: string;
  reducedMotion: boolean;
}

export interface SceneRenderer {
  resize(width: number, height: number): void;
  render(ctx: CanvasRenderingContext2D, progress: number, time: number): void;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export function useScrollScene(
  sectionRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  createScene: (env: SceneEnv) => SceneRenderer,
  // Cambia con el tema: la escena se rearma para releer los colores.
  refreshKey?: unknown,
) {
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!section || !canvas || !ctx) return;

    const styles = getComputedStyle(section);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = createScene({
      accent: styles.getPropertyValue("--gold").trim() || "#E85D3C",
      ink: styles.getPropertyValue("--auth-cream").trim() || "#f5ede0",
      bg: styles.getPropertyValue("--auth-bg").trim() || "#0a0608",
      font: styles.getPropertyValue("--font-auth-mono").trim() || "monospace",
      sans: styles.getPropertyValue("--font-sans").trim() || "sans-serif",
      reducedMotion,
    });

    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.resize(width, height);
    };

    const target = () => {
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      return travel > 0 ? clamp01(-rect.top / travel) : 0;
    };

    let progress = target();
    let frame = 0;
    let visible = false;

    const draw = (now: number) => {
      const goal = target();
      progress = reducedMotion ? goal : progress + (goal - progress) * 0.12;
      if (Math.abs(goal - progress) < 0.0005) progress = goal;
      section.style.setProperty("--p", progress.toFixed(4));
      ctx.clearRect(0, 0, width, height);
      scene.render(ctx, progress, reducedMotion ? 0 : now / 1000);
      frame = visible ? requestAnimationFrame(draw) : 0;
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!frame) draw(performance.now());
    });
    resizeObserver.observe(canvas);

    // Solo se anima mientras la sección está en pantalla.
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    intersection.observe(section);

    resize();
    draw(performance.now());

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }, [sectionRef, canvasRef, createScene, refreshKey]);
}

export const clamp = clamp01;

/** Avance local de `p` entre `from` y `to`, recortado a 0..1. */
export const range = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pseudo-azar con semilla, para que la escena sea igual en cada carga. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
