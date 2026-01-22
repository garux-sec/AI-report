<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectsApi } from '../api/projects'
import { reportsApi } from '../api/reports'
import { frameworksApi } from '../api/frameworks'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const route = useRoute()
const router = useRouter()
const projectId = route.params.id

const project = ref(null)
const reports = ref([])
const frameworks = ref([])
const isLoading = ref(true)
const showModal = ref(false)

// Pagination & Search
const currentPage = ref(1)
const itemsPerPage = 10
const searchTerm = ref('')
const currentSort = ref({ field: 'createdAt', direction: 'desc' })

// Form data
const formData = ref({
  title: '',
  systemName: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  selectedFrameworks: []
})

// Filtered and sorted reports
const filteredReports = computed(() => {
  let result = [...reports.value]
  
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    result = result.filter(r => 
      r.title?.toLowerCase().includes(term) ||
      r.systemName?.toLowerCase().includes(term)
    )
  }
  
  result.sort((a, b) => {
    const aVal = a[currentSort.value.field]
    const bVal = b[currentSort.value.field]
    const dir = currentSort.value.direction === 'asc' ? 1 : -1
    
    if (typeof aVal === 'string') {
      return dir * aVal.localeCompare(bVal)
    }
    return dir * (new Date(aVal) - new Date(bVal))
  })
  
  return result
})

const paginatedReports = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredReports.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredReports.value.length / itemsPerPage))

// Stats
const stats = computed(() => {
  const vulns = reports.value.reduce((acc, r) => {
    (r.vulnerabilities || []).forEach(v => {
      acc[v.severity] = (acc[v.severity] || 0) + 1
    })
    return acc
  }, {})
  
  return {
    total: reports.value.length,
    draft: reports.value.filter(r => r.status === 'draft').length,
    completed: reports.value.filter(r => r.status === 'completed').length,
    vulnerabilities: vulns
  }
})

