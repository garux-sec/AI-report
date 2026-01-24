<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectsApi } from '../api/projects'
import { reportsApi } from '../api/reports'
import { frameworksApi } from '../api/frameworks'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Doughnut, Bar } from 'vue-chartjs'

const toast = useToast()
const { confirm } = useConfirm()

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id)

// Data
const project = ref(null)
// ... existing refs ...
const reports = ref([])
const frameworks = ref([])
const isLoading = ref(true)
const showModal = ref(false)

// Pagination & Search
const currentPage = ref(1)
const itemsPerPage = 10
const searchTerm = ref('')
const sortField = ref('createdAt')
const sortDirection = ref('desc')

// New Report Form
const newReportForm = ref({
  systemName: '',
  frameworks: [],
  tags: []
})

const allTags = ref([])
const tagInput = ref('')

// Charts
const severityData = ref({
  labels: ['Critical', 'High', 'Medium', 'Low'],
  datasets: [{
    data: [0, 0, 0, 0],
    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
    borderWidth: 0
  }]
})

const statusData = ref({
  labels: ['Open', 'Fixed'],
  datasets: [{
    data: [0, 0],
    backgroundColor: ['#ef4444', '#22c55e'],
    borderWidth: 0
  }]
})

const owaspData = ref({
  labels: [],
  datasets: [{
    label: 'Occurrences',
    data: [],
    backgroundColor: '#6366f1',
    borderRadius: 4
  }]
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: {
      position: 'right',
      labels: { color: '#94a3b8', padding: 12 }
    }
  }
}

const barOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
    y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
  }
}



// Computed
const filteredReports = computed(() => {
  let result = [...reports.value]
  
  // Filter by search
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    result = result.filter(r => 
      r.systemName?.toLowerCase().includes(term) ||
      r.url?.toLowerCase().includes(term)
    )
  }
  
  // Sort
  result.sort((a, b) => {
    let valA, valB
    switch(sortField.value) {
      case 'systemName':
        valA = (a.systemName || '').toLowerCase()
        valB = (b.systemName || '').toLowerCase()
        break
      case 'createdAt':
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
        break
      case 'status':
        valA = getReportStatus(a)
        valB = getReportStatus(b)
        break
      default:
        valA = 0; valB = 0
    }
    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
  
  return result
})

const paginatedReports = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredReports.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredReports.value.length / itemsPerPage))

// Functions
const loadProject = async () => {
  try {
    project.value = await projectsApi.getById(projectId.value)
  } catch (error) {
    console.error('Failed to load project:', error)
    toast.error('Failed to load project')
  }
}

const loadReports = async () => {
  try {
    reports.value = await reportsApi.getAll({ projectId: projectId.value })
    updateCharts()
  } catch (error) {
    console.error('Failed to load reports:', error)
    toast.error('Failed to load reports')
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

const loadTags = async () => {
  try {
    allTags.value = await reportsApi.getAllTags()
  } catch (error) {
    console.error('Failed to load tags:', error)
  }
}

const updateCharts = () => {
  // Aggregate severity counts
  const severity = { critical: 0, high: 0, medium: 0, low: 0 }
  const status = { Open: 0, Fixed: 0 }
  const owasp = {}
  
  reports.value.forEach(r => {
    let hasOpen = false
    if (r.vulnerabilities) {
      r.vulnerabilities.forEach(v => {
        const s = (v.severity || 'low').toLowerCase()
        if (severity[s] !== undefined) severity[s]++
        if ((v.status || 'Open') === 'Open') hasOpen = true
        if (v.owasp) {
          const cat = v.owasp.split(':')[0].trim()
          owasp[cat] = (owasp[cat] || 0) + 1
        }
      })
    }
    if (hasOpen || (r.vulnerabilities && r.vulnerabilities.length === 0)) {
      status.Open++
    } else if (r.vulnerabilities && r.vulnerabilities.length > 0) {
      status.Fixed++
    }
  })
  
  severityData.value = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [severity.critical, severity.high, severity.medium, severity.low],
      backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
      borderWidth: 0
    }]
  }
  
  statusData.value = {
    labels: ['Open', 'Fixed'],
    datasets: [{
      data: [status.Open, status.Fixed],
      backgroundColor: ['#ef4444', '#22c55e'],
      borderWidth: 0
    }]
  }
  
  // OWASP Top 5
  const sortedOwasp = Object.entries(owasp).sort((a, b) => b[1] - a[1]).slice(0, 5)
  owaspData.value = {
    labels: sortedOwasp.map(x => x[0]),
    datasets: [{
      label: 'Occurrences',
      data: sortedOwasp.map(x => x[1]),
      backgroundColor: '#6366f1',
      borderRadius: 4
    }]
  }
}

