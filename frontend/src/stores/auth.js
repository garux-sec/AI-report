import { defineStore } from 'pinia'
import { authApi } from '../api/auth'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token') || null,
        user: JSON.parse(localStorage.getItem('user') || 'null')
    }),

    getters: {
        isAuthenticated: (state) => !!state.token,
        isAdmin: (state) => state.user?.role === 'admin',
        username: (state) => state.user?.username || 'User'
    },

    actions: {
        async login(username, password) {
            try {
                const response = await authApi.login(username, password)
                this.token = response.token
                this.user = response.user
                localStorage.setItem('token', response.token)
                localStorage.setItem('user', JSON.stringify(response.user))
                return { success: true }
            } catch (error) {
                return { success: false, message: error.response?.data?.message || 'Login failed' }
            }
        },

        async register(username, password) {
            try {
                const response = await authApi.register(username, password)
                this.token = response.token
                this.user = response.user
                localStorage.setItem('token', response.token)
                localStorage.setItem('user', JSON.stringify(response.user))
                return { success: true }
            } catch (error) {
                return { success: false, message: error.response?.data?.message || 'Registration failed' }
            }
        },

        logout() {
            this.token = null
            this.user = null
            localStorage.removeItem('token')
            localStorage.removeItem('user')
        },

        async fetchCurrentUser() {
            if (!this.token) return null
            try {
                const user = await authApi.getMe()
                this.user = user
                localStorage.setItem('user', JSON.stringify(user))
                return user
            } catch (error) {
                this.logout()
                return null
            }
        }
    }
})
