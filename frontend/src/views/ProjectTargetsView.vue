<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectsApi } from '../api/projects'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'

const toast = useToast()
const { confirm } = useConfirm()
const route = useRoute()
const projectId = computed(() => route.params.id)

const project = ref(null)
const isLoading = ref(true)

// Targets
const showTargetModal = ref(false)
const editingTarget = ref(null)
const targetForm = ref({
  name: '',
  url: '',
  appClass: '',
  bu: '',
  it: '',
  remarks: ''
})
const targetSearchTerm = ref('')

const loadProject = async () => {
  try {
    project.value = await projectsApi.getById(projectId.value)
  } catch (error) {
    console.error('Failed to load project:', error)
    toast.error('Failed to load project')
  } finally {
    isLoading.value = false
  }
}

const filteredTargets = computed(() => {
  if (!project.value?.targets) return []
  let targets = [...project.value.targets]
  
  if (targetSearchTerm.value) {
    const term = targetSearchTerm.value.toLowerCase()
    targets = targets.filter(t =>
      t.name?.toLowerCase().includes(term) ||
      t.url?.toLowerCase().includes(term) ||
      t.bu?.toLowerCase().includes(term) ||
      t.it?.toLowerCase().includes(term)
    )
  }

  // Sort: Starred first, then by name
  return targets.sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1
    if (!a.isStarred && b.isStarred) return 1
    return (a.name || '').localeCompare(b.name || '')
  })
})

const toggleStar = async (target) => {
  try {
    await projectsApi.toggleTargetStar(projectId.value, target._id)
    target.isStarred = !target.isStarred
    // We don't necessarily need to reload everything, just update the local state
    // but loadProject() ensures consistency with backend
    await loadProject()
  } catch (error) {
    toast.error('Failed to toggle star')
  }
}

const openTargetModal = (target = null) => {
  if (target) {
    editingTarget.value = target._id
    targetForm.value = { ...target }
  } else {
    editingTarget.value = null
    targetForm.value = { name: '', url: '', appClass: '', bu: '', it: '', remarks: '' }
  }
  showTargetModal.value = true
}

const closeTargetModal = () => {
  showTargetModal.value = false
  editingTarget.value = null
}

const saveTarget = async () => {
  try {
    if (editingTarget.value) {
      await projectsApi.updateTarget(projectId.value, editingTarget.value, targetForm.value)
      toast.success('Target updated')
    } else {
      await projectsApi.addTarget(projectId.value, targetForm.value)
      toast.success('Target added')
    }
    await loadProject()
    closeTargetModal()
  } catch (error) {
    toast.error('Failed to save target: ' + (error.response?.data?.message || error.message))
  }
}

const deleteTarget = async (targetId) => {
  const confirmed = await confirm({
    title: 'Delete Target?',
    message: 'Are you sure you want to remove this target?',
    type: 'danger',
    confirmText: 'Delete'
  })
  if (!confirmed) return

  try {
    await projectsApi.deleteTarget(projectId.value, targetId)
    toast.success('Target deleted')
    await loadProject()
  } catch (error) {
    toast.error('Failed to delete target')
  }
}

const handleCSVUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const text = await file.text()
  const lines = text.split('\n')
  const targets = []
  const startIndex = lines[0].toLowerCase().includes('application') ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.includes('\t') ? line.split('\t') : line.split(',')
    
    if (parts.length >= 2) {
      targets.push({
        name: parts[0]?.trim() || '',
        url: parts[1]?.trim() || '',
        appClass: parts[2]?.trim() || '',
        bu: parts[3]?.trim() || '',
        it: parts[4]?.trim() || '',
        remarks: parts[5]?.trim() || ''
      })
    }
  }

  if (targets.length > 0) {
    try {
      await projectsApi.importTargets(projectId.value, targets)
      toast.success(`Imported ${targets.length} targets`)
      await loadProject()
    } catch (error) {
      toast.error('Failed to import targets')
    }
  } else {
    toast.error('No valid targets found in CSV')
  }
  event.target.value = ''
}

const formatDate = (date) => new Date(date).toLocaleDateString('th-TH')