const getReportStatus = (report) => {
  if (!report.vulnerabilities || report.vulnerabilities.length === 0) return 'Open'
  const hasOpen = report.vulnerabilities.some(v => (v.status || 'Open') === 'Open')
  return hasOpen ? 'Open' : 'Fixed'
}

const getVulnBadges = (report) => {
  const stats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  if (report.vulnerabilities) {
    report.vulnerabilities.forEach(v => {
      const s = (v.severity || 'low').toLowerCase()
      if (stats[s] !== undefined) stats[s]++
    })
  }
  return stats
}

const sortTable = (field) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
}

const openModal = () => {
  newReportForm.value = { systemName: '', frameworks: [], tags: [] }
  showModal.value = true
  loadFrameworks()
  loadTags()
}

const closeModal = () => {
  showModal.value = false
}

const addTag = () => {
  const tag = tagInput.value.trim()
  if (tag && !newReportForm.value.tags.includes(tag)) {
    newReportForm.value.tags.push(tag)
  }
  tagInput.value = ''
}

const removeTag = (tag) => {
  newReportForm.value.tags = newReportForm.value.tags.filter(t => t !== tag)
}

const createReport = async () => {
  try {
    const result = await reportsApi.create({
      systemName: newReportForm.value.systemName,
      frameworks: newReportForm.value.frameworks,
      tags: newReportForm.value.tags,
      project: projectId.value
    })
    toast.success('Report created successfully')
    router.push(`/report/${result.reportId}/edit?projectId=${projectId.value}`)
  } catch (error) {
    toast.error('Failed to create report: ' + (error.response?.data?.message || error.message))
  }
}

const deleteReport = async (id) => {
  const confirmed = await confirm({
    title: 'Delete Report?',
    message: 'Are you sure you want to delete this report? This action cannot be undone.',
    type: 'danger',
    confirmText: 'Delete'
  })

  if (!confirmed) return

  try {
    await reportsApi.delete(id)
    toast.success('Report deleted')
    loadReports()
  } catch (error) {
    console.error('Failed to delete:', error)
    toast.error('Failed to delete report')
  }
}

