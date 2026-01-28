<script setup>
import { ref, onMounted } from 'vue'
import { burpApi } from '../../api/burp'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'
import { useToast } from '../../composables/useToast'
import { useConfirm } from '../../composables/useConfirm'

const toast = useToast()
const { confirm } = useConfirm()

const configs = ref([])
const isLoading = ref(true)
const showModal = ref(false)
const editingConfig = ref(null)
const statuses = ref({}) // Store online status { id: { online, checking } }
const availableTools = ref({}) // Store tools per config { id: [tools] }
const isFetchingTools = ref({}) // Loading state per config

const loadTools = async (id) => {
  isFetchingTools.value[id] = true
  try {
    availableTools.value[id] = await burpApi.listTools(id)
  } catch (error) {
    console.error('Failed to load tools:', error)
  } finally {
    isFetchingTools.value[id] = false
  }
}

const checkStatus = async (config) => {
  statuses.value[config._id] = { online: false, checking: true }
  try {
    const result = await burpApi.testConnection({ url: config.url, apiKey: config.apiKey })
    statuses.value[config._id] = { online: result.online, checking: false }
    if (result.online && result.toolsCount > 0) {
      loadTools(config._id)
    }
  } catch (error) {
    statuses.value[config._id] = { online: false, checking: false }
  }
}

const checkAllStatuses = () => {
  configs.value.forEach(config => checkStatus(config))
}

const formData = ref({
  name: '',
  url: '',
  apiKey: ''
})

const loadConfigs = async () => {
  try {
    configs.value = await burpApi.getConfigs()
    checkAllStatuses()
  } catch (error) {
    console.error('Failed to load configs:', error)
    toast.error('Failed to load configs')
  } finally {
    isLoading.value = false
  }
}

