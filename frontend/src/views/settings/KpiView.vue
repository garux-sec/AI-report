<script setup>
import { ref, onMounted } from 'vue'
import { kpiApi } from '../../api/users'
import Sidebar from '../../components/layout/Sidebar.vue'
import BentoGrid from '../../components/layout/BentoGrid.vue'
import BentoCard from '../../components/layout/BentoCard.vue'

const users = ref([])
const selectedUserId = ref('')
const selectedYear = ref(new Date().getFullYear())
const kpiSettings = ref(null)
const isLoading = ref(true)
const isSaving = ref(false)

const targets = ref({
  totalProjects: 0,
  totalReports: 0,
  criticalVulns: 0,
  highVulns: 0
})

const loadUsers = async () => {
  try {
    users.value = await kpiApi.getUsers()
    if (users.value.length > 0) {
      selectedUserId.value = users.value[0]._id
      loadKpiSettings()
    }
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    isLoading.value = false
  }
}

const loadKpiSettings = async () => {
  if (!selectedUserId.value) return
  try {
    const result = await kpiApi.getSettings({
      userId: selectedUserId.value,
      year: selectedYear.value
    })
    kpiSettings.value = result
    if (result?.targets) {
      targets.value = { ...result.targets }
    } else {
      targets.value = { totalProjects: 0, totalReports: 0, criticalVulns: 0, highVulns: 0 }
    }
  } catch (error) {
    console.error('Failed to load KPI settings:', error)
  }
}

const saveSettings = async () => {
  isSaving.value = true
  try {
    await kpiApi.saveSettings({
      userId: selectedUserId.value,
      year: selectedYear.value,
      targets: targets.value
    })
    alert('KPI settings saved!')
  } catch (error) {
    alert('Failed to save: ' + (error.response?.data?.message || error.message))
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
        <BentoCard title="Select User & Year" :span="2">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">User</label>
              <select v-model="selectedUserId" class="select" @change="loadKpiSettings">
                <option v-for="user in users" :key="user._id" :value="user._id">
                  {{ user.username }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Year</label>
              <select v-model="selectedYear" class="select" @change="loadKpiSettings">
                <option v-for="y in [2024, 2025, 2026, 2027]" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
          </div>
        </BentoCard>

        <BentoCard title="KPI Targets" :span="2">
          <div class="kpi-grid">
            <div class="kpi-item">
              <label class="form-label">Total Projects Goal</label>
              <input v-model.number="targets.totalProjects" type="number" class="input" min="0" />
            </div>
            <div class="kpi-item">
              <label class="form-label">Total Reports Goal</label>
              <input v-model.number="targets.totalReports" type="number" class="input" min="0" />
            </div>
            <div class="kpi-item">
              <label class="form-label">Critical Vulnerabilities Goal</label>
              <input v-model.number="targets.criticalVulns" type="number" class="input" min="0" />
            </div>
            <div class="kpi-item">
              <label class="form-label">High Vulnerabilities Goal</label>
              <input v-model.number="targets.highVulns" type="number" class="input" min="0" />
            </div>
          </div>
          <button 
            class="btn btn-primary mt-lg"
            @click="saveSettings"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save KPI Settings' }}
          </button>
        </BentoCard>
      </BentoGrid>
    </main>
  </div>
</template>

<style scoped>
.dashboard-layout { display: flex; min-height: 100vh; }
.main-content { flex: 1; padding: var(--spacing-lg); overflow-y: auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); }
.page-header h1 { margin: 0; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
.kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
.kpi-item { margin-bottom: var(--spacing-sm); }
.mt-lg { margin-top: var(--spacing-lg); }
</style>
