import api from './index'

export const sshApi = {
    getAll: () => api.get('/ssh-config'),
    getConfigs: () => api.get('/ssh-config'),
    createConfig: (data) => api.post('/ssh-config', data),
    updateConfig: (id, data) => api.put(`/ssh-config/${id}`, data),
    deleteConfig: (id) => api.delete(`/ssh-config/${id}`),
    testConnection: (data) => api.post('/ssh-config/test', data),
    setDefault: (id) => api.post(`/ssh-config/${id}/default`),
    updateStatus: (id, status) => api.put(`/ssh-config/${id}`, { lastStatus: status, lastChecked: new Date() })
}
