<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectsApi } from '../api/projects'
import { sshApi } from '../api/ssh'
import { burpApi } from '../api/burp'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { useToast } from '../composables/useToast'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const toast = useToast()
const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.projectId)
const targetId = computed(() => route.params.targetId)

// Data
const target = ref(null)
const project = ref(null)
const notes = ref('') // Now HTML content
const isLoading = ref(true)
const isSaving = ref(false)
const isExecuting = ref(false)
const isUploading = ref(false)

// Kali Runners
const kaliRunners = ref([])
const selectedRunner = ref('')
const command = ref('')

// Image upload
const imageFileInput = ref(null)
const imageDescription = ref('')
const quill = ref(null) // Reference to Quill instance

// Burp Analysis
const burpConfigs = ref([])
const selectedBurpConfig = ref('')
const selectedAiProvider = ref('ollama')
const selectedAiModel = ref('mistral')
const isAnalyzing = ref(false)
const analysisResult = ref('')

// Preset commands
const presetCommands = [
  { label: 'Directory Bruteforce (dirb)', cmd: 'dirb {url}' },
  { label: 'Nmap Quick Scan', cmd: 'nmap -T4 -F {host}' },
  { label: 'Nikto Web Scanner', cmd: 'nikto -h {url}' },
  { label: 'WhatWeb', cmd: 'whatweb {url}' },
  { label: 'SSL Check', cmd: 'sslscan {host}' },
  { label: 'Subdomain Enum', cmd: 'subfinder -d {domain}' }
]

// Debounce timer for auto-save
let saveTimeout = null

const loadTarget = async () => {
  try {
    isLoading.value = true
    const response = await projectsApi.getTarget(projectId.value, targetId.value)
    target.value = response.target
    project.value = response.project
    notes.value = response.target.notes || ''
  } catch (error) {
    console.error('Failed to load target:', error)
    toast.error('Failed to load target')
    router.back()
  } finally {
    isLoading.value = false
  }
}

const loadBurpConfigs = async () => {
    try {
        burpConfigs.value = await burpApi.getConfigs()
        const defaultConfig = burpConfigs.value.find(c => c.isDefault && c.isEnabled)
        if (defaultConfig) selectedBurpConfig.value = defaultConfig._id
    } catch (error) {
        console.error('Failed to load Burp configs:', error)
    }
}

const analyzeHistory = async () => {
    if (!selectedBurpConfig.value) {
        toast.error('Please select a Burp configuration')
        return
    }

    try {
        isAnalyzing.value = true
        toast.info('Analyzing Burp history...')
        
        const result = await burpApi.analyzeHistory({
            configId: selectedBurpConfig.value,
            provider: selectedAiProvider.value,
            model: selectedAiModel.value
        })

        analysisResult.value = result.analysis
        toast.success('Analysis complete')
    } catch (error) {
        console.error('Analysis failed:', error)
        toast.error('Analysis failed: ' + (error.response?.data?.message || error.message))
    } finally {
        isAnalyzing.value = false
    }
}

const appendToNotes = () => {
    if (!analysisResult.value) return
    const editor = quill.value.getQuill()
    const index = editor.getLength()
    
    editor.insertText(index, '\n\n## Burp Analysis Results\n', 'bold', true)
    editor.insertText(index + 30, analysisResult.value)
    
    toast.success('Added to notes')
    analysisResult.value = '' // Clear after adding
}

const loadKaliRunners = async () => {
  try {
    kaliRunners.value = await sshApi.getAll()
    // Select default or first enabled runner
    const defaultRunner = kaliRunners.value.find(r => r.isDefault && r.enabled)
    const firstEnabled = kaliRunners.value.find(r => r.enabled)
    selectedRunner.value = defaultRunner?._id || firstEnabled?._id || ''
  } catch (error) {
    console.error('Failed to load Kali Runners:', error)
  }
}

