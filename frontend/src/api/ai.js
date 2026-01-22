import api from './index'

export const aiApi = {
    getConfigs: () =>
        api.get('/ai-config'),

    createConfig: (data) =>
        api.post('/ai-config', data),

    updateConfig: (id, data) =>
        api.put(`/ai-config/${id}`, data),

    deleteConfig: (id) =>
        api.delete(`/ai-config/${id}`),

    setDefault: (id) =>
        api.post(`/ai-config/${id}/default`),

    fetchModels: (data) =>
        api.post('/ai-config/fetch-models', data),

    generateText: (data) =>
        api.post('/ai/generate', data)
}
