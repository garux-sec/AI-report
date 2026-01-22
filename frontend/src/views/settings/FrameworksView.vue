<script setup>
import { ref, onMounted } from 'vue'
import { frameworksApi } from '../../api/frameworks'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'

const frameworks = ref([])
const isLoading = ref(true)
const showModal = ref(false)
const editingFramework = ref(null)

const formData = ref({
  name: '',
  version: '',
  description: ''
})

const loadFrameworks = async () => {
  try {
    frameworks.value = await frameworksApi.getAll()
  } catch (error) {
    console.error('Failed to load frameworks:', error)
  } finally {
    isLoading.value = false
  }
}

const openModal = (fw = null) => {
  if (fw) {
    editingFramework.value = fw
    formData.value = { name: fw.name, version: fw.version || '', description: fw.description || '' }
  } else {
    editingFramework.value = null
    formData.value = { name: '', version: '', description: '' }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingFramework.value = null
}

const handleSubmit = async () => {
  try {
    if (editingFramework.value) {
      await frameworksApi.update(editingFramework.value._id, formData.value)
    } else {
      await frameworksApi.create(formData.value)
    }
    closeModal()
    loadFrameworks()
  } catch (error) {
    alert(error.response?.data?.message || 'Error saving framework')
  }
}

const deleteFramework = async (id) => {
  if (!confirm('Delete this framework?')) return
  try {
    await frameworksApi.delete(id)
    loadFrameworks()
  } catch (error) {
    console.error('Failed to delete framework:', error)
  }
}

onMounted(() => {
  loadFrameworks()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    <main class="main-content">
      <header class="page-header">
        <h1>Frameworks</h1>
        <button class="btn btn-primary" @click="openModal()">+ Add Framework</button>
      </header>

      <BentoGrid>
        <BentoCard title="Security Frameworks" :span="4">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="4" class="text-center text-muted">Loading...</td>
                </tr>
                <tr v-else-if="frameworks.length === 0">
                  <td colspan="4" class="text-center text-muted">No frameworks found</td>
                </tr>
                <tr v-for="fw in frameworks" :key="fw._id">
                  <td><strong>{{ fw.name }}</strong></td>
                  <td>{{ fw.version || '-' }}</td>
                  <td>{{ fw.description || '-' }}</td>
                  <td>
                    <div class="flex gap-sm">
                      <button class="btn btn-sm btn-secondary" @click="openModal(fw)">Edit</button>
                      <button class="btn btn-sm btn-danger" @click="deleteFramework(fw._id)">Delete</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingFramework ? 'Edit Framework' : 'Add Framework' }}</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input v-model="formData.name" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label class="form-label">Version</label>
            <input v-model="formData.version" type="text" class="input" />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="formData.description" class="textarea"></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary">{{ editingFramework ? 'Update' : 'Create' }}</button>
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
.modal-footer { display: flex; gap: var(--spacing-sm); justify-content: flex-end; padding-top: var(--spacing-md); border-top: 1px solid var(--glass-border); margin-top: var(--spacing-md); }
</style>