const saveNotes = async () => {
  try {
    isSaving.value = true
    // Save the HTML content directly
    await projectsApi.updateTargetNotes(projectId.value, targetId.value, notes.value)
  } catch (error) {
    console.error('Failed to save notes:', error)
    toast.error('Failed to save notes')
  } finally {
    isSaving.value = false
  }
}

// Auto-save notes on change
watch(notes, () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(saveNotes, 1000)
})

const applyPreset = (preset) => {
  let cmd = preset.cmd
  if (target.value?.url) {
    try {
      const url = new URL(target.value.url)
      cmd = cmd.replace('{url}', target.value.url)
      cmd = cmd.replace('{host}', url.hostname)
      cmd = cmd.replace('{domain}', url.hostname.replace(/^www\./, ''))
    } catch {
      cmd = cmd.replace('{url}', target.value.url || '')
      cmd = cmd.replace('{host}', target.value.url || '')
      cmd = cmd.replace('{domain}', target.value.url || '')
    }
  }
  command.value = cmd
}

const getSelectedRunner = () => {
  return kaliRunners.value.find(r => r._id === selectedRunner.value)
}

const executeCommand = async () => {
  if (!command.value.trim()) {
    toast.error('Please enter a command')
    return
  }

  const runner = getSelectedRunner()
  if (!runner) {
    toast.error('Please select a Kali Runner')
    return
  }

  if (!runner.enabled) {
    toast.error('Selected Kali Runner is disabled. Please enable it in Settings → Kali Runner first.')
    return
  }

  try {
    isExecuting.value = true
    toast.info(`Executing: ${command.value}`)

    const result = await projectsApi.executeCommand(selectedRunner.value, command.value)

    // Save command result to target
    await projectsApi.saveCommandResult(projectId.value, targetId.value, {
      command: command.value,
      output: result.output,
      kaliRunner: result.kaliRunner,
      kaliRunnerId: result.kaliRunnerId,
      status: result.success ? 'success' : 'error'
    })

    // Reload target to get updated command history
    await loadTarget()

    toast.success('Command executed and saved')
    command.value = ''

  } catch (error) {
    console.error('Execute command failed:', error)
    const msg = error.response?.data?.message || error.message
    
    if (error.response?.data?.disabled) {
      toast.error('Kali Runner is disabled. Please enable it first!')
    } else {
      toast.error('Execution failed: ' + msg)
    }
  } finally {
    isExecuting.value = false
  }
}

const formatDate = (date) => new Date(date).toLocaleString('th-TH')

const goBack = () => {
  router.push(`/project/${projectId.value}`)
}

// Image functions
const triggerImageUpload = () => {
  imageFileInput.value?.click()
}

const handleImageUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    isUploading.value = true
    const formData = new FormData()
    formData.append('image', file)
    formData.append('description', imageDescription.value)

    await projectsApi.uploadTargetImage(projectId.value, targetId.value, formData)
    
    // Refresh target to get new image list
    const response = await projectsApi.getTarget(projectId.value, targetId.value)
    target.value = response.target
    
    // Get the uploaded image (last one in array)
    const uploadedImage = target.value.images[target.value.images.length - 1]
    
    if (uploadedImage && quill.value) {
      // Insert image into Quill editor
      const editor = quill.value.getQuill()
      const range = editor.getSelection(true) || { index: editor.getLength() }
      editor.insertEmbed(range.index, 'image', uploadedImage.path)
      editor.setSelection(range.index + 1)
      
      toast.success('Image uploaded and inserted to notes')
    } else {
      toast.success('Image uploaded')
    }

    imageDescription.value = ''
    event.target.value = ''
  } catch (error) {
    console.error('Image upload failed:', error)
    toast.error('Failed to upload image')
  } finally {
    isUploading.value = false
  }
}

