import api from './index'

export const frameworksApi = {
    getAll: () =>
        api.get('/frameworks'),

    create: (data) =>
        api.post('/frameworks', data),

    update: (id, data) =>
        api.put(`/frameworks/${id}`, data),

    delete: (id) =>
        api.delete(`/frameworks/${id}`)
}
