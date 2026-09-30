import { useCallback, useEffect, useMemo, useState } from "react";
import { listSectors, setSectorAssignment } from "../api/ordersApi";
import type { Sector, SectorTargetType } from "../types";

// Sectores del local para el editor de menú: a qué sector va cada sección,
// categoría y producto, y qué heredaría si no tiene uno propio.
//
// La cascada es la misma que usa el backend al repartir un pedido en
// comandas: producto > categoría > sección > sector por defecto.
// Solo se consulta con el plan Pro (Gestión de pedidos); sin sectores o sin
// el plan, `sectors` queda vacío y el editor no muestra nada.

export interface SectorLink {
  type: SectorTargetType;
  id: string | null | undefined;
}

export interface InheritedSector {
  sector: Sector;
  // De dónde sale: la categoría o la sección que lo contiene, o el sector por defecto.
  from: SectorTargetType | "default";
}

const keyOf = (type: SectorTargetType, id: string) => `${type}:${id}`;

export function useMenuSectors(enabled: boolean) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [assignments, setAssignments] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listSectors()
      .then(data => {
        if (cancelled) return;
        setSectors(data.sectors);
        setAssignments(new Map(data.assignments.map(item => [keyOf(item.targetType, item.targetId), item.sectorId])));
      })
      // Sin la gestión de pedidos disponible, el editor sigue igual.
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  const byId = useMemo(() => new Map(sectors.map(sector => [sector.id, sector])), [sectors]);

  // Sector propio del elemento (null si hereda).
  const ownSector = useCallback((type: SectorTargetType, id: string | null | undefined): number | null => {
    if (!id) return null;
    const sectorId = assignments.get(keyOf(type, id));
    return sectorId !== undefined && byId.has(sectorId) ? sectorId : null;
  }, [assignments, byId]);

  // Lo que heredaría de lo que lo contiene (de adentro hacia afuera).
  const inherited = useCallback((parents: SectorLink[]): InheritedSector | null => {
    for (const parent of parents) {
      const sectorId = ownSector(parent.type, parent.id);
      if (sectorId !== null) return { sector: byId.get(sectorId)!, from: parent.type };
    }
    const fallback = sectors.find(sector => sector.isDefault) ?? sectors[0];
    return fallback ? { sector: fallback, from: "default" } : null;
  }, [byId, ownSector, sectors]);

  const assign = useCallback(async (type: SectorTargetType, id: string, sectorId: number | null) => {
    await setSectorAssignment(type, id, sectorId);
    setAssignments(prev => {
      const next = new Map(prev);
      if (sectorId === null) next.delete(keyOf(type, id));
      else next.set(keyOf(type, id), sectorId);
      return next;
    });
  }, []);

  return { sectors, ownSector, inherited, assign };
}
