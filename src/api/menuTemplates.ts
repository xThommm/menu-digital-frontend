import apiClient from './client'
import type { MenuTemplatesData, CopyMenuTemplatesPayload, CopyMenuTemplatesResponse } from '../types'

// ── Plantillas de menú (Trello "Plantillas de menúes") ──────────────────────
// Privadas (requieren JWT + plan Basic/Pro, ver feature "menu_templates")

// GET /api/menu-templates  →  catálogo de solo lectura del usuario plantilla
export const getMenuTemplates = async (): Promise<MenuTemplatesData> => {
  const res = await apiClient.get<MenuTemplatesData>('/menu-templates')
  return res.data
}

// POST /api/menu-templates/copy  →  copia la selección al menú propio
export const copyMenuTemplates = async (
  payload: CopyMenuTemplatesPayload
): Promise<CopyMenuTemplatesResponse> => {
  const res = await apiClient.post<CopyMenuTemplatesResponse>('/menu-templates/copy', payload)
  return res.data
}
