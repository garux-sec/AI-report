import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const getHeaders = () => ({
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
})

export const sshApi = {
    getConfigs: async () => {
        const response = await axios.get(`${API_BASE_URL}/ssh-config`, getHeaders())
        return response.data
    },
    createConfig: async (data) => {
        const response = await axios.post(`${API_BASE_URL}/ssh-config`, data, getHeaders())
        return response.data
    },
    updateConfig: async (id, data) => {
        const response = await axios.put(`${API_BASE_URL}/ssh-config/${id}`, data, getHeaders())
        return response.data
    },
    deleteConfig: async (id) => {
        const response = await axios.delete(`${API_BASE_URL}/ssh-config/${id}`, getHeaders())
        return response.data
    },
    testConnection: async (data) => {
        const response = await axios.post(`${API_BASE_URL}/ssh-config/test`, data, getHeaders())
        return response.data
    },
    setDefault: async (id) => {
        const response = await axios.post(`${API_BASE_URL}/ssh-config/${id}/default`, {}, getHeaders())
        return response.data
    }
}