const openModal = (config = null) => {
  if (config) {
    editingConfig.value = config
    formData.value = {
      name: config.name,
      url: config.url,
      apiKey: config.apiKey || ''
    }
  } else {
    editingConfig.value = null
    formData.value = { name: '', url: 'http://localhost:3000', apiKey: '' }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingConfig.value = null
}

const handleSubmit = async () => {
  try {
    if (editingConfig.value) {
      await burpApi.updateConfig(editingConfig.value._id, formData.value)
      toast.success('Burp connection updated')
    } else {
      await burpApi.createConfig(formData.value)
      toast.success('Burp connection created')
    }
    closeModal()
    loadConfigs()
  } catch (error) {
    toast.error(error.response?.data?.message || 'Error saving config')
  }
}

const deleteConfig = async (id) => {
  const confirmed = await confirm({
    title: 'Delete Connection?',
    message: 'Are you sure you want to delete this Burp MCP connection?',
    type: 'danger',
    confirmText: 'Delete'
  })

  if (!confirmed) return

  try {
    await burpApi.deleteConfig(id)
    toast.success('Connection deleted')
    loadConfigs()
  } catch (error) {
    console.error('Failed to delete config:', error)
    toast.error('Failed to delete config')
  }
}

const setDefault = async (id) => {
  try {
    await burpApi.setDefault(id)
    toast.success('Default connection updated')
    loadConfigs()
  } catch (error) {
    console.error('Failed to set default:', error)
    toast.error('Failed to set default')
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    <main class="main-content">
      <header class="page-header">
        <h1>Burp MCP Server Settings</h1>
        <button class="btn btn-primary" @click="openModal()">+ Add Connection</button>
      </header>

      <BentoGrid>
        <BentoCard title="Burp MCP Connections" :span="4">
          <div v-if="isLoading" class="text-center text-muted">Loading...</div>
          <div v-else-if="configs.length === 0" class="empty-state">
            <div class="empty-icon">🔌</div>
            <p>No Burp MCP connections configured.</p>
            <button class="btn btn-secondary mt-md" @click="openModal()">Add your first connection</button>
          </div>
          <div v-else class="config-grid">
            <div 
              v-for="config in configs" 
              :key="config._id"
              class="config-card"
              :class="{ default: config.isDefault }"
            >
              <div class="config-header">
                <span class="provider-icon">🛰️</span>
                <div class="config-info">
                  <div class="name-row">
                    <h4>{{ config.name }}</h4>
                    <div 
                      v-if="statuses[config._id]" 
                      class="status-dot-wrapper"
                      :title="statuses[config._id].checking ? 'Checking...' : (statuses[config._id].online ? 'Online' : 'Offline')"
                    >
                      <span class="status-dot" :class="{ online: statuses[config._id].online, checking: statuses[config._id].checking }"></span>
                      <span class="status-text">{{ statuses[config._id].checking ? 'Checking' : (statuses[config._id].online ? 'Online' : 'Offline') }}</span>
                    </div>
                  </div>
                  <span class="url-label">{{ config.url }}</span>
                </div>
                <span v-if="config.isDefault" class="badge-default">Default</span>
              </div>
              <div class="config-details">
                <p><strong>Status:</strong> <span :class="statuses[config._id]?.online ? 'text-success' : 'text-danger'">{{ statuses[config._id]?.online ? 'Online' : 'Offline' }}</span></p>
                <p><strong>Auth:</strong> {{ config.apiKey ? 'API Key Set' : 'None' }}</p>
              </div>

              <!-- Available Tools Section -->
              <div v-if="statuses[config._id]?.online" class="tools-section">
                <div class="tools-header">
                  <h5>🛠️ Available Tools</h5>
                  <button 
                    class="btn btn-text btn-xs" 
                    @click="loadTools(config._id)"
                    :disabled="isFetchingTools[config._id]"
                  >
                    {{ isFetchingTools[config._id] ? '⌛' : '🔄' }}
                  </button>
                </div>
                <div v-if="isFetchingTools[config._id]" class="tools-loading">Fetching tools...</div>
                <div v-else-if="availableTools[config._id]?.length" class="tools-list">
                  <span 
                    v-for="tool in availableTools[config._id]" 
                    :key="tool.name" 
                    class="tool-tag"
                    :title="tool.description"
                  >
                    {{ tool.name }}
                  </span>
                </div>
                <div v-else class="tools-empty">No tools reported by server</div>
              </div>

              <div class="config-actions">
                <button 
                  v-if="!config.isDefault"
                  class="btn btn-sm btn-secondary"
                  @click="setDefault(config._id)"
                >
                  Set Default
                </button>
                <button class="btn btn-sm btn-secondary" @click="openModal(config)">Edit</button>
                <button class="btn btn-sm btn-danger-icon" @click="deleteConfig(config._id)" title="Delete">🗑️</button>
              </div>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingConfig ? 'Edit Burp Connection' : 'Add Burp Connection' }}</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label class="form-label">Connection Name *</label>
            <input v-model="formData.name" type="text" class="input" placeholder="e.g. Local Burp" required />
          </div>
          <div class="form-group">
            <label class="form-label">Server URL *</label>
            <input v-model="formData.url" type="text" class="input" placeholder="e.g. http://localhost:3000" required />
            <p class="help-text">The address where your Burp MCP server is running.</p>
          </div>
          <div class="form-group">
            <label class="form-label">API Key / Token</label>
            <input v-model="formData.apiKey" type="password" class="input" placeholder="Optional security token" />
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary">{{ editingConfig ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout { display: flex; min-height: 100vh; }
.main-content { flex: 1; padding: var(--spacing-lg); overflow-y: auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); }
.page-header h1 { margin: 0; font-size: 1.75rem; }

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-md);
}

.config-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  transition: all 0.3s ease;
  position: relative;
}

.config-card.default {
  border-color: var(--primary-color);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
}

.config-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.provider-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.config-info h4 {
  margin: 0;
  font-size: 1.1rem;
  color: white;
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.status-dot-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.status-dot.checking {
  background: #3b82f6;
  animation: pulse 1.5s infinite;
}

.status-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

.url-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  word-break: break-all;
}

.badge-default {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  background: var(--primary-color);
  color: white;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 20px;
  font-weight: 600;
  text-transform: uppercase;
}

.config-details {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.config-details p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  display: flex;
  justify-content: space-between;
}

.config-details p + p {
  margin-top: 8px;
}

.config-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.btn-danger-icon {
  margin-left: auto;
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
}

.btn-danger-icon:hover {
  background: #ef4444;
  color: white;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
}

.help-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.mt-md { margin-top: var(--spacing-md); }
.text-danger { color: #f87171; }

.tools-section {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px dotted var(--glass-border);
}

.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.tools-header h5 {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-tag {
  font-size: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-color);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.tools-loading, .tools-empty {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

.btn-xs {
  font-size: 0.7rem;
  padding: 2px 4px;
}

.modal-footer { display: flex; gap: var(--spacing-sm); justify-content: flex-end; padding-top: var(--spacing-md); border-top: 1px solid var(--glass-border); margin-top: var(--spacing-md); }
</style>