const deleteImage = async (imageId) => {
  if (!confirm('Delete this image?')) return

  try {
    await projectsApi.deleteTargetImage(projectId.value, targetId.value, imageId)
    await loadTarget()
    toast.success('Image deleted')
  } catch (error) {
    console.error('Delete image failed:', error)
    toast.error('Failed to delete image')
  }
}

const openImageModal = (img) => {
  window.open(img.path, '_blank')
}

onMounted(() => {
  loadTarget()
  loadKaliRunners()
  loadBurpConfigs()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <!-- Header -->
      <header class="page-header">
        <div class="header-left">
          <button class="btn btn-icon back-btn" @click="goBack">←</button>
          <div>
            <h1 v-if="target">{{ target.name }}</h1>
            <p v-if="target?.url" class="target-url">
              <a :href="target.url" target="_blank">{{ target.url }}</a>
            </p>
          </div>
        </div>
        <div class="header-badges">
          <span v-if="target?.appClass" :class="['app-class-badge', target.appClass.toLowerCase()]">
            Class {{ target.appClass }}
          </span>
          <span v-if="isSaving" class="saving-indicator">💾 Saving...</span>
        </div>
      </header>

      <div v-if="isLoading" class="loading">Loading target...</div>

      <template v-else-if="target">
        <BentoGrid>
          <!-- Target Info -->
          <BentoCard title="Target Info">
            <div class="info-grid">
              <div class="info-item">
                <label>Business Unit</label>
                <span>{{ target.bu || '-' }}</span>
              </div>
              <div class="info-item">
                <label>IT Contact</label>
                <span>{{ target.it || '-' }}</span>
              </div>
              <div class="info-item">
                <label>Remarks</label>
                <span>{{ target.remarks || '-' }}</span>
              </div>
            </div>
          </BentoCard>

          <!-- Command Execution -->
          <BentoCard title="🔥 Kali Command Runner" :span="3">
            <div class="command-section">
              <!-- Kali Runner Selector -->
              <div class="runner-selector">
                <label>Select Kali Machine:</label>
                <select v-model="selectedRunner" class="input">
                  <option value="">-- Select --</option>
                  <option v-for="runner in kaliRunners" :key="runner._id" :value="runner._id" :disabled="!runner.enabled">
                    {{ runner.name }} ({{ runner.host }}) {{ !runner.enabled ? '⚠️ Disabled' : runner.isDefault ? '⭐' : '' }}
                  </option>
                </select>
                <span v-if="selectedRunner && !getSelectedRunner()?.enabled" class="warning-text">
                  ⚠️ Selected runner is disabled. <router-link to="/settings/ssh-config">Enable it here</router-link>
                </span>
              </div>

              <!-- Preset Commands -->
              <div class="preset-commands">
                <label>Quick Commands:</label>
                <div class="preset-buttons">
                  <button 
                    v-for="preset in presetCommands" 
                    :key="preset.cmd"
                    class="btn btn-sm btn-preset"
                    @click="applyPreset(preset)"
                  >
                    {{ preset.label }}
                  </button>
                </div>
              </div>

              <!-- Command Input -->
              <div class="command-input">
                <input 
                  v-model="command" 
                  type="text" 
                  class="input command-field"
                  placeholder="Enter command to execute..."
                  @keydown.enter="executeCommand"
                  :disabled="isExecuting"
                />
                <button 
                  class="btn btn-primary execute-btn"
                  @click="executeCommand"
                  :disabled="isExecuting || !command.trim() || !selectedRunner"
                >
                  {{ isExecuting ? '⏳ Running...' : '▶ Execute' }}
                </button>
              </div>
            </div>
          </BentoCard>

          <!-- Burp Analysis -->
          <BentoCard title="🕵️ Burp History Analysis (Last 20)" :span="3">
            <div class="analysis-section">
                
                <div class="config-row">
                    <div class="form-group">
                        <label>Burp Config</label>
                        <select v-model="selectedBurpConfig" class="input">
                             <option value="">-- Select Burp --</option>
                             <option v-for="cfg in burpConfigs" :key="cfg._id" :value="cfg._id" :disabled="!cfg.isEnabled">
                                {{ cfg.name }} ({{ cfg.url }})
                             </option>
                        </select>
                    </div>
                     <div class="form-group">
                        <label>AI Model</label>
                        <select v-model="selectedAiModel" class="input">
                             <option value="mistral">Mistral (Ollama)</option>
                             <option value="llama3">Llama3 (Ollama)</option>
                             <option value="gpt-4">GPT-4 (OpenAI)</option>
                             <option value="gpt-3.5-turbo">GPT-3.5 (OpenAI)</option>
                        </select>
                    </div>
                </div>

                <div class="action-row">
                    <button class="btn btn-primary btn-analyze" @click="analyzeHistory" :disabled="isAnalyzing || !selectedBurpConfig">
                        {{ isAnalyzing ? '🧠 Analyzing...' : '🚀 Analyze Vulnerabilities' }}
                    </button>
                    <button v-if="analysisResult" class="btn btn-secondary" @click="appendToNotes">
                        📥 Append to Notes
                    </button>
                </div>

                <div v-if="analysisResult" class="analysis-result">
                    <div class="result-header">
                        <h4>Analysis Findings</h4>
                        <button class="btn-text" @click="analysisResult = ''">Clear</button>
                    </div>
                    <div class="result-content markdown-body">{{ analysisResult }}</div>
                </div>

            </div>
          </BentoCard>
        </BentoGrid>

        <!-- Pentest Notes Editor -->
        <div class="section-header">
          <h2 class="section-title">📝 Pentest Notes</h2>
          <div class="section-actions">
            <span v-if="isSaving" class="saving-indicator">💾 Saving...</span>
          </div>
        </div>
        <BentoGrid>
          <BentoCard :span="4">
            <div class="notes-editor">
              <!-- Quill Rich Text Editor -->
              <div class="quill-wrapper">
                <QuillEditor 
                  ref="quill"
                  v-model:content="notes" 
                  contentType="html" 
                  theme="snow" 
                  toolbar="full"
                  placehoder="Write your pentest notes here..." 
                />
              </div>

              <!-- Inline Images Gallery -->
              <div v-if="target.images?.length" class="inline-images">
                <div class="images-header">
                  <span class="images-label">📸 Gallery / Backups ({{ target.images.length }})</span>
                </div>
                <div class="image-gallery">
                  <div v-for="img in target.images" :key="img._id" class="image-card">
                    <img :src="img.path" :alt="img.filename" class="gallery-image" @click="openImageModal(img)" />
                    <div class="image-overlay">
                      <span class="image-name">{{ img.filename }}</span>
                      <button class="btn btn-xs btn-danger-icon" @click.stop="deleteImage(img._id)">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>


        <!-- Command History -->
        <div class="section-header">
          <h2 class="section-title">📜 Command History</h2>
          <span class="history-count">{{ target.commandResults?.length || 0 }} commands</span>
        </div>
        <BentoGrid>
          <BentoCard :span="4">
            <div v-if="!target.commandResults?.length" class="empty-state">
              No commands executed yet. Use the command runner above to run pentest commands.
            </div>
            <div v-else class="command-history">
              <div 
                v-for="(result, index) in [...target.commandResults].reverse()" 
                :key="result._id || index"
                class="command-result"
              >
                <div class="command-header">
                  <code class="command-text">$ {{ result.command }}</code>
                  <div class="command-meta">
                    <span class="runner-name">{{ result.kaliRunner }}</span>
                    <span class="command-time">{{ formatDate(result.executedAt) }}</span>
                    <span :class="['status-badge', result.status]">{{ result.status }}</span>
                  </div>
                </div>
                <pre class="command-output">{{ result.output }}</pre>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </template>
    </main>
  </div>
</template>

<style scoped>
/* Keep existing styles */
.dashboard-layout {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.back-btn {
  font-size: 1.5rem;
  padding: 0.5rem 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.75rem;
}

.target-url a {
  color: var(--primary-color);
  text-decoration: none;
}

.target-url a:hover {
  text-decoration: underline;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.app-class-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

.app-class-badge.a { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.app-class-badge.b { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.app-class-badge.c { background: rgba(34, 197, 94, 0.2); color: #4ade80; }

.saving-indicator {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.loading {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-muted);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.info-item label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.info-item span {
  font-weight: 500;
}

/* Command Section */
.command-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.runner-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.runner-selector label {
  font-weight: 500;
}

.runner-selector select {
  min-width: 300px;
}

.warning-text {
  color: #fbbf24;
  font-size: 0.875rem;
}

.warning-text a {
  color: var(--primary-color);
}

.preset-commands {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.btn-preset {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--primary-color);
}

.btn-preset:hover {
  background: rgba(99, 102, 241, 0.25);
}

.command-input {
  display: flex;
  gap: var(--spacing-sm);
}

.command-field {
  flex: 1;
  font-family: 'Monaco', 'Menlo', monospace;
}

.execute-btn {
  min-width: 140px;
}

/* Notes Editor */
.notes-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.quill-wrapper {
  background: white;
  border-radius: var(--radius-md);
  overflow: hidden;
  color: black;
  min-height: 300px; /* Initial starting height */
  display: flex;
  flex-direction: column;
}

.ql-toolbar {
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.ql-container {
  flex: 1;
  font-size: 1rem;
  height: auto;
  min-height: 250px;
}

/* Allow editor to grow with content */
:deep(.ql-editor) {
  min-height: 250px;
  height: auto;
  overflow-y: visible;
}

/* Inline Images */
.inline-images {
  border-top: 1px solid var(--glass-border);
  padding-top: var(--spacing-md);
}

.images-header {
  margin-bottom: var(--spacing-sm);
}

.images-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.images-hint {
  padding: var(--spacing-md);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
  background: rgba(99, 102, 241, 0.05);
  border-radius: var(--radius-md);
  border: 1px dashed rgba(99, 102, 241, 0.3);
}

/* Section Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: var(--spacing-xl) 0 var(--spacing-md);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.section-title {
  margin: 0;
  font-size: 1.25rem;
}

/* Image Gallery */
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.image-card {
  position: relative;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.gallery-image {
  width: 100%;
  height: 100px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s, filter 0.2s;
}

.image-card:hover .gallery-image {
  filter: brightness(0.7);
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 8px;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-card:hover .image-overlay {
  opacity: 1;
}

.image-name {
  font-size: 0.7rem;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80%;
}

.btn-xs {
  padding: 2px 6px;
  font-size: 0.7rem;
}


.history-count {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Command History */
.empty-state {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--text-muted);
}

.command-history {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-height: 600px;
  overflow-y: auto;
}

.command-result {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.command-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid var(--glass-border);
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.command-text {
  color: #22c55e;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
}

.command-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.runner-name {
  color: var(--primary-color);
  font-size: 0.8rem;
}

.command-time {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

.status-badge.success {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Burp Analysis */
.analysis-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
}

.config-row {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.config-row .form-group {
    flex: 1;
    min-width: 200px;
}

.btn-analyze {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 12px;
    font-size: 1rem;
}

.analysis-result {
    margin-top: var(--spacing-md);
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
}

.result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--glass-border);
    padding-bottom: var(--spacing-sm);
}

.result-header h4 {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    text-transform: uppercase;
}

.result-content {
    line-height: 1.6;
    font-size: 0.95rem;
    white-space: pre-wrap;
}

.markdown-body h3 { 
    margin-top: 1em; 
    font-size: 1.1em; 
    color: var(--primary-light); 
}
.markdown-body strong { color: white; }

.command-output {
  padding: var(--spacing-md);
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.3);
  color: #e2e8f0;
}
</style>
