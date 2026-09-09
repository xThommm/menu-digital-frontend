import apiClient from './client'
import type {
  CrmAttentionSummary,
  CrmClient,
  CrmClientDetail,
  CrmProfile,
  CrmStage,
  CrmSummary,
} from '../types'

// ── CRM (el JWT lo adjunta el interceptor de client) ──
// Vive bajo /api/sellers/crm: lo maneja tanto un admin (ve todo) como cada
// vendedor (ve y edita solo sus propios clientes atribuidos — el scoping real
// vive en el backend, protectSellerOrAdminAny + crmController).

// GET /api/sellers/crm/clients → lista de clientes con su etapa de CRM
export const listCrmClients = async (): Promise<{
  clients: CrmClient[]
  stages: CrmStage[]
  attentionSummary?: CrmAttentionSummary
}> => {
  const res = await apiClient.get('/sellers/crm/clients')
  return res.data
}

// GET /api/sellers/crm/summary → resumen ejecutivo para el dashboard del CEO
// (totales/altas del mes/breakdown por plan livianos + attentionSummary de
// listClients) — admin-only, no trae la ficha completa de cada cliente.
export const getCrmSummary = async (): Promise<CrmSummary> => {
  const res = await apiClient.get('/sellers/crm/summary')
  return res.data
}

// GET /api/sellers/crm/clients/:userID → detalle (user + crm + actividad)
export const getCrmClient = async (userID: string): Promise<CrmClientDetail> => {
  const res = await apiClient.get(`/sellers/crm/clients/${userID}`)
  return res.data
}

// PATCH /api/admin/users/:userID/active → activa o desactiva una cuenta
// (admin-only: gated por `protect`, que solo resuelve contra User — un
// vendedor nunca lo alcanza)
export const setCrmClientActive = async (userID: string, active: boolean): Promise<boolean> => {
  const res = await apiClient.patch(`/admin/users/${userID}/active`, { active })
  return res.data.user.active
}

// PATCH /api/sellers/crm/clients/:userID → actualiza etapa / tags / próximo seguimiento
export const updateCrmProfile = async (
  userID: string,
  data: Partial<Pick<CrmProfile, 'stage' | 'tags' | 'nextFollowUp'>>
): Promise<CrmProfile> => {
  const res = await apiClient.patch(`/sellers/crm/clients/${userID}`, data)
  return res.data
}

// POST /api/sellers/crm/clients/:userID/notes → agrega una nota
export const addCrmNote = async (userID: string, text: string): Promise<CrmProfile> => {
  const res = await apiClient.post(`/sellers/crm/clients/${userID}/notes`, { text })
  return res.data
}

// DELETE /api/sellers/crm/clients/:userID/notes/:noteID → borra una nota
export const deleteCrmNote = async (userID: string, noteID: string): Promise<CrmProfile> => {
  const res = await apiClient.delete(`/sellers/crm/clients/${userID}/notes/${noteID}`)
  return res.data
}

// GET /api/sellers/crm/overdue-count → cantidad de clientes con seguimiento vencido (badge del sidebar)
export const getCrmOverdueCount = async (): Promise<number> => {
  const res = await apiClient.get('/sellers/crm/overdue-count')
  return res.data.count
}

// GET /api/sellers/crm/export → descarga el listado (opcionalmente filtrado por etapa) como .xlsx (admin-only)
export const exportCrmClients = async (stage?: CrmStage | 'all'): Promise<Blob> => {
  const res = await apiClient.get('/sellers/crm/export', {
    params: stage && stage !== 'all' ? { stage } : undefined,
    responseType: 'blob',
  })
  return res.data
}
