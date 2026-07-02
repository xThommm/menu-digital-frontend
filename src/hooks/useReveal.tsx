import { useEffect, useRef, useState } from "react";

// Revela un elemento (clase .t-reveal-in de globals.css) la primera vez que
// entra en el viewport, y deja de observar — no hace falta re-animar si el
// usuario scrollea para arriba y para abajo de nuevo.
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}
