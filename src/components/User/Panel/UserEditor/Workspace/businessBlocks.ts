import {
  AppWindow, Clock, Image, Images, LayoutTemplate, MessageCircle, Palette, Phone, Share2, ShoppingBag, Stamp, Store,
  type LucideIcon,
} from "lucide-react";

// Mapa del editor de negocio: sus tres pestañas y los bloques de cada una.
// En escritorio cada bloque es una tarjeta del tablero y una entrada de la
// columna de estructura; en el celular van sueltos dentro de su pestaña.

export type BusinessTab = "info" | "media" | "template";

export type BusinessBlockId =
  | "datos" | "contacto" | "whatsapp" | "redes" | "pedidos" | "horario"
  | "portada" | "logo" | "galeria"
  | "diseno" | "plantilla" | "paleta";

export interface BusinessBlock {
  id: BusinessBlockId;
  tab: BusinessTab;
  title: string;
  hint: string;
  icon: LucideIcon;
}

export const BUSINESS_TABS: { key: BusinessTab; label: string; note: string }[] = [
  { key: "info", label: "Información", note: "Se guarda con «Guardar cambios»" },
  { key: "media", label: "Imágenes", note: "Se guardan al subirlas" },
  { key: "template", label: "Apariencia", note: "Se guarda al elegir" },
];

export const BUSINESS_BLOCKS: BusinessBlock[] = [
  { id: "datos", tab: "info", title: "Datos del local", hint: "El nombre y la dirección que ven tus clientes", icon: Store },
  { id: "contacto", tab: "info", title: "Contacto", hint: "Teléfono del local y email de la cuenta", icon: Phone },
  { id: "whatsapp", tab: "info", title: "WhatsApp", hint: "A dónde llegan los pedidos y las reservas", icon: MessageCircle },
  { id: "redes", tab: "info", title: "Redes sociales", hint: "Los enlaces de tu página", icon: Share2 },
  { id: "pedidos", tab: "info", title: "Delivery y take away", hint: "Cómo reciben el pedido tus clientes", icon: ShoppingBag },
  { id: "horario", tab: "info", title: "Horario de atención", hint: "Los días y turnos en los que abrís", icon: Clock },
  { id: "portada", tab: "media", title: "Imagen de portada", hint: "Lo primero que se ve al entrar a tu página", icon: Image },
  { id: "logo", tab: "media", title: "Logo", hint: "El ícono de la pestaña del navegador", icon: Stamp },
  { id: "galeria", tab: "media", title: "Galería", hint: "Fotos del local para que lo conozcan", icon: Images },
  { id: "diseno", tab: "template", title: "Diseño de carta", hint: "Una identidad para la portada y la carta", icon: LayoutTemplate },
  { id: "plantilla", tab: "template", title: "Plantilla de página", hint: "Cómo se acomodan la portada y la carta en la computadora", icon: AppWindow },
  { id: "paleta", tab: "template", title: "Paleta de colores", hint: "Los colores del diseño elegido", icon: Palette },
];

export const getBusinessBlock = (id: BusinessBlockId) => BUSINESS_BLOCKS.find(block => block.id === id)!;

// Un ítem del resumen "Completá tu perfil": lleva al bloque donde se carga.
export interface BusinessCheck {
  block: BusinessBlockId;
  label: string;
  done: boolean;
}
