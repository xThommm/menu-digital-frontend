import apiClient from './client'
import type { Item, ItemLite, ImageAssignChange, ImageAssignResponse } from '../types'

// ── Todas privadas (requieren JWT) ────────────

// POST /api/items  →  crea un nuevo producto en una categoría
export const createItem = async (data: {
  menuID: string
  title: string
  description?: string
  price?: number | null
  offerPrice?: number | null
  offerRange?: { from: string | null; to: string | null }
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

// PATCH /api/items/:itemID/move  →  mueve el item a otra categoría
export const moveItem = async (itemID: string, menuID: string): Promise<Item> => {
  const res = await apiClient.patch<Item>(`/items/${itemID}/move`, { menuID })
  return res.data
}

// DELETE /api/items/:itemID  →  elimina el item
export const deleteItem = async (itemID: string): Promise<{ message: string }> => {
  const res = await apiClient.delete<{ message: string }>(`/items/${itemID}`)
  return res.data
}

// POST /api/items/:itemID/upload-image  (multipart/form-data)
export const uploadItemImage = async (
  itemID: string,
  file: File
): Promise<{ imageUrl: string; item: Item }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await apiClient.post(`/items/${itemID}/upload-image`, form)
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

// ── Gestor de imágenes ─────────────────────────────────────────────────────

// GET /api/items/lite  →  productos del usuario, solo los campos que
// necesita el buscador del Gestor de imágenes (nombre/código/imagen actual)
export const getLiteItems = async (): Promise<ItemLite[]> => {
  const res = await apiClient.get<ItemLite[]>('/items/lite')
  return res.data
}

// GET /api/items/images/pending  →  imágenes subidas y todavía sin asignar
export const getPendingImages = async (): Promise<string[]> => {
  const res = await apiClient.get<{ pendingImages: string[] }>('/items/images/pending')
  return res.data.pendingImages
}

// POST /api/items/images/upload  (multipart/form-data)  →  sube una imagen
// al gestor sin asignarla todavía a ningún producto
export const uploadLibraryImage = async (file: File): Promise<{ imageUrl: string }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await apiClient.post<{ imageUrl: string }>('/items/images/upload', form)
  return res.data
}

// POST /api/items/images/assign  →  guarda de una vez las asignaciones
// imagen→producto(s) hechas en el gestor
export const assignLibraryImages = async (changes: ImageAssignChange[]): Promise<ImageAssignResponse> => {
  const res = await apiClient.post<ImageAssignResponse>('/items/images/assign', { changes })
  return res.data
}
