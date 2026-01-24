<script setup>
import { ref, onMounted } from 'vue'
import { kpiApi } from '../../api/users'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'
import { useToast } from '../../composables/useToast'

const toast = useToast()

const users = ref([])
// ... existing refs ...
const selectedUserId = ref('')
const selectedYear = ref(new Date().getFullYear())
const targets = ref([])
const isLoading = ref(true)
const isSaving = ref(false)

const metricOptions = [
  { value: 'ReportsClosed', label: 'Reports Closed (All Vulns Fixed)' },
  { value: 'ReportsCompleted', label: 'Reports Completed (Submitted)' },
  { value: 'VulnerabilitiesFound', label: 'Vulnerabilities Found' }
]

const loadUsers = async () => {
  try {
    users.value = await kpiApi.getUsers()
    if (users.value.length > 0) {
      selectedUserId.value = users.value[0]._id
      loadSettings()
    }
  } catch (error) {
    console.error('Failed to load users:', error)
    toast.error('Failed to load users')
  } finally {
    isLoading.value = false
  }
}

const loadSettings = async () => {
  if (!selectedUserId.value) return
  
  try {
    const result = await kpiApi.getSettings({
      userId: selectedUserId.value,
      year: selectedYear.value
    })
    
    if (result?.targets && result.targets.length > 0) {
      targets.value = result.targets.map(t => ({
        metric: t.metric || 'ReportsClosed',
        tag: t.tag || '',
        targetValue: t.targetValue || 0
      }))
    } else {
      targets.value = []
    }
  } catch (error) {
    console.error('Failed to load KPI settings:', error)
    toast.error('Failed to load KPI settings')
    targets.value = []
  }
}

const addTarget = () => {
  targets.value.push({
    metric: 'ReportsClosed',
    tag: '',
    targetValue: 0
  })
}

const removeTarget = (index) => {
  targets.value.splice(index, 1)
}

const saveSettings = async () => {
  if (!selectedUserId.value) {
    toast.warning('Please select a user')
    return
  }
  
  // Filter out empty targets
  const validTargets = targets.value.filter(t => t.targetValue > 0)
  
  isSaving.value = true
  try {
    await kpiApi.saveSettings({
      userId: selectedUserId.value,
      year: selectedYear.value,
      targets: validTargets
    })
    toast.success('KPI Settings Saved Successfully!')
  } catch (error) {
    toast.error('Failed to save: ' + (error.response?.data?.message || error.message))
  } finally {
    isSaving.value = false
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
        <h1>KPI Settings</h1>
      </header>

      <BentoGrid>
        <BentoCard title="Configure KPI Targets" :span="4">
          <form @submit.prevent="saveSettings" class="kpi-form">
            <!-- Top Controls: User & Year -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Select User</label>
                <select 
                  v-model="selectedUserId" 
                  class="select" 
                  @change="loadSettings"
                >
                  <option value="" disabled>Select a User</option>
                  <option v-for="user in users" :key="user._id" :value="user._id">
                    {{ user.username }} {{ user.email ? `(${user.email})` : '' }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Year</label>
                <input 
                  v-model.number="selectedYear" 
                  type="number" 
                  class="input"
                  @change="loadSettings"
                />
              </div>
            </div>

            <!-- Targets Section -->
            <div class="targets-section">
              <div class="targets-header">
                <h3>Target Goals</h3>
                <button type="button" class="btn btn-primary btn-sm" @click="addTarget">
                  + Add Target
                </button>
              </div>

              <div class="table-container">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Tag / Condition</th>
                      <th style="width: 120px;">Target Value</th>
                      <th style="width: 60px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="targets.length === 0">
                      <td colspan="4" class="text-center text-muted">
                        No targets configured. Click "Add Target" to add one.
                      </td>
                    </tr>
                    <tr v-for="(target, index) in targets" :key="index">
                      <td>
                        <select v-model="target.metric" class="select">
                          <option 
                            v-for="opt in metricOptions" 
                            :key="opt.value" 
                            :value="opt.value"
                          >
                            {{ opt.label }}
                          </option>
                        </select>
                      </td>
                      <td>
                        <input 
                          v-model="target.tag" 
                          type="text" 
                          class="input"
                          placeholder="e.g. pentest2026"
                        />
                      </td>
                      <td>
                        <input 
                          v-model.number="target.targetValue" 
                          type="number" 
                          class="input"
                          placeholder="0"
                          min="0"
                        />
                      </td>
                      <td class="text-center">
                        <button 
                          type="button" 
                          class="delete-btn"
                          @click="removeTarget(index)"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Actions -->
            <div class="form-actions">
              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="isSaving"
              >
                {{ isSaving ? 'Saving...' : 'Save Settings' }}
              </button>
            </div>
          </form>
        </BentoCard>
      </BentoGrid>
    </main>
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

.kpi-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-row { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: var(--spacing-md); 
}

.targets-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.targets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.targets-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: white;
}

.table td .select,
.table td .input {
  margin-bottom: 0;
  font-size: 0.875rem;
}

.delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--glass-border);
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
