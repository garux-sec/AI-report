<script setup>
import { ref, reactive, onMounted } from 'vue'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'
import { sshApi } from '../../api/ssh'
import { useToast } from '../../composables/useToast'
import { useConfirm } from '../../composables/useConfirm'

const toast = useToast()
const { confirm } = useConfirm()

const configs = ref([])
const statusMap = reactive({})
const isLoading = ref(true)
const isSaving = ref(false)
const isTesting = ref(false)
const showModal = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  privateKey: '',
  passphrase: '',
  enabled: true
})

const fetchConfigs = async () => {
  isLoading.value = true
  try {
    configs.value = await sshApi.getConfigs()
    // Trigger status check for all
    checkAllStatuses()
  } catch (err) {
    toast.error('Failed to fetch SSH configurations')
  } finally {
    isLoading.value = false
  }
}

const checkAllStatuses = () => {
  configs.value.forEach(config => {
    // Initialize with persisted status
    if (config.lastStatus && config.lastStatus !== 'unknown') {
      statusMap[config._id] = config.lastStatus
    }
    
    if (config.enabled !== false) {
      checkStatus(config)
    } else {
      statusMap[config._id] = 'disabled'
    }
  })
}

const checkStatus = async (config) => {
  statusMap[config._id] = 'checking'
  try {
    const result = await sshApi.testConnection(config)
    const newStatus = result.success ? 'online' : 'offline'
    statusMap[config._id] = newStatus
    
    // Save status to database
    await sshApi.updateStatus(config._id, newStatus)
    config.lastStatus = newStatus
  } catch (err) {
    statusMap[config._id] = 'offline'
    await sshApi.updateStatus(config._id, 'offline')
    config.lastStatus = 'offline'
  }
}

const openAddModal = () => {
  editingId.value = null
  Object.assign(form, {
    name: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKey: '',
    passphrase: '',
    enabled: true
  })
  showModal.value = true
}

const openEditModal = (config) => {
  editingId.value = config._id
  Object.assign(form, {
    name: config.name,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password || '',
    privateKey: config.privateKey || '',
    passphrase: config.passphrase || '',
    enabled: config.enabled !== false
  })
  showModal.value = true
}

const saveConfig = async () => {
  if (!form.name || !form.host || !form.username) {
    toast.error('Please fill in all required fields')
    return
  }

  isSaving.value = true
  try {
    if (editingId.value) {
      await sshApi.updateConfig(editingId.value, form)
      toast.success('Configuration updated')
    } else {
      await sshApi.createConfig(form)
      toast.success('Configuration created')
    }
    showModal.value = false
    fetchConfigs()
  } catch (err) {
    toast.error('Failed to save configuration')
  } finally {
    isSaving.value = false
  }
}

const deleteConfig = async (id) => {
  const isConfirmed = await confirm({
    title: 'Delete SSH Configuration?',
    message: 'Are you sure you want to delete this configuration? This action cannot be undone.',
    type: 'danger',
    confirmText: 'Delete'
  })

  if (isConfirmed) {
    try {
      await sshApi.deleteConfig(id)
      toast.success('Configuration deleted')
      fetchConfigs()
    } catch (err) {
      toast.error('Failed to delete configuration')
    }
  }
}

const testConnection = async () => {
  if (!form.host || !form.username) {
    toast.error('Host and Username are required for testing')
    return
  }

  isTesting.value = true
  try {
    const result = await sshApi.testConnection(form)
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  } catch (err) {
    toast.error(err.response?.data?.message || 'Connection failed')
  } finally {
    isTesting.value = false
  }
}

const makeDefault = async (id) => {
  try {
    await sshApi.setDefault(id)
    toast.success('Default configuration set')
    fetchConfigs()
  } catch (err) {
    toast.error('Failed to set default configuration')
  }
}

const toggleEnabled = async (config) => {
  try {
    const newState = !config.enabled
    await sshApi.updateConfig(config._id, { enabled: newState })
    config.enabled = newState
    toast.success(newState ? 'Connection enabled' : 'Connection disabled')
    
    if (newState) {
      checkStatus(config)
    } else {
      statusMap[config._id] = 'disabled'
    }
  } catch (err) {
    toast.error('Failed to toggle status')
  }
}

