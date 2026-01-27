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
        <div>
          <h1>Kali Command Runner</h1>
          <p class="page-subtitle">Connect to Kali machines for executing penetration testing commands</p>
        </div>
        <button class="btn btn-primary" @click="openAddModal">+ Add Kali Machine</button>
      </header>

      <BentoGrid>
        <BentoCard title="Connected Kali Machines" :span="4">
          <div v-if="isLoading" class="text-center text-muted">Loading...</div>
          <div v-else-if="configs.length === 0" class="empty-state">
            <p>No Kali machines configured. Add one to start running commands remotely.</p>
          </div>
          <div v-else class="config-grid">
            <div 
              v-for="config in configs" 
              :key="config._id"
              class="config-card"
              :class="{ default: config.isDefault, disabled: config.enabled === false }"
            >
              <div class="config-header">
                <div class="machine-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="4" width="20" height="12" rx="2"/>
                    <line x1="6" y1="20" x2="18" y2="20"/>
                    <line x1="12" y1="16" x2="12" y2="20"/>
                  </svg>
                </div>
                <div class="config-info">
                  <h4>{{ config.name }}</h4>
                  <span class="provider-label">Kali Linux</span>
                </div>
                <div class="header-badges">
                  <span v-if="config.isDefault" class="badge badge-primary">Default</span>
                  <div class="status-badge" :class="statusMap[config._id] || 'unknown'">
                    <span class="status-dot-badge"></span>
                    <span class="status-label">
                      {{ statusMap[config._id] === 'checking' ? 'Checking' : (statusMap[config._id] === 'online' ? 'Online' : (statusMap[config._id] === 'disabled' ? 'Disabled' : 'Offline')) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="config-details">
                <div class="detail-row">
                  <span class="detail-icon">🌐</span>
                  <span class="detail-value">{{ config.host }}:{{ config.port }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-icon">👤</span>
                  <span class="detail-value">{{ config.username }}</span>
                </div>
              </div>

              <div class="config-footer">
                <label class="toggle-wrapper" title="Enable/Disable Status Check">
                  <input type="checkbox" :checked="config.enabled !== false" @change="toggleEnabled(config)">
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">{{ config.enabled !== false ? 'Enabled' : 'Disabled' }}</span>
                </label>
                <div class="config-actions">
                  <button 
                    v-if="!config.isDefault"
                    class="btn-icon" 
                    @click="makeDefault(config._id)"
                    title="Set as Default"
                  >
                    ⭐
                  </button>
                  <button class="btn-icon" @click="openEditModal(config)" title="Edit">
                    ✏️
                  </button>
                  <button class="btn-icon btn-danger" @click="deleteConfig(config._id)" title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingId ? 'Edit Kali Machine' : 'Add Kali Machine' }}</h2>
          <button class="modal-close" @click="showModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Machine Name</label>
            <input v-model="form.name" type="text" class="input" placeholder="e.g. Kali-Primary, Pentest-Box" />
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
.page-subtitle { 
  margin: 0.5rem 0 0; 
  font-size: 0.9rem; 
  color: var(--text-muted); 
  font-weight: 400;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.config-card {
  position: relative;
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  overflow: hidden;
}

.config-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-color), #818cf8);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.config-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.config-card:hover::before {
  opacity: 1;
}

.config-card.default {
  border-color: var(--success-color);
}

.config-card.default::before {
  background: linear-gradient(90deg, var(--success-color), #34d399);
  opacity: 1;
}

.config-card.disabled {
  opacity: 0.6;
}

/* Status Badge */
.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.online {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-badge.offline {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-badge.checking {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-badge.disabled {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.status-dot-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge.online .status-dot-badge {
  box-shadow: 0 0 8px currentColor;
  animation: glow 2s ease-in-out infinite;
}

.status-badge.checking .status-dot-badge {
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.5; }
}

/* Header */
.config-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.machine-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1));
  border-radius: 12px;
  color: #818cf8;
  flex-shrink: 0;
}

.config-info {
  flex: 1;
  min-width: 0;
}

.config-info h4 {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.provider-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.badge-primary {
  background: linear-gradient(135deg, var(--success-color), #34d399);
  color: white;
  font-size: 0.65rem;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  white-space: nowrap;
}

/* Details */
.config-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail-icon {
  font-size: 0.9rem;
  width: 24px;
  text-align: center;
}

.detail-value {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
}

/* Footer */
.config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* Toggle Wrapper */
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-wrapper input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 40px;
  height: 22px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.toggle-wrapper input:checked + .toggle-slider {
  background: var(--success-color);
  border-color: var(--success-color);
}

.toggle-wrapper input:checked + .toggle-slider::before {
  transform: translateX(18px);
}

.toggle-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* Action Buttons */
.config-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.btn-icon.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}

/* Modal Toggle Switch */
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

.form-grid {
  display: flex;
  gap: 1rem;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.modal-footer { 
  display: flex; 
  gap: var(--spacing-sm); 
  justify-content: flex-end; 
  padding-top: var(--spacing-md); 
  border-top: 1px solid var(--glass-border); 
  margin-top: var(--spacing-md); 
}
</style>