// Chart data
const vulnChartData = computed(() => ({
  labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
  datasets: [{
    data: [
      stats.value.vulnerabilities.Critical || 0,
      stats.value.vulnerabilities.High || 0,
      stats.value.vulnerabilities.Medium || 0,
      stats.value.vulnerabilities.Low || 0,
      stats.value.vulnerabilities.Info || 0
    ],
    backgroundColor: ['#dc2626', '#ea580c', '#eab308', '#22c55e', '#0ea5e9'],
    borderWidth: 0
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: { color: '#94a3b8', usePointStyle: true }
    }
  }
}

const loadProject = async () => {
  try {
    project.value = await projectsApi.getById(projectId)
  } catch (error) {
    console.error('Failed to load project:', error)
    router.push('/projects')
  }
}

const loadReports = async () => {
  try {
    const all = await reportsApi.getAll({ projectId })
    reports.value = all
  } catch (error) {
    console.error('Failed to load reports:', error)
  } finally {
    isLoading.value = false
  }
}

const loadFrameworks = async () => {
  try {
    frameworks.value = await frameworksApi.getAll()
  } catch (error) {
    console.error('Failed to load frameworks:', error)
  }
}

const openModal = () => {
  formData.value = {
    title: '',
    systemName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    selectedFrameworks: []
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const createReport = async () => {
  try {
    const data = {
      ...formData.value,
      projectId,
      frameworkIds: formData.value.selectedFrameworks
    }
    const newReport = await reportsApi.create(data)
    router.push(`/report/${newReport._id}/edit`)
  } catch (error) {
    console.error('Failed to create report:', error)
    alert(error.response?.data?.message || 'Error creating report')
  }
}

const deleteReport = async (id) => {
  if (!confirm('Delete this report?')) return
  try {
    await reportsApi.delete(id)
    loadReports()
  } catch (error) {
    console.error('Failed to delete report:', error)
  }
}

const toggleFramework = (id) => {
  const idx = formData.value.selectedFrameworks.indexOf(id)
  if (idx === -1) {
    formData.value.selectedFrameworks.push(id)
  } else {
    formData.value.selectedFrameworks.splice(idx, 1)
  }
}

const sortTable = (field) => {
  if (currentSort.value.field === field) {
    currentSort.value.direction = currentSort.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    currentSort.value = { field, direction: 'asc' }
  }
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('th-TH')
}

const getSeverityClass = (severity) => {
  return `badge-${severity?.toLowerCase() || 'info'}`
}

onMounted(() => {
  loadProject()
  loadReports()
  loadFrameworks()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <header class="page-header">
        <div>
          <router-link to="/projects" class="back-link">← Back to Projects</router-link>
          <h1>{{ project?.name || 'Loading...' }}</h1>
          <p class="page-subtitle">{{ project?.clientName }}</p>
        </div>
        <button class="btn btn-primary" @click="openModal">
          + New Report
        </button>
      </header>

      <BentoGrid>
        <!-- Stats Cards -->
        <BentoCard title="Total Reports" :value="stats.total" />
        <BentoCard title="Draft" :value="stats.draft" />
        <BentoCard title="Completed" :value="stats.completed" variant="success" />
        
        <!-- Vulnerability Chart -->
        <BentoCard title="Vulnerability Distribution" :row="2">
          <div class="chart-container">
            <Doughnut :data="vulnChartData" :options="chartOptions" />
          </div>
        </BentoCard>

        <!-- Reports Table -->
        <BentoCard title="Reports" :span="3">
          <!-- Search -->
          <div class="table-controls">
            <input 
              v-model="searchTerm"
              type="text"
              class="input"
              placeholder="Search reports..."
              style="max-width: 300px;"
            />
          </div>

          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th @click="sortTable('title')" class="sortable">
                    Title
                    <span v-if="currentSort.field === 'title'">
                      {{ currentSort.direction === 'asc' ? '↑' : '↓' }}
                    </span>
                  </th>
                  <th>System</th>
                  <th @click="sortTable('createdAt')" class="sortable">
                    Date
                    <span v-if="currentSort.field === 'createdAt'">
                      {{ currentSort.direction === 'asc' ? '↑' : '↓' }}
                    </span>
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="paginatedReports.length === 0">
                  <td colspan="5" class="text-center text-muted">
                    {{ isLoading ? 'Loading...' : 'No reports found' }}
                  </td>
                </tr>
                <tr v-for="report in paginatedReports" :key="report._id">
                  <td>
                    <router-link :to="`/report/${report._id}/view`" class="report-link">
                      {{ report.title }}
                    </router-link>
                  </td>
                  <td>{{ report.systemName || '-' }}</td>
                  <td>{{ formatDate(report.createdAt) }}</td>
                  <td>
                    <span :class="['badge', report.status === 'completed' ? 'badge-low' : 'badge-info']">
                      {{ report.status }}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-sm">
                      <router-link 
                        :to="`/report/${report._id}/edit`"
                        class="btn btn-sm btn-secondary"
                      >
                        Edit
                      </router-link>
                      <button 
                        class="btn btn-sm btn-danger"
                        @click="deleteReport(report._id)"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination">
            <button 
              class="btn btn-sm btn-secondary"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              Prev
            </button>
            <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
            <button 
              class="btn btn-sm btn-secondary"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              Next
            </button>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <!-- Create Report Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h2 class="modal-title">New Report</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        
        <form @submit.prevent="createReport" class="modal-body">
          <div class="form-group">
            <label class="form-label">Report Title *</label>
            <input v-model="formData.title" type="text" class="input" required />
          </div>

          <div class="form-group">
            <label class="form-label">System Name</label>
            <input v-model="formData.systemName" type="text" class="input" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input v-model="formData.startDate" type="date" class="input" />
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input v-model="formData.endDate" type="date" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Frameworks</label>
            <div class="framework-grid">
              <label 
                v-for="fw in frameworks" 
                :key="fw._id"
                class="framework-option"
                :class="{ selected: formData.selectedFrameworks.includes(fw._id) }"
              >
                <input 
                  type="checkbox"
                  :checked="formData.selectedFrameworks.includes(fw._id)"
                  @change="toggleFramework(fw._id)"
                  style="display: none;"
                />
                <span>{{ fw.name }} {{ fw.version }}</span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Create & Edit
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
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
}

.back-link {
  display: inline-block;
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-bottom: var(--spacing-xs);
}

.back-link:hover {
  color: var(--primary-color);
}

.page-subtitle {
  color: var(--text-muted);
  margin: 0;
}

.chart-container {
  height: 180px;
}

.table-controls {
  margin-bottom: var(--spacing-md);
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  color: var(--primary-color);
}

.report-link {
  color: var(--text-color);
  font-weight: 500;
}

.report-link:hover {
  color: var(--primary-color);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.page-info {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.framework-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.framework-option {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.framework-option:hover {
  border-color: var(--primary-color);
}

.framework-option.selected {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--primary-color);
  color: var(--primary-color);
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
