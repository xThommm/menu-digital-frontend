import apiClient from './client'
import type { Item } from '../types'

// ── Todas privadas (requieren JWT) ────────────

// POST /api/items  →  crea un nuevo producto en una categoría
export const createItem = async (data: {
  menuID: string
  title: string
  description?: string
  price?: number | null
  offerPrice?: number | null
  offerDate?: string | null
  options?: Record<string, number>
  isExtra?: boolean
  recommended?: boolean
  code?: string
  apt?: Record<string, unknown>
}): Promise<Item> => {
  const res = await apiClient.post<Item>('/items', data)
  return res.data
}

// PUT /api/items/:itemID  →  edita un producto existente
export const updateItem = async (
  itemID: string,
  data: Partial<Omit<Item, '_id' | 'menuID' | 'createdAt' | 'updatedAt'>>
): Promise<Item> => {
  const res = await apiClient.put<Item>(`/items/${itemID}`, data)
  return res.data
}

// PUT /api/items/massive  →  actualización en lote
// Útil para reordenar o cambiar precios de múltiples items a la vez
export const updateItemsMassive = async (
  items: Array<{ _id: string } & Partial<Item>>
): Promise<Item[]> => {
  const res = await apiClient.put<Item[]>('/items/massive', { items })
  return res.data
}

// POST /api/items/:itemID/upload-image  (multipart/form-data)
export const uploadItemImage = async (
  itemID: string,
  file: File
): Promise<{ imageUrl: string; item: Item }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await apiClient.post(`/items/${itemID}/upload-image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// PATCH /api/items/:itemID/hidden
export const setItemHidden = async (
  itemID: string,
  hidden: boolean
): Promise<{ hidden: boolean }> => {
  const res = await apiClient.patch(`/items/${itemID}/hidden`, { hidden })
  return res.data
}

// PATCH /api/items/:itemID/available
export const setItemAvailable = async (
  itemID: string,
  available: boolean
): Promise<{ available: boolean }> => {
  const res = await apiClient.patch(`/items/${itemID}/available`, { available })
  return res.data
}
