import api from './index'

export const usersApi = {
    getAll: () =>
        api.get('/users'),

    create: (data) =>
        api.post('/users', data),

    update: (id, data) =>
        api.put(`/users/${id}`, data),

    delete: (id) =>
        api.delete(`/users/${id}`)
}

export const kpiApi = {
    getSettings: (params = {}) =>
        api.get('/kpi/settings', { params }),

    saveSettings: (data) =>
        api.post('/kpi/settings', data),

    getUsers: () =>
        api.get('/kpi/users')
}
