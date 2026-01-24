<script setup>
import { ref, onMounted } from 'vue'
import { projectsApi } from '../api/projects'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'

const toast = useToast()
const { confirm } = useConfirm()

const projects = ref([])
// ... existing refs ...
const isLoading = ref(true)
const showModal = ref(false)
const editingProject = ref(null)

// Form data
const formData = ref({
  name: '',
  clientName: '',
  preparedBy: '',
  pentesterName: '',
  pentesterPosition: '',
  pentesterEmail: '',
  description: '',
  status: 'active'
})

const loadProjects = async () => {
  try {
    projects.value = await projectsApi.getAll()
  } catch (error) {
    console.error('Failed to load projects:', error)
    toast.error('Failed to load projects')
  } finally {
    isLoading.value = false
  }
}

const openModal = (project = null) => {
  if (project) {
    editingProject.value = project
    formData.value = {
      name: project.name || '',
      clientName: project.clientName || '',
      preparedBy: project.preparedBy || '',
      pentesterName: project.pentesterName || '',
      pentesterPosition: project.pentesterPosition || '',
      pentesterEmail: project.pentesterEmail || '',
      description: project.description || '',
      status: project.status || 'active'
    }
  } else {
    editingProject.value = null
    formData.value = {
      name: '',
      clientName: '',
      preparedBy: '',
      pentesterName: '',
      pentesterPosition: '',
      pentesterEmail: '',
      description: '',
      status: 'active'
    }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingProject.value = null
}

const handleSubmit = async () => {
  try {
    const data = new FormData()
    Object.entries(formData.value).forEach(([key, value]) => {
      data.append(key, value)
    })

    // Handle file inputs if they exist
    const logoInput = document.getElementById('logo')
    const bgInput = document.getElementById('background')
    if (logoInput?.files[0]) data.append('logo', logoInput.files[0])
    if (bgInput?.files[0]) data.append('background', bgInput.files[0])

    if (editingProject.value) {
      await projectsApi.update(editingProject.value._id, data)
      toast.success('Project updated')
    } else {
      await projectsApi.create(data)
      toast.success('Project created')
    }

    closeModal()
    loadProjects()
  } catch (error) {
    console.error('Failed to save project:', error)
    toast.error(error.response?.data?.message || 'Error saving project')
  }
}

const deleteProject = async (id) => {
  const confirmed = await confirm({
    title: 'Delete Project?',
    message: 'Are you sure you want to delete this project? All associated reports will also be deleted.',
    type: 'danger',
    confirmText: 'Delete'
  })

  if (!confirmed) return

  try {
    await projectsApi.delete(id)
    toast.success('Project deleted')
    loadProjects()
  } catch (error) {
    console.error('Failed to delete project:', error)
    toast.error('Failed to delete project')
  }
}

const cloneProject = async (id) => {
  const confirmed = await confirm({
    title: 'Clone Project?',
    message: 'Clone this project settings?',
    type: 'info',
    confirmText: 'Clone'
  })

  if (!confirmed) return

  try {
    await projectsApi.clone(id)
    toast.success('Project cloned')
    loadProjects()
  } catch (error) {
    console.error('Failed to clone project:', error)
    toast.error('Failed to clone project')
  }
}

const getStatusColor = (status) => {
  const colors = {
    active: '#10b981',
    completed: '#8b5cf6',
    archived: '#64748b'
  }
  return colors[status] || '#94a3b8'
}

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <header class="page-header">
        <h1>Projects</h1>
        <button class="btn btn-primary" @click="openModal()">
          + New Project
        </button>
      </header>

      <BentoGrid>
        <!-- Projects Grid -->
        <BentoCard 
          v-for="project in projects" 
          :key="project._id"
          :span="2"
        >
          <div class="project-card-content">
            <div class="project-header">
              <div class="project-logo">
                <img 
                  v-if="project.logoUrl" 
                  :src="project.logoUrl" 
                  alt="Logo"
                />
                <span v-else class="logo-placeholder">📁</span>
              </div>
              <div class="project-info">
                <router-link 
                  :to="`/project/${project._id}`"
                  class="project-name"
                >
                  {{ project.name }}
                </router-link>
                <span class="project-client">{{ project.clientName || 'No Client' }}</span>
              </div>
              <span 
                class="status-badge"
                :style="{ 
                  color: getStatusColor(project.status),
                  borderColor: getStatusColor(project.status) + '60',
                  background: getStatusColor(project.status) + '20'
                }"
              >
                {{ project.status?.toUpperCase() }}
              </span>
            </div>

            <p class="project-description">
              {{ project.description || 'No description' }}
            </p>

            <div class="project-meta">
              <span>Prepared by: {{ project.preparedBy || '-' }}</span>
            </div>

            <div class="project-actions">
              <button class="btn btn-sm btn-secondary" @click="cloneProject(project._id)">
                Clone
              </button>
              <button class="btn btn-sm btn-secondary" @click="openModal(project)">
                Edit
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteProject(project._id)">
                Delete
              </button>
            </div>
          </div>
        </BentoCard>

        <!-- Empty State -->
        <BentoCard v-if="!isLoading && projects.length === 0" :span="4">
          <div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <p>No projects yet. Create your first project!</p>
            <button class="btn btn-primary" @click="openModal()">
              + New Project
            </button>
          </div>
        </BentoCard>

        <!-- Loading State -->
        <BentoCard v-if="isLoading" :span="4">
          <div class="flex items-center justify-center gap-md">
            <span class="spinner"></span>
            <span>Loading projects...</span>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <!-- Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">
            {{ editingProject ? 'Edit Project' : 'New Project' }}
          </h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label class="form-label">Project Name *</label>
            <input v-model="formData.name" type="text" class="input" required />
          </div>

          <div class="form-group">
            <label class="form-label">Client Name</label>
            <input v-model="formData.clientName" type="text" class="input" />
          </div>

          <div class="form-group">
            <label class="form-label">Prepared By</label>
            <input v-model="formData.preparedBy" type="text" class="input" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Pentester Name</label>
              <input v-model="formData.pentesterName" type="text" class="input" />
            </div>
            <div class="form-group">
              <label class="form-label">Position</label>
              <input v-model="formData.pentesterPosition" type="text" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Pentester Email</label>
            <input v-model="formData.pentesterEmail" type="email" class="input" />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="formData.description" class="textarea"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <select v-model="formData.status" class="select">
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Logo</label>
              <input id="logo" type="file" class="input" accept="image/*" />
            </div>
            <div class="form-group">
              <label class="form-label">Background</label>
              <input id="background" type="file" class="input" accept="image/*" />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {{ editingProject ? 'Update' : 'Create' }}
            </button>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-header h1 {
  margin: 0;
}

.project-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.project-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.project-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.project-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-placeholder {
  font-size: 1.5rem;
  opacity: 0.3;
}

.project-info {
  flex: 1;
}

.project-name {
  display: block;
  font-weight: 600;
  color: white;
  text-decoration: none;
  margin-bottom: 2px;
}

.project-name:hover {
  color: var(--primary-color);
}

.project-client {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid;
}

.project-description {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.project-meta {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.project-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
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
