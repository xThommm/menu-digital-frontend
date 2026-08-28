import apiClient from './client'
import type { CrmClient, CrmClientDetail, CrmProfile, CrmStage } from '../types'

// ── CRM interno (todas admin-only; el JWT lo adjunta el interceptor de client) ──

// GET /api/admin/crm/clients → lista de clientes con su etapa de CRM
export const listCrmClients = async (): Promise<{ clients: CrmClient[]; stages: CrmStage[] }> => {
  const res = await apiClient.get('/admin/crm/clients')
  return res.data
}

// GET /api/admin/crm/clients/:userID → detalle (user + crm + actividad)
export const getCrmClient = async (userID: string): Promise<CrmClientDetail> => {
  const res = await apiClient.get(`/admin/crm/clients/${userID}`)
  return res.data
}

// PATCH /api/admin/users/:userID/active → activa o desactiva una cuenta
export const setCrmClientActive = async (userID: string, active: boolean): Promise<boolean> => {
  const res = await apiClient.patch(`/admin/users/${userID}/active`, { active })
  return res.data.user.active
}

// PATCH /api/admin/crm/clients/:userID → actualiza etapa / tags / próximo seguimiento
export const updateCrmProfile = async (
  userID: string,
  data: Partial<Pick<CrmProfile, 'stage' | 'tags' | 'nextFollowUp'>>
): Promise<CrmProfile> => {
  const res = await apiClient.patch(`/admin/crm/clients/${userID}`, data)
  return res.data
}

// POST /api/admin/crm/clients/:userID/notes → agrega una nota
export const addCrmNote = async (userID: string, text: string): Promise<CrmProfile> => {
  const res = await apiClient.post(`/admin/crm/clients/${userID}/notes`, { text })
  return res.data
}

// DELETE /api/admin/crm/clients/:userID/notes/:noteID → borra una nota
export const deleteCrmNote = async (userID: string, noteID: string): Promise<CrmProfile> => {
  const res = await apiClient.delete(`/admin/crm/clients/${userID}/notes/${noteID}`)
  return res.data
}

// GET /api/admin/crm/overdue-count → cantidad de clientes con seguimiento vencido (badge del sidebar)
export const getCrmOverdueCount = async (): Promise<number> => {
  const res = await apiClient.get('/admin/crm/overdue-count')
  return res.data.count
}

// GET /api/admin/crm/export → descarga el listado (opcionalmente filtrado por etapa) como .xlsx
export const exportCrmClients = async (stage?: CrmStage | 'all'): Promise<Blob> => {
  const res = await apiClient.get('/admin/crm/export', {
    params: stage && stage !== 'all' ? { stage } : undefined,
    responseType: 'blob',
  })
  return res.data
}
