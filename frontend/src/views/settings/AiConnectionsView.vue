<script setup>
import { ref, onMounted } from 'vue'
import { aiApi } from '../../api/ai'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'
import { useToast } from '../../composables/useToast'
import { useConfirm } from '../../composables/useConfirm'

const toast = useToast()
const { confirm } = useConfirm()

const configs = ref([])
// ... existing refs ...
const isLoading = ref(true)
const showModal = ref(false)
const editingConfig = ref(null)
const availableModels = ref([])
const isFetchingModels = ref(false)

const formData = ref({
  provider: 'ollama',
  name: '',
  apiKey: '',
  baseUrl: '',
  modelName: ''
})

const providers = [
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic' }
]

const loadConfigs = async () => {
  try {
    configs.value = await aiApi.getConfigs()
  } catch (error) {
    console.error('Failed to load configs:', error)
    toast.error('Failed to load configs')
  } finally {
    isLoading.value = false
  }
}

const openModal = (config = null) => {
  availableModels.value = []
  if (config) {
    editingConfig.value = config
    formData.value = {
      provider: config.provider,
      name: config.name,
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || '',
      modelName: config.modelName || ''
    }
  } else {
    editingConfig.value = null
    formData.value = { provider: 'ollama', name: '', apiKey: '', baseUrl: '', modelName: '' }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingConfig.value = null
}

const fetchModels = async () => {
  isFetchingModels.value = true
  try {
    const result = await aiApi.fetchModels({
      provider: formData.value.provider,
      baseUrl: formData.value.baseUrl,
      apiKey: formData.value.apiKey
    })
    availableModels.value = result.models || []
    toast.success('Models fetched successfully')
  } catch (error) {
    toast.error('Failed to fetch models: ' + (error.response?.data?.message || error.message))
  } finally {
    isFetchingModels.value = false
  }
}

const handleSubmit = async () => {
  try {
    if (editingConfig.value) {
      await aiApi.updateConfig(editingConfig.value._id, formData.value)
      toast.success('Connection updated')
    } else {
      await aiApi.createConfig(formData.value)
      toast.success('Connection created')
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
    message: 'Are you sure you want to delete this AI connection?',
    type: 'danger',
    confirmText: 'Delete'
  })

  if (!confirmed) return

  try {
    await aiApi.deleteConfig(id)
    toast.success('Connection deleted')
    loadConfigs()
  } catch (error) {
    console.error('Failed to delete config:', error)
    toast.error('Failed to delete config')
  }
}

const setDefault = async (id) => {
  try {
    await aiApi.setDefault(id)
    loadConfigs()
  } catch (error) {
    console.error('Failed to set default:', error)
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
        <h1>AI Connections</h1>
        <button class="btn btn-primary" @click="openModal()">+ Add Connection</button>
      </header>

      <BentoGrid>
        <BentoCard title="AI Providers" :span="4">
          <div v-if="isLoading" class="text-center text-muted">Loading...</div>
          <div v-else-if="configs.length === 0" class="empty-state">
            <p>No AI connections configured.</p>
          </div>
          <div v-else class="config-grid">
            <div 
              v-for="config in configs" 
              :key="config._id"
              class="config-card"
              :class="{ default: config.isDefault }"
            >
              <div class="config-header">
                <span class="provider-icon">🤖</span>
                <div class="config-info">
                  <h4>{{ config.name }}</h4>
                  <span class="provider-label">{{ config.provider }}</span>
                </div>
                <span v-if="config.isDefault" class="badge badge-low">Default</span>
              </div>
              <div class="config-details">
                <p><strong>Model:</strong> {{ config.modelName || '-' }}</p>
                <p><strong>Base URL:</strong> {{ config.baseUrl || 'Default' }}</p>
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
                <button class="btn btn-sm btn-danger" @click="deleteConfig(config._id)">Delete</button>
              </div>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingConfig ? 'Edit Connection' : 'Add Connection' }}</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label class="form-label">Provider *</label>
            <select v-model="formData.provider" class="select">
              <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input v-model="formData.name" type="text" class="input" placeholder="Display name" />
          </div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <input v-model="formData.apiKey" type="password" class="input" placeholder="API Key (if required)" />
          </div>
          <div class="form-group">
            <label class="form-label">Base URL</label>
            <input v-model="formData.baseUrl" type="text" class="input" placeholder="e.g. http://localhost:11434" />
          </div>
          <div class="form-group">
            <label class="form-label">Model</label>
            <div class="model-input-row">
              <input v-model="formData.modelName" type="text" class="input" placeholder="Model name" />
              <button 
                type="button" 
                class="btn btn-secondary"
                @click="fetchModels"
                :disabled="isFetchingModels"
              >
                {{ isFetchingModels ? 'Loading...' : 'Fetch Models' }}
              </button>
            </div>
            <div v-if="availableModels.length" class="model-list">
              <button 
                v-for="model in availableModels" 
                :key="model"
                type="button"
                class="model-option"
                :class="{ selected: formData.modelName === model }"
                @click="formData.modelName = model"
              >
                {{ model }}
              </button>
            </div>
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
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

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

.model-input-row {
  display: flex;
  gap: var(--spacing-sm);
}

.model-input-row .input {
  flex: 1;
  margin-bottom: 0;
}

.model-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
}

.model-option {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
}

.model-option:hover {
  border-color: var(--primary-color);
}

.model-option.selected {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.modal-footer { display: flex; gap: var(--spacing-sm); justify-content: flex-end; padding-top: var(--spacing-md); border-top: 1px solid var(--glass-border); margin-top: var(--spacing-md); }
</style>