const downloadPdf = async (id) => {
  try {
    const blob = await reportsApi.generatePDF(id)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${id}.pdf`
    a.click()
  } catch (error) {
    console.error('Failed to download PDF:', error)
  }
}

const formatDate = (date) => new Date(date).toLocaleDateString('th-TH')

onMounted(() => {
  loadProject()
  loadReports()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <!-- Project Header -->
      <div v-if="project" class="project-header">
        <div class="project-logo">
          <img v-if="project.logoUrl" :src="project.logoUrl" alt="Logo" />
          <span v-else>📁</span>
        </div>
        <div class="project-info">
          <div class="project-title-row">
            <div>
              <h1>{{ project.name }}</h1>
              <p class="project-description">{{ project.description || 'No description' }}</p>
            </div>
            <span class="status-badge">{{ project.status?.toUpperCase() }}</span>
          </div>
          <div class="project-meta">
            <div class="meta-item">
              <label>Client</label>
              <div>{{ project.clientName || '-' }}</div>
            </div>
            <div class="meta-item">
              <label>Prepared By</label>
              <div>{{ project.preparedBy || '-' }}</div>
            </div>
            <div class="meta-item">
              <label>Pentester</label>
              <div>{{ project.pentesterName || '-' }}</div>
            </div>
            <div class="meta-item">
              <label>Created</label>
              <div>{{ formatDate(project.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Section -->
      <BentoGrid v-if="reports.length > 0 || !isLoading">
        <!-- Row 1: Stats + Action (4 items) -->
        <BentoCard title="Total Reports" :value="reports.length" />
        <BentoCard title="Total Vulnerabilities" :value="reports.reduce((sum, r) => sum + (r.vulnerabilities?.length || 0), 0)" />
        <BentoCard title="Open Issues" :value="reports.reduce((sum, r) => sum + (r.vulnerabilities?.filter(v => (v.status || 'Open') === 'Open').length || 0), 0)" variant="highlight" />
        
        <!-- New Report Action Card -->
        <BentoCard>
          <div class="action-card" @click="openModal">
            <div class="action-icon">📝</div>
            <div class="action-content">
              <h3>New Report</h3>
              <p>Create new pentest report</p>
            </div>
            <div class="action-arrow">→</div>
          </div>
        </BentoCard>
        
        <!-- Row 2: Charts (all 3 side by side) -->
        <!-- Severity Chart -->
        <BentoCard title="Vulnerabilities by Severity">
          <div class="chart-container">
            <Doughnut :data="severityData" :options="chartOptions" />
          </div>
        </BentoCard>

        <!-- Status Chart -->
        <BentoCard title="Report Status">
          <div class="chart-container">
            <Doughnut :data="statusData" :options="chartOptions" />
          </div>
        </BentoCard>

        <!-- OWASP Chart -->
        <BentoCard title="Top OWASP Categories" :span="2">
          <div class="chart-container">
            <Bar :data="owaspData" :options="barOptions" />
          </div>
        </BentoCard>
      </BentoGrid>

      <!-- Reports Section -->
      <div class="section-header">
        <h2 class="section-title">📄 Reports</h2>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <input 
          v-model="searchTerm" 
          type="text" 
          class="input" 
          placeholder="Search by system name or URL..."
        />
      </div>

      <!-- Reports Table -->
      <BentoGrid>
        <BentoCard :span="4">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th @click="sortTable('systemName')" class="sortable">
                    System Name
                    <span v-if="sortField === 'systemName'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th @click="sortTable('createdAt')" class="sortable">
                    Date
                    <span v-if="sortField === 'createdAt'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th @click="sortTable('status')" class="sortable">
                    Status
                    <span v-if="sortField === 'status'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th>Vulnerabilities</th>
                  <th>Tags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="6" class="text-center text-muted">Loading...</td>
                </tr>
                <tr v-else-if="paginatedReports.length === 0">
                  <td colspan="6" class="text-center text-muted">No reports found.</td>
                </tr>
                <tr v-for="report in paginatedReports" :key="report._id">
                  <td>
                    <router-link :to="`/report/${report._id}/edit?projectId=${projectId}`" class="report-link">
                      {{ report.systemName }}
                    </router-link>
                    <div class="report-url">{{ report.url || '' }}</div>
                  </td>
                  <td class="text-muted">{{ formatDate(report.createdAt) }}</td>
                  <td>
                    <span :class="['status-tag', getReportStatus(report).toLowerCase()]">
                      {{ getReportStatus(report) }}
                    </span>
                  </td>
                  <td>
                    <div class="vuln-badges">
                      <span v-if="getVulnBadges(report).critical > 0" class="badge critical">
                        C: {{ getVulnBadges(report).critical }}
                      </span>
                      <span v-if="getVulnBadges(report).high > 0" class="badge high">
                        H: {{ getVulnBadges(report).high }}
                      </span>
                      <span v-if="getVulnBadges(report).medium > 0" class="badge medium">
                        M: {{ getVulnBadges(report).medium }}
                      </span>
                      <span v-if="getVulnBadges(report).low > 0" class="badge low">
                        L: {{ getVulnBadges(report).low }}
                      </span>
                      <span v-if="!report.vulnerabilities?.length" class="text-muted">No Issues</span>
                    </div>
                  </td>
                  <td>
                    <div class="tag-badges">
                      <span v-for="tag in report.tags" :key="tag" class="badge tag">{{ tag }}</span>
                      <span v-if="!report.tags?.length" class="text-muted">No tags</span>
                    </div>
                  </td>
                  <td>
                    <div class="actions-cell">
                      <router-link :to="`/report/${report._id}`" class="btn btn-sm btn-icon" title="View">
                        👁️
                      </router-link>
                      <router-link :to="`/report/${report._id}/edit?projectId=${projectId}`" class="btn btn-sm btn-icon btn-primary-icon" title="Edit">
                        ✏️
                      </router-link>
                      <button @click="downloadPdf(report._id)" class="btn btn-sm btn-icon btn-success-icon" title="PDF">
                        📄
                      </button>
                      <button @click="deleteReport(report._id)" class="btn btn-sm btn-icon btn-danger-icon" title="Delete">
                        🗑️
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
              class="btn btn-sm" 
              :disabled="currentPage <= 1"
              @click="currentPage--"
            >
              Previous
            </button>
            <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
            <button 
              class="btn btn-sm" 
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            >
              Next
            </button>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>

    <!-- New Report Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">New Report</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        
        <form @submit.prevent="createReport" class="modal-body">
          <div class="form-group">
            <label class="form-label">System Name *</label>
            <input v-model="newReportForm.systemName" type="text" class="input" required />
          </div>

          <div class="form-group">
            <label class="form-label">Frameworks</label>
            <div class="frameworks-grid">
              <label v-for="fw in frameworks" :key="fw._id" class="framework-option">
                <input 
                  type="checkbox" 
                  :value="fw._id" 
                  v-model="newReportForm.frameworks"
                />
                <span>{{ fw.name }} ({{ fw.year }})</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tags</label>
            <div class="tags-input">
              <input 
                v-model="tagInput" 
                type="text" 
                class="input" 
                placeholder="Type and press Enter to add"
                @keydown.enter.prevent="addTag"
              />
              <div class="selected-tags">
                <span v-for="tag in newReportForm.tags" :key="tag" class="badge tag">
                  {{ tag }}
                  <button type="button" @click="removeTag(tag)">×</button>
                </span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Report</button>
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

/* Project Header */
.project-header {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  margin-bottom: var(--spacing-xl);
}

.project-logo {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 2rem;
}

.project-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-info {
  flex: 1;
}

.project-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.project-title-row h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.project-description {
  color: var(--text-muted);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.1);
}

.project-meta {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
}

.meta-item label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 2px;
}

.meta-item div {
  font-weight: 500;
}

/* Action Card */
.action-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}

.action-card:hover {
  background: linear-gradient(135deg, #818cf8, #c084fc);
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5);
}

.action-icon {
  font-size: 2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.action-content {
  flex: 1;
}

.action-content h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
}

.action-content p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.action-arrow {
  font-size: 1.5rem;
  color: var(--primary-color);
  transition: transform 0.3s ease;
}

.action-card:hover .action-arrow {
  transform: translateX(4px);
}

/* Section Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: var(--spacing-xl) 0 var(--spacing-md);
}

.section-title {
  margin: 0;
  font-size: 1.25rem;
}

.search-bar {
  margin-bottom: var(--spacing-md);
}

.search-bar .input {
  max-width: 400px;
}

/* Chart */
.chart-container {
  height: 200px;
}

/* Table */
.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  color: var(--primary-color);
}

.report-link {
  font-weight: 600;
  color: white;
  text-decoration: none;
}

.report-link:hover {
  color: var(--primary-color);
}

.report-url {
  font-size: 0.8rem;
  opacity: 0.6;
}

.status-tag {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-tag.open {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.status-tag.fixed {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.vuln-badges, .tag-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid;
}

.badge.critical { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: #ef4444; }
.badge.high { background: rgba(249, 115, 22, 0.1); color: #f97316; border-color: #f97316; }
.badge.medium { background: rgba(234, 179, 8, 0.1); color: #eab308; border-color: #eab308; }
.badge.low { background: rgba(34, 197, 94, 0.1); color: #22c55e; border-color: #22c55e; }
.badge.tag { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border-color: rgba(99, 102, 241, 0.3); }

.actions-cell {
  display: flex;
  gap: 4px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(55, 65, 81, 0.5);
}

.btn-primary-icon { background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); }
.btn-success-icon { background: linear-gradient(135deg, #14b8a6, #10b981); }
.btn-danger-icon { background: linear-gradient(135deg, #ef4444, #ec4899); }

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--glass-border);
}

.page-info {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Frameworks grid */
.frameworks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.framework-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.framework-option:hover {
  border-color: var(--primary-color);
}

.framework-option input[type="checkbox"] {
  accent-color: var(--primary-color);
}

.tags-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.selected-tags .badge button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  margin-left: 4px;
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
