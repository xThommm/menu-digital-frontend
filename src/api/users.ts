import apiClient from './client'
import type { User, AuthResponse } from '../types'

// ── Públicas ───────────────────────────────────

// POST /api/users/register
export const register = async (data: {
  username: string
  password: string
  contactInfo?: Partial<User['contactInfo']>
}): Promise<AuthResponse> => {
  const res = await apiClient.post<AuthResponse>('/users/register', data)
  return res.data
}

// POST /api/users/login
export const login = async (data: {
  username: string
  password: string
}): Promise<AuthResponse> => {
  const res = await apiClient.post<AuthResponse>('/users/login', data)
  return res.data
}

// GET /api/users/:slug  →  datos públicos de un local (landing page)
export const fetchUserBySlug = async (slug: string): Promise<User> => {
  const res = await apiClient.get<User>(`/users/${slug}`)
  return res.data
}

// ── Privadas (requieren JWT) ───────────────────

// GET /api/users/me
export const getMe = async (): Promise<User> => {
  const res = await apiClient.get<User>('/users/me')
  return res.data
}

// PUT /api/users/me
export const updateMe = async (
  data: Partial<Pick<User, 'contactInfo' | 'hasDelivery' | 'media' | 'template'>>
): Promise<User> => {
  const res = await apiClient.put<User>('/users/me', data)
  return res.data
}

// POST /api/users/upload-image  (multipart/form-data)
// Devuelve { imageUrl, media }
export const uploadUserImage = async (
  file: File
): Promise<{ imageUrl: string; media: User['media'] }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await apiClient.post('/users/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// PATCH /api/users/template
export const setTemplate = async (template: number): Promise<{ template: number }> => {
  const res = await apiClient.patch('/users/template', { template })
  return res.data
}

// PATCH /api/users/active
export const setActive = async (active: boolean): Promise<{ active: boolean }> => {
  const res = await apiClient.patch('/users/active', { active })
  return res.data
}
