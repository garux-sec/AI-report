import api from './index'

export const projectsApi = {
    getAll: () =>
        api.get('/projects'),

    getById: (id) =>
        api.get(`/projects/${id}`),

    create: (formData) =>
        api.post('/projects', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    update: (id, formData) =>
        api.put(`/projects/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    delete: (id) =>
        api.delete(`/projects/${id}`),

    clone: (id) =>
        api.post(`/projects/${id}/clone`)
}
