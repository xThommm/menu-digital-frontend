import apiClient from './client'
import type { MassivePreviewResponse, MassiveConfirmResponse } from '../types'

// ── Todas privadas (requieren JWT) ────────────

// GET /api/massive/template  →  descarga el Excel con categorías y productos actuales
// responseType 'blob' es necesario porque el backend devuelve un archivo binario (.xlsx),
// no JSON — sin esto axios intenta parsear el binario como JSON y falla.
export const downloadMassiveTemplate = async (): Promise<Blob> => {
  const res = await apiClient.get('/massive/template', { responseType: 'blob' })
  return res.data
}

// POST /api/massive/preview  →  procesa el Excel y devuelve el resumen de cambios (sin guardar nada)
export const previewMassiveImport = async (file: File): Promise<MassivePreviewResponse> => {
  const form = new FormData()
  form.append('archivo', file)
  // No seteamos Content-Type manualmente: el browser/axios calcula el boundary
  // del multipart automáticamente. Forzarlo a mano rompe el parseo en el backend (multer).
  const res = await apiClient.post<MassivePreviewResponse>('/massive/preview', form)
  return res.data
}

// POST /api/massive/confirm  →  aplica los cambios fila por fila
export const confirmMassiveImport = async (file: File): Promise<MassiveConfirmResponse> => {
  const form = new FormData()
  form.append('archivo', file)
  const res = await apiClient.post<MassiveConfirmResponse>('/massive/confirm', form)
  return res.data
}

// ── Helper de descarga de archivo en el navegador ────────────
// Dispara la descarga del blob como si fuera un link <a download>.
export const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}