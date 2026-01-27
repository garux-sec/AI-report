<script setup>
import { ref, reactive, onMounted } from 'vue'
import Sidebar from '../../components/layout/Sidebar.vue'
import { sshApi } from '../../api/ssh'
import { useToast } from '../../composables/useToast'
import { useConfirm } from '../../composables/useConfirm'

const toast = useToast()
const { confirm } = useConfirm()

const configs = ref([])
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
  passphrase: ''
})

const fetchConfigs = async () => {
  isLoading.value = true
  try {
    configs.value = await sshApi.getConfigs()
  } catch (err) {
    toast.error('Failed to fetch SSH configurations')
  } finally {
    isLoading.value = false
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
    passphrase: ''
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
    passphrase: config.passphrase || ''
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

onMounted(fetchConfigs)
</script>

<template>
  <div class="dashboard-container">
    <Sidebar />
    <main class="main-content">
      <header class="content-header">
        <div class="header-title">
          <h1>💻 SSH Configuration</h1>
          <p class="text-muted">Manage SSH access to Kali Linux for testing and data collection</p>
        </div>
        <button class="btn btn-primary" @click="openAddModal">
          <span class="icon">+</span> Add Configuration
        </button>
      </header>

      <div v-if="isLoading" class="flex justify-center items-center py-xl">
        <div class="spinner"></div>
      </div>

      <div v-else class="config-grid">
        <div v-for="config in configs" :key="config._id" class="card glass-card" :class="{ 'is-default': config.isDefault }">
          <div class="card-header">
            <div class="flex items-center gap-sm">
              <span class="status-indicator" :class="{ active: config.isDefault }"></span>
              <h3 class="config-name">{{ config.name }}</h3>
            </div>
            <div class="card-actions">
              <button class="btn-icon" @click="openEditModal(config)" title="Edit">✏️</button>
              <button class="btn-icon delete" @click="deleteConfig(config._id)" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="label">Host:</span>
              <span class="value">{{ config.host }}:{{ config.port }}</span>
            </div>
            <div class="info-row">
              <span class="label">User:</span>
              <span class="value">{{ config.username }}</span>
            </div>
          </div>
          <div class="card-footer">
            <button 
              v-if="!config.isDefault" 
              class="btn btn-outline btn-sm" 
              @click="makeDefault(config._id)"
            >
              Make Default
            </button>
            <span v-else class="badge badge-primary">Default</span>
          </div>
        </div>

        <div v-if="configs.length === 0" class="empty-state">
          <div class="empty-icon">💻</div>
          <h3>No SSH Configurations</h3>
          <p>Add your first Kali Linux SSH connection to get started.</p>
        </div>
      </div>
    </main>

    <!-- Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal glass-modal">
        <div class="modal-header">
          <h3>{{ editingId ? 'Edit Configuration' : 'Add Configuration' }}</h3>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Name (Label)</label>
            <input v-model="form.name" type="text" class="input" placeholder="e.g. My Kali Machine" />
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Host</label>
              <input v-model="form.host" type="text" class="input" placeholder="127.0.0.1" />
            </div>
            <div class="form-group" style="width: 100px;">
              <label>Port</label>
              <input v-model.number="form.port" type="number" class="input" />
            </div>
          </div>
          <div class="form-group">
            <label>Username</label>
            <input v-model="form.username" type="text" class="input" placeholder="kali" />
          </div>
          <div class="form-group">
            <label>Password (Optional if using SSH Key)</label>
            <input v-model="form.password" type="password" class="input" placeholder="••••••••" />
          </div>
          <div class="form-group">
            <label>Private Key (Optional)</label>
            <textarea v-model="form.privateKey" class="textarea code-font" rows="5" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"></textarea>
          </div>
          <div class="form-group" v-if="form.privateKey">
            <label>Key Passphrase</label>
            <input v-model="form.passphrase" type="password" class="input" placeholder="••••••••" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="testConnection" :disabled="isTesting">
            {{ isTesting ? 'Testing...' : 'Test Connection' }}
          </button>
          <div class="flex gap-sm">
            <button class="btn btn-outline" @click="showModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveConfig" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : 'Save Configuration' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
  overflow: hidden;
}

.glass-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-4px);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.3);
}

.glass-card.is-default {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.05);
}

.card-header {
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--glass-border);
}

.config-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-icon.delete:hover {
  background: rgba(239, 68, 68, 0.1);
}

.card-body {
  padding: 1.25rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.value {
  font-family: var(--font-code);
  font-size: 0.9rem;
}

.card-footer {
  padding: 1rem 1.25rem;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: flex-end;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-indicator.active {
  background: #10b981;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

.form-grid {
  display: flex;
  gap: 1rem;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  background: var(--glass-bg);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--glass-border);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.5;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