onMounted(fetchConfigs)
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    <main class="main-content">
      <header class="page-header">
        <h1>SSH Configuration</h1>
        <button class="btn btn-primary" @click="openAddModal">+ Add Configuration</button>
      </header>

      <BentoGrid>
        <BentoCard title="SSH Machines" :span="4">
          <div v-if="isLoading" class="text-center text-muted">Loading...</div>
          <div v-else-if="configs.length === 0" class="empty-state">
            <p>No SSH configurations configured.</p>
          </div>
          <div v-else class="config-grid">
            <div 
              v-for="config in configs" 
              :key="config._id"
              class="config-card"
              :class="{ default: config.isDefault }"
            >
              <div class="config-header">
                <span class="provider-icon">💻</span>
                <div class="config-info">
                  <h4>{{ config.name }}</h4>
                  <div class="flex items-center gap-xs">
                    <span class="provider-label">Kali Linux</span>
                    <span class="status-dot" :class="statusMap[config._id] || 'unknown'" :title="statusMap[config._id]"></span>
                    <span class="status-text" :class="statusMap[config._id] || 'unknown'">
                      {{ statusMap[config._id] === 'checking' ? 'Checking...' : (statusMap[config._id] === 'online' ? 'Online' : (statusMap[config._id] === 'disabled' ? 'Disabled' : 'Offline')) }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-sm">
                  <label class="switch-sm" title="Enable/Disable Status Check">
                    <input type="checkbox" :checked="config.enabled !== false" @change="toggleEnabled(config)">
                    <span class="slider-sm"></span>
                  </label>
                  <span v-if="config.isDefault" class="badge badge-low">Default</span>
                </div>
              </div>
              <div class="config-details">
                <p><strong>Host:</strong> {{ config.host }}:{{ config.port }}</p>
                <p><strong>Username:</strong> {{ config.username }}</p>
              </div>
              <div class="config-actions">
                <button 
                  v-if="!config.isDefault"
                  class="btn btn-sm btn-secondary"
                  @click="makeDefault(config._id)"
                >
                  Set Default
                </button>
                <button class="btn btn-sm btn-secondary" @click="openEditModal(config)">Edit</button>
                <button class="btn btn-sm btn-danger" @click="deleteConfig(config._id)">Delete</button>
              </div>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingId ? 'Edit Configuration' : 'Add Configuration' }}</h2>
          <button class="modal-close" @click="showModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Name (Label)</label>
            <input v-model="form.name" type="text" class="input" placeholder="e.g. My Kali Machine" />
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Host</label>
              <input v-model="form.host" type="text" class="input" placeholder="127.0.0.1" />
            </div>
            <div class="form-group" style="width: 100px;">
              <label class="form-label">Port</label>
              <input v-model.number="form.port" type="number" class="input" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Username</label>
            <input v-model="form.username" type="text" class="input" placeholder="kali" />
          </div>
          <div class="form-group">
            <label class="form-label">Password (Optional if using SSH Key)</label>
            <input v-model="form.password" type="password" class="input" placeholder="••••••••" />
          </div>
          <div class="form-group">
            <label class="form-label">Private Key (Optional)</label>
            <textarea v-model="form.privateKey" class="textarea code-font" rows="5" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"></textarea>
          </div>
          <div class="form-group" v-if="form.privateKey">
            <label class="form-label">Key Passphrase</label>
            <input v-model="form.passphrase" type="password" class="input" placeholder="••••••••" />
          </div>
          <div class="form-group">
            <label class="flex items-center gap-sm cursor-pointer">
              <div class="switch">
                <input type="checkbox" v-model="form.enabled">
                <span class="slider round"></span>
              </div>
              <span class="form-label mb-0">Enable Status Monitoring</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="testConnection" :disabled="isTesting">
            {{ isTesting ? 'Testing...' : 'Test Connection' }}
          </button>
          <div class="flex gap-sm">
            <button class="btn btn-outline" @click="showModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveConfig" :disabled="isSaving">
              {{ isSaving ? 'Save' : 'Save Configuration' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout { display: flex; min-height: 100vh; }
.main-content { flex: 1; padding: var(--spacing-lg); overflow-y: auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); }
.page-header h1 { margin: 0; }

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.config-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.config-card.default {
  border-color: var(--success-color);
}

.config-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.provider-icon {
  font-size: 1.5rem;
}

.config-info {
  flex: 1;
}

.config-info h4 {
  margin: 0;
  font-size: 1rem;
}

.provider-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot.online { background: var(--success-color); box-shadow: 0 0 8px var(--success-color); }
.status-dot.offline { background: var(--danger-color); }
.status-dot.checking { background: var(--warning-color); animation: pulse 1.5s infinite; }
.status-dot.disabled { background: #64748b; opacity: 0.5; }

.status-text {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-text.online { color: var(--success-color); }
.status-text.offline { color: var(--danger-color); }
.status-text.checking { color: var(--warning-color); }
.status-text.disabled { color: #64748b; }

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Switch Styles */
.switch-sm {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.switch-sm input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider-sm {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.1);
  transition: .4s;
  border-radius: 18px;
  border: 1px solid var(--glass-border);
}

.slider-sm:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider-sm {
  background-color: var(--success-color);
}

input:checked + .slider-sm:before {
  transform: translateX(14px);
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.1);
  transition: .4s;
  border: 1px solid var(--glass-border);
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.mb-0 { margin-bottom: 0 !important; }

.config-details {
  margin-bottom: var(--spacing-md);
  font-size: 0.9rem;
}

.config-details p {
  margin: 0 0 var(--spacing-xs);
  color: var(--text-muted);
}

.config-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.form-grid {
  display: flex;
  gap: 1rem;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
}

.modal-footer { display: flex; gap: var(--spacing-sm); justify-content: flex-end; padding-top: var(--spacing-md); border-top: 1px solid var(--glass-border); margin-top: var(--spacing-md); }
</style>
