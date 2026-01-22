<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const settingsExpanded = ref(true)

const toggleSettings = () => {
  settingsExpanded.value = !settingsExpanded.value
}

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/projects', icon: '📁', label: 'Projects' }
]

const settingsItems = [
  { path: '/settings/users', icon: '👥', label: 'Users' },
  { path: '/settings/frameworks', icon: '🔧', label: 'Frameworks' },
  { path: '/settings/ai-connections', icon: '🤖', label: 'AI Connections' },
  { path: '/settings/kpi', icon: '📈', label: 'KPI Settings' }
]

const isActive = (path) => route.path === path

const logout = () => {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2 class="logo-text">AI Report</h2>
    </div>

    <nav class="sidebar-nav">
      <!-- Main Navigation -->
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-link"
        :class="{ active: isActive(item.path) }"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>

      <!-- Settings Group -->
      <div class="nav-group">
        <div class="nav-link-header" @click="toggleSettings">
          <span class="flex items-center gap-sm">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Settings</span>
          </span>
          <span class="arrow" :class="{ collapsed: !settingsExpanded }">▼</span>
        </div>
        <div class="submenu" :class="{ collapsed: !settingsExpanded }">
          <router-link
            v-for="item in settingsItems"
            :key="item.path"
            :to="item.path"
            class="nav-sub-link"
            :class="{ active: isActive(item.path) }"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </router-link>
        </div>
      </div>
    </nav>

    <button class="logout-btn" @click="logout">
      Logout
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  min-height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  border-right: 1px solid var(--glass-border);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  margin-bottom: 2rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-link:hover,
.nav-link.active {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.nav-group {
  margin-top: 0.5rem;
}

.nav-link-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  color: var(--text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-link-header:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.submenu {
  margin-left: 0.5rem;
  padding-left: 0.5rem;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 500px;
  overflow: hidden;
  transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
  opacity: 1;
}

.submenu.collapsed {
  max-height: 0;
  opacity: 0;
}

.nav-sub-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.2s;
  border-radius: 6px;
  margin-bottom: 2px;
}

.nav-sub-link:hover,
.nav-sub-link.active {
  color: var(--primary-color);
  background: rgba(99, 102, 241, 0.1);
}

.arrow {
  font-size: 0.75rem;
  transition: transform 0.3s ease;
}

.arrow.collapsed {
  transform: rotate(-90deg);
}

.logout-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border: none;
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  padding: 1rem 1.5rem;
  font-size: 1rem;
  letter-spacing: 0.05em;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3);
  transition: all 0.3s ease;
}

.logout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);
}

.nav-icon {
  font-size: 1rem;
}
</style>
