import apiClient from './client'
import type { Menu, PublicMenuResponse } from '../types'

// ── Públicas ───────────────────────────────────

// GET /api/menus/public/:slug
// Devuelve { user, menus } — el punto de entrada principal de la vista pública
export const fetchPublicMenu = async (slug: string): Promise<PublicMenuResponse> => {
  const res = await apiClient.get<PublicMenuResponse>(`/menus/public/${slug}`)
  return res.data
}

// ── Privadas (requieren JWT) ───────────────────

// POST /api/menus  →  crea una nueva categoría
export const createMenu = async (data: {
  title: string
  description?: string
  code?: string
  sectionID?: string | null
  section?: boolean
}): Promise<Menu> => {
  const res = await apiClient.post<Menu>('/menus', data)
  return res.data
}

// PUT /api/menus/:menuID  →  edita una categoría existente
export const updateMenu = async (
  menuID: string,
  data: Partial<Pick<Menu, 'title' | 'description' | 'code' | 'sectionID' | 'section' | 'image'>>
): Promise<Menu> => {
  const res = await apiClient.put<Menu>(`/menus/${menuID}`, data)
  return res.data
}

// PUT /api/menus/hide/:menuID  →  oculta/muestra la categoría en la vista pública
export const hideMenu = async (menuID: string, hidden: boolean): Promise<Menu> => {
  const res = await apiClient.put<Menu>(`/menus/hide/${menuID}`, { hidden })
  return res.data
}

// POST /api/menus/:menuID/upload-image  (multipart/form-data)
export const uploadMenuImage = async (
  menuID: string,
  file: File
): Promise<{ imageUrl: string; menu: Menu }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await apiClient.post(`/menus/${menuID}/upload-image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
