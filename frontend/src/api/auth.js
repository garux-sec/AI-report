import axios from 'axios'

// Auth uses different base path
const authAxios = axios.create({
    baseURL: '',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

export const authApi = {
    login: (username, password) =>
        authAxios.post('/auth/login', { username, password }).then(res => res.data),

    register: (username, password) =>
        authAxios.post('/auth/register', { username, password }).then(res => res.data),

    getMe: () => {
        const token = localStorage.getItem('token')
        return authAxios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.data)
    }
}

