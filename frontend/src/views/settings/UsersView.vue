<script setup>
import { ref, onMounted } from 'vue'
import { usersApi } from '../../api/users'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'

const users = ref([])
const isLoading = ref(true)
const showModal = ref(false)
const editingUser = ref(null)

const formData = ref({
  username: '',
  password: '',
  role: 'user'
})

const loadUsers = async () => {
  try {
    users.value = await usersApi.getAll()
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    isLoading.value = false
  }
}

const openModal = (user = null) => {
  if (user) {
    editingUser.value = user
    formData.value = {
      username: user.username,
      password: '',
      role: user.role
    }
  } else {
    editingUser.value = null
    formData.value = { username: '', password: '', role: 'user' }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingUser.value = null
}

const handleSubmit = async () => {
  try {
    const data = { ...formData.value }
    if (!data.password) delete data.password
    
    if (editingUser.value) {
      await usersApi.update(editingUser.value._id, data)
    } else {
      await usersApi.create(data)
    }
    closeModal()
    loadUsers()
  } catch (error) {
    alert(error.response?.data?.message || 'Error saving user')
  }
}

const deleteUser = async (id) => {
  if (!confirm('Delete this user?')) return
  try {
    await usersApi.delete(id)
    loadUsers()
  } catch (error) {
    console.error('Failed to delete user:', error)
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <header class="page-header">
        <h1>User Management</h1>
        <button class="btn btn-primary" @click="openModal()">
          + Add User
        </button>
      </header>

      <BentoGrid>
        <BentoCard title="Users" :span="4">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="3" class="text-center text-muted">Loading...</td>
                </tr>
                <tr v-else-if="users.length === 0">
                  <td colspan="3" class="text-center text-muted">No users found</td>
                </tr>
                <tr v-for="user in users" :key="user._id">
                  <td>{{ user.username }}</td>
                  <td>
                    <span :class="['badge', user.role === 'admin' ? 'badge-high' : 'badge-info']">
                      {{ user.role }}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-sm">
                      <button class="btn btn-sm btn-secondary" @click="openModal(user)">
                        Edit
                      </button>
                      <button class="btn btn-sm btn-danger" @click="deleteUser(user._id)">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <!-- Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingUser ? 'Edit User' : 'Add User' }}</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label class="form-label">Username *</label>
            <input v-model="formData.username" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password {{ editingUser ? '(leave empty to keep)' : '*' }}</label>
            <input v-model="formData.password" type="password" class="input" :required="!editingUser" />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select v-model="formData.role" class="select">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary">{{ editingUser ? 'Update' : 'Create' }}</button>
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
