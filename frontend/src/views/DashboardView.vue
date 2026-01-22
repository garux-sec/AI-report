<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { reportsApi } from '../api/reports'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Doughnut, Bar } from 'vue-chartjs'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const authStore = useAuthStore()
const stats = ref({
  totalProjects: 0,
  totalReports: 0,
  totalVulnerabilities: 0
})
const recentRisks = ref([])
const isLoading = ref(true)

// Chart data
const severityData = ref({
  labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
  datasets: [{
    data: [0, 0, 0, 0, 0],
    backgroundColor: ['#dc2626', '#ea580c', '#eab308', '#22c55e', '#0ea5e9'],
    borderWidth: 0
  }]
})

const statusData = ref({
  labels: ['Draft', 'In Progress', 'Completed'],
  datasets: [{
    data: [0, 0, 0],
    backgroundColor: ['#64748b', '#f59e0b', '#10b981'],
    borderRadius: 8
  }]
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#94a3b8',
        padding: 16,
        usePointStyle: true
      }
    }
  }
}

const barOptions = {
  ...chartOptions,
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8' }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#94a3b8' }
    }
  }
}

const fetchDashboardStats = async () => {
  try {
    const data = await reportsApi.getDashboardStats()
    
    stats.value = {
      totalProjects: data.totalProjects || 0,
      totalReports: data.totalReports || 0,
      totalVulnerabilities: data.totalVulnerabilities || 0
    }

    // Update severity chart
    if (data.vulnerabilitiesBySeverity) {
      const sev = data.vulnerabilitiesBySeverity
      severityData.value.datasets[0].data = [
        sev.Critical || 0,
        sev.High || 0,
        sev.Medium || 0,
        sev.Low || 0,
        sev.Info || 0
      ]
    }

    // Update status chart
    if (data.reportsByStatus) {
      const st = data.reportsByStatus
      statusData.value.datasets[0].data = [
        st.draft || 0,
        st['in-progress'] || 0,
        st.completed || 0
      ]
    }

    // Recent risks
    recentRisks.value = data.recentCriticalRisks || []
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
  } finally {
    isLoading.value = false
  }
}

const getSeverityClass = (severity) => {
  const classes = {
    Critical: 'badge-critical',
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
    Info: 'badge-info'
  }
  return classes[severity] || 'badge-info'
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(() => {
  fetchDashboardStats()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <header class="page-header">
        <h1>Dashboard</h1>
        <div class="user-info">
          <span>{{ authStore.username }}</span>
        </div>
      </header>

      <BentoGrid>
        <!-- Stats Cards Row -->
        <BentoCard title="Total Projects" :value="stats.totalProjects" />
        <BentoCard title="Total Reports" :value="stats.totalReports" />
        <BentoCard 
          title="Total Vulnerabilities" 
          :value="stats.totalVulnerabilities" 
          variant="highlight"
        />
        
        <!-- Quick Actions -->
        <BentoCard title="Quick Actions">
          <div class="quick-actions">
            <router-link to="/projects" class="btn btn-primary">
              View Projects
            </router-link>
          </div>
        </BentoCard>

        <!-- Severity Chart -->
        <BentoCard title="Vulnerabilities by Severity" :span="2" :row="2">
          <div class="chart-container">
            <Doughnut :data="severityData" :options="chartOptions" />
          </div>
        </BentoCard>

        <!-- Status Chart -->
        <BentoCard title="Reports by Status" :span="2">
          <div class="chart-container">
            <Bar :data="statusData" :options="barOptions" />
          </div>
        </BentoCard>

        <!-- Recent Risks Table -->
        <BentoCard title="Latest Critical & High Risks" :span="4">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Vulnerability</th>
                  <th>System/Project</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="recentRisks.length === 0">
                  <td colspan="5" class="text-center text-muted">
                    {{ isLoading ? 'Loading...' : 'No critical risks found' }}
                  </td>
                </tr>
                <tr v-for="risk in recentRisks" :key="risk._id">
                  <td>{{ risk.title }}</td>
                  <td>{{ risk.projectName || '-' }}</td>
                  <td>
                    <span :class="['badge', getSeverityClass(risk.severity)]">
                      {{ risk.severity }}
                    </span>
                  </td>
                  <td>{{ risk.status || 'Open' }}</td>
                  <td>{{ formatDate(risk.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
  background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 40%);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.user-info {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.chart-container {
  height: 200px;
  position: relative;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
</style>
