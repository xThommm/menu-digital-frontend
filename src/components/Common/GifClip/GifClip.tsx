import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PlayCircle } from "lucide-react";
import s from "./GifClip.module.css";

// Video en vez de gif real cuando sea posible: mismo efecto (loop mudo,
// autoplay), pero un .mp4/.webm pesa una fracción de lo que pesa un .gif
// equivalente y sí puede respetar "reducir movimiento" pausando el autoplay
// — un <img> con un .gif no se puede pausar sin trucos de canvas.
function isVideoSrc(src: string) {
  return /\.(mp4|webm)$/i.test(src);
}

interface GifClipProps {
  /** Ruta al archivo (.gif, .mp4, .webm). Sin valor: muestra un placeholder. */
  src?: string;
  /** Qué muestra el clip — obligatorio, es el único texto para lectores de
   *  pantalla (el video no tiene `alt`) y también el label del placeholder. */
  alt: string;
  /** Texto visible debajo del clip. */
  caption?: string;
  /** Relación de aspecto CSS (ej. "16/10", "1/1"). Por defecto "16/10". */
  ratio?: string;
  className?: string;
}

export default function GifClip({ src, alt, caption, ratio, className }: GifClipProps) {
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // Sólo el video se posterga: es lo que pesa. El .gif ya usa loading="lazy"
  // nativo del navegador más abajo, no necesita este observer.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || !src || !isVideoSrc(src)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  return (
    <figure
      className={`${s.clip} ${className ?? ""}`}
      style={ratio ? ({ "--gifclip-ratio": ratio } as CSSProperties) : undefined}
      ref={wrapperRef}
    >
      {!src ? (
        <div className={s.placeholder}>
          <PlayCircle size={28} strokeWidth={1.5} aria-hidden="true" />
          <span>Próximamente: {alt}</span>
        </div>
      ) : isVideoSrc(src) ? (
        <>
          <video
            className={s.media}
            src={inView ? src : undefined}
            autoPlay={!reducedMotion}
            controls={reducedMotion}
            muted
            loop
            playsInline
            preload="none"
          />
          {/* prefers-reduced-motion: el usuario decide cuándo reproducir, así
              que ahí sí necesita saber qué va a ver antes de tocar play. */}
          <span className="sr-only">{alt}</span>
        </>
      ) : (
        <img className={s.media} src={src} alt={alt} loading="lazy" />
      )}
      {caption && <figcaption className={s.caption}>{caption}</figcaption>}
    </figure>
  );
}
