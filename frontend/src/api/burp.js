import api from './index'

export const burpApi = {
    getConfigs: () =>
        api.get('/burp-config'),

    createConfig: (data) =>
        api.post('/burp-config', data),

    updateConfig: (id, data) =>
        api.put(`/burp-config/${id}`, data),

    deleteConfig: (id) =>
        api.delete(`/burp-config/${id}`),

    setDefault: (id) =>
        api.post(`/burp-config/${id}/default`),

    testConnection: (data) =>
        api.post('/burp-config/test', data),

    listTools: (id) =>
        api.get(`/burp-config/${id}/tools`),

    analyzeHistory: (data) =>
        api.post('/burp-config/analyze-history', data)
}
