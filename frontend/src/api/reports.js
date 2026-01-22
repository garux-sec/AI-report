import api from './index'

export const reportsApi = {
    getAll: (params = {}) =>
        api.get('/reports', { params }),

    getById: (id) =>
        api.get(`/reports/${id}`),

    create: (data) =>
        api.post('/reports', data),

    update: (id, data) =>
        api.put(`/reports/${id}`, data),

    delete: (id) =>
        api.delete(`/reports/${id}`),

    generatePDF: (id) =>
        api.get(`/reports/${id}/pdf`, { responseType: 'blob' }),

    getAllTags: () =>
        api.get('/reports/tags'),

    getDashboardStats: () =>
        api.get('/dashboard-stats'),

    getKpiStats: (params = {}) =>
        api.get('/kpi-stats', { params })
}
