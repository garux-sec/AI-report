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
        api.post(`/projects/${id}/clone`),

    // Target Management
    addTarget: (projectId, target) =>
        api.post(`/projects/${projectId}/targets`, target),

    updateTarget: (projectId, targetId, target) =>
        api.put(`/projects/${projectId}/targets/${targetId}`, target),

    deleteTarget: (projectId, targetId) =>
        api.delete(`/projects/${projectId}/targets/${targetId}`),

    importTargets: (projectId, targets) =>
        api.post(`/projects/${projectId}/targets/import`, { targets })
}
