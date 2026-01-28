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

    getTarget: (projectId, targetId) =>
        api.get(`/projects/${projectId}/targets/${targetId}`),

    updateTarget: (projectId, targetId, target) =>
        api.put(`/projects/${projectId}/targets/${targetId}`, target),

    deleteTarget: (projectId, targetId) =>
        api.delete(`/projects/${projectId}/targets/${targetId}`),

    importTargets: (projectId, targets) =>
        api.post(`/projects/${projectId}/targets/import`, { targets }),

    // Target Notes & Commands
    updateTargetNotes: (projectId, targetId, notes) =>
        api.put(`/projects/${projectId}/targets/${targetId}/notes`, { notes }),

    saveCommandResult: (projectId, targetId, result) =>
        api.post(`/projects/${projectId}/targets/${targetId}/command`, result),

    // Execute command via Kali Runner
    executeCommand: (configId, command) =>
        api.post('/ssh-config/execute', { configId, command }),

    // Target Images
    uploadTargetImage: (projectId, targetId, formData) =>
        api.post(`/projects/${projectId}/targets/${targetId}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    deleteTargetImage: (projectId, targetId, imageId) =>
        api.delete(`/projects/${projectId}/targets/${targetId}/images/${imageId}`),

    toggleTargetStar: (projectId, targetId) =>
        api.put(`/projects/${projectId}/targets/${targetId}/star`)
}
