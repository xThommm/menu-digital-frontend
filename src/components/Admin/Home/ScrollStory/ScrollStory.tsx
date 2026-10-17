import { useRef, type ReactNode } from "react";
import { useScrollScene, type SceneEnv, type SceneRenderer } from "./useScrollScene";
import { createQrScene } from "./sceneQr";
import { createOrdersScene } from "./sceneOrders";
import s from "./ScrollStory.module.css";

// Relato por scroll de la landing: "del QR a la cocina". Cada escena es una
// sección alta con un escenario pegajoso; el canvas y los textos avanzan con
// el scroll (ver useScrollScene). Toma los colores de los tokens --auth-* del
// contenedor, así que sigue el tema claro/oscuro de la landing.

interface SceneProps {
  id?: string;
  create: (env: SceneEnv) => SceneRenderer;
  theme: string;
  children: ReactNode;
}

function Scene({ id, create, theme, children }: SceneProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useScrollScene(sectionRef, canvasRef, create, theme);

  return (
    <section ref={sectionRef} id={id} className={s.scene}>
      <div className={s.stage}>
        <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />
        <div className={s.copy}>{children}</div>
      </div>
    </section>
  );
}

export default function ScrollStory({ theme }: { theme: string }) {
  return (
    <div className={s.story}>
      <Scene id="carta" create={createQrScene} theme={theme}>
        <div className={`${s.beat} ${s.beatFirst}`}>
          <h2 className={s.title}>Tu carta entera,<br />en un QR.</h2>
          <p className={s.text}>Cada plato, cada precio y cada foto, a un escaneo de distancia.</p>
        </div>
        <div className={`${s.beat} ${s.beatSecond}`}>
          <h2 className={s.title}>Escanean.<br />Miran. Piden.</h2>
          <p className={s.text}>Sin apps ni descargas: la carta se abre en el celular de cada mesa y se actualiza al instante.</p>
        </div>
      </Scene>

      <Scene id="recorrido-pedido" create={createOrdersScene} theme={theme}>
        <div className={`${s.beat} ${s.beatFirst}`}>
          <h2 className={s.title}>El pedido sale<br />de la mesa…</h2>
          <p className={s.text}>Lo arma el cliente desde la carta, o lo carga el mozo desde su celular.</p>
        </div>
        <div className={`${s.beat} ${s.beatSecond}`}>
          <h2 className={s.title}>…y llega directo<br />a su sector.</h2>
          <p className={s.text}>La cocina recibe los platos y la barra las bebidas. Sin papelitos ni idas y vueltas.</p>
        </div>
      </Scene>
    </div>
  );
}
