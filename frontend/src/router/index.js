import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Login',
        component: () => import('../views/LoginView.vue')
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/projects',
        name: 'Projects',
        component: () => import('../views/ProjectsView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/project/:id',
        name: 'ProjectDashboard',
        component: () => import('../views/ProjectDashboardView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/report/:id/edit',
        name: 'ReportEdit',
        component: () => import('../views/ReportEditView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/report/:id/view',
        name: 'ReportView',
        component: () => import('../views/ReportViewView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/settings/users',
        name: 'Users',
        component: () => import('../views/settings/UsersView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/settings/frameworks',
        name: 'Frameworks',
        component: () => import('../views/settings/FrameworksView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/settings/ai-connections',
        name: 'AiConnections',
        component: () => import('../views/settings/AiConnectionsView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/settings/kpi',
        name: 'KpiSettings',
        component: () => import('../views/settings/KpiView.vue'),
        meta: { requiresAuth: true }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Navigation guard for authentication
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token')

    if (to.meta.requiresAuth && !token) {
        next({ name: 'Login' })
    } else if (to.name === 'Login' && token) {
        next({ name: 'Dashboard' })
    } else {
        next()
    }
})

export default router