onMounted(() => {
  loadProject()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <!-- Header -->
      <div v-if="project" class="page-header">
        <h1>🎯 {{ project.name }} - Targets</h1>
      </div>

      <!-- Actions -->
      <div class="section-header">
        <h2 class="section-title">Managed Targets</h2>
        <div class="section-actions">
          <label class="btn btn-secondary">
            📁 Import CSV
            <input type="file" accept=".csv,.txt" @change="handleCSVUpload" hidden />
          </label>
          <button class="btn btn-primary" @click="openTargetModal()">+ Add Target</button>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <input 
          v-model="targetSearchTerm" 
          type="text" 
          class="input" 
          placeholder="Search targets by name, URL, BU, or IT..."
        />
      </div>

      <BentoGrid>
        <BentoCard :span="4">
          <div class="table-container">
            <table class="table targets-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Application</th>
                  <th>URL</th>
                  <th>Class</th>
                  <th>BU</th>
                  <th>IT</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!project?.targets?.length">
                  <td colspan="8" class="text-center text-muted">No targets configured. Add targets or import from CSV.</td>
                </tr>
                <tr v-for="(target, index) in filteredTargets" :key="target._id">
                  <td class="text-muted">{{ index + 1 }}</td>
                  <td>
                    <router-link :to="`/project/${projectId}/target/${target._id}`" class="target-name-link">
                      {{ target.name }}
                    </router-link>
                  </td>
                  <td>
                    <a v-if="target.url" :href="target.url" target="_blank" class="target-url">{{ target.url }}</a>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span v-if="target.appClass" :class="['app-class-badge', target.appClass.toLowerCase()]">
                      {{ target.appClass }}
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>{{ target.bu || '-' }}</td>
                  <td>{{ target.it || '-' }}</td>
                  <td class="remarks-cell">{{ target.remarks || '-' }}</td>
                  <td>
                    <div class="actions-cell">
                      <button 
                        class="btn btn-sm btn-icon star-btn" 
                        :class="{ starred: target.isStarred }"
                        @click="toggleStar(target)"
                        :title="target.isStarred ? 'Unstar' : 'Star'"
                      >
                        {{ target.isStarred ? '⭐' : '☆' }}
                      </button>
                      <router-link :to="`/project/${projectId}/target/${target._id}`" class="btn btn-sm btn-icon btn-success-icon" title="Notes & Commands">📝</router-link>
                      <button class="btn btn-sm btn-icon" @click="openTargetModal(target)" title="Edit">✏️</button>
                      <button class="btn btn-sm btn-icon btn-danger-icon" @click="deleteTarget(target._id)" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="targets-count">
            Total: {{ project?.targets?.length || 0 }} targets
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <!-- Target Modal -->
    <div v-if="showTargetModal" class="modal-backdrop" @click.self="closeTargetModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingTarget ? 'Edit Target' : 'Add Target' }}</h2>
          <button class="modal-close" @click="closeTargetModal">&times;</button>
        </div>
        
        <form @submit.prevent="saveTarget" class="modal-body">
          <div class="form-group">
            <label class="form-label">Application Name *</label>
            <input v-model="targetForm.name" type="text" class="input" required placeholder="e.g. Weight Scale Automation" />
          </div>

          <div class="form-group">
            <label class="form-label">URL</label>
            <input v-model="targetForm.url" type="text" class="input" placeholder="https://example.com" />
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">App Class</label>
              <select v-model="targetForm.appClass" class="input">
                <option value="">Select...</option>
                <option value="A">A - Critical</option>
                <option value="B">B - Important</option>
                <option value="C">C - Standard</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Business Unit</label>
              <input v-model="targetForm.bu" type="text" class="input" placeholder="e.g. Supply Chain" />
            </div>

            <div class="form-group">
              <label class="form-label">IT Contact</label>
              <input v-model="targetForm.it" type="text" class="input" placeholder="e.g. John Doe" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Remarks</label>
            <textarea v-model="targetForm.remarks" class="input textarea" rows="2" placeholder="Start date, scan window, etc."></textarea>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-text" @click="closeTargetModal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Target</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  margin-bottom: var(--spacing-lg);
}

.page-header h1 {
  margin: 0;
  font-size: 1.75rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.section-title {
  font-size: 1.25rem;
  margin: 0;
}

.section-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.search-bar {
  margin-bottom: var(--spacing-md);
}

.table-container {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--glass-border);
}

.table th {
  font-weight: 600;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.table td {
  font-size: 0.95rem;
}

.target-name-link {
  font-weight: 600;
  color: white;
  text-decoration: none;
}

.target-name-link:hover {
  color: var(--primary-color);
  text-decoration: underline;
}

.target-url {
  color: var(--primary-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.target-url:hover {
  text-decoration: underline;
}

.app-class-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.app-class-badge.a { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.app-class-badge.b { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.app-class-badge.c { background: rgba(34, 197, 94, 0.2); color: #4ade80; }

.actions-cell {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 1.1rem;
  border-radius: 6px;
}

.star-btn {
  color: var(--text-muted);
  background: transparent;
  border: none;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.star-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fbbf24;
}

.star-btn.starred {
  color: #fbbf24;
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
}

.targets-count {
  margin-top: var(--spacing-md);
  text-align: right;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

.modal {
  background: #1e293b;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 600px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body {
  padding: var(--spacing-lg);
}

.modal-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--glass-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.form-group {
  margin-bottom: var(--spacing-md);
}

.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
