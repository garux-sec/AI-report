<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { reportsApi } from '../api/reports'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const authStore = useAuthStore()
const stats = ref({
  projects: 0,
  reports: 0,
  vulnerabilities: 0
})
const recentRisks = ref([])
const kpiGoals = ref([])
const isLoading = ref(true)

// Chart data
const severityData = ref({
  labels: ['Critical', 'High', 'Medium', 'Low'],
  datasets: [{
    data: [0, 0, 0, 0],
    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
    borderWidth: 0,
    hoverOffset: 4
  }]
})

const statusData = ref({
  labels: ['Open', 'Fixed'],
  datasets: [{
    data: [0, 0],
    backgroundColor: ['#ef4444', '#22c55e'],
    borderWidth: 0,
    hoverOffset: 4
  }]
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#cbd5e1',
        padding: 16,
        usePointStyle: true
      }
    }
  }
}

// KPI Summary
const kpiSummary = computed(() => {
  const total = kpiGoals.value.length
  if (total === 0) return { total: 0, avg: 0, text: '', color: 'text-slate-400' }
  
  const avg = Math.round(kpiGoals.value.reduce((acc, g) => acc + g.percent, 0) / total)
  let text = 'Keep pushing to reach your targets!'
  let color = 'text-slate-400'
  
  if (avg >= 100) { text = 'Excellent! All targets achieved.'; color = 'text-green-400' }
  else if (avg >= 75) { text = 'Great progress! You are close to your goals.'; color = 'text-indigo-400' }
  else if (avg >= 50) { text = 'Good start. Keep improving metrics.'; color = 'text-blue-400' }
  
  return { total, avg, text, color }
})

const fetchDashboardStats = async () => {
  try {
    const data = await reportsApi.getDashboardStats()
    
    // Update counts (matching original structure)
    stats.value = {
      projects: data.counts?.projects || 0,
      reports: data.counts?.reports || 0,
      vulnerabilities: data.counts?.vulnerabilities || 0
    }

    // Update severity chart - create new object for reactivity
    if (data.vulnerabilities?.severity) {
      const sev = data.vulnerabilities.severity
      severityData.value = {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [
            sev.Critical || 0,
            sev.High || 0,
            sev.Medium || 0,
            sev.Low || 0
          ],
          backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      }
    }

    // Update status chart (Open vs Fixed) - create new object for reactivity
    if (data.reportStats) {
      statusData.value = {
        labels: ['Open', 'Fixed'],
        datasets: [{
          data: [
            data.reportStats.Open || 0,
            data.reportStats.Fixed || 0
          ],
          backgroundColor: ['#ef4444', '#22c55e'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      }
    }

    // Recent risks
    recentRisks.value = data.recentRisks || []
    
    // KPI Goals
    kpiGoals.value = data.goals || []

  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
  } finally {
    isLoading.value = false
  }
}

const getSeverityColor = (severity) => {
  const colors = {
    Critical: 'text-red-400',
    High: 'text-orange-400',
    Medium: 'text-yellow-400',
    Low: 'text-green-400'
  }
  return colors[severity] || 'text-slate-400'
}

const getStatusClass = (status) => {
  return status === 'Open' 
    ? 'bg-red-500/10 text-red-400' 
    : 'bg-green-500/10 text-green-400'
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('th-TH')
}

const getMetricName = (metric) => {
  const names = {
    'ReportsClosed': 'Reports Closed (Fixed)',
    'ReportsCompleted': 'Reports Submitted',
    'VulnerabilitiesFound': 'Vulns Found'
  }
  return names[metric] || metric
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

      <!-- KPI Goals Section -->
      <div v-if="kpiGoals.length > 0" class="kpi-section">
        <div class="kpi-header">
          <div>
            <h2 class="kpi-title">
              <span class="kpi-icon">🏆</span> My KPI Goals
            </h2>
            <p class="kpi-subtitle">Track your yearly performance targets and vulnerability remediation progress.</p>
            <p :class="['kpi-summary', kpiSummary.color]">
              📈 Summary: <strong>{{ kpiSummary.total }} Targets</strong> | 
              Overall Completion: <strong>{{ kpiSummary.avg }}%</strong> — {{ kpiSummary.text }}
            </p>
          </div>
          <span class="year-badge">Year: 2026</span>
        </div>
        
        <div class="kpi-grid">
          <div 
            v-for="goal in kpiGoals" 
            :key="goal.metric + goal.tag"
            class="kpi-card"
          >
            <div class="kpi-card-icon">🎯</div>
            <h3 class="kpi-card-title">
              {{ getMetricName(goal.metric) }}
              <span class="kpi-tag">{{ goal.tag }}</span>
            </h3>
            <div class="kpi-card-stats">
              <span class="kpi-target">Target: {{ goal.target }}</span>
              <span :class="['kpi-current', goal.percent >= 100 ? 'completed' : '']">
                {{ goal.current }} <small>/ {{ goal.target }}</small>
              </span>
            </div>
            <div class="kpi-progress-bar">
              <div 
                class="kpi-progress-fill"
                :class="{ completed: goal.percent >= 100 }"
                :style="{ width: Math.min(goal.percent, 100) + '%' }"
              ></div>
            </div>
            <div class="kpi-percent" :class="{ completed: goal.percent >= 100 }">
              {{ goal.percent }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Dashboard Section -->
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">📊</span> Summary Dashboard
        </h2>
        <p class="section-subtitle">Overview of projects, reports, and vulnerabilities.</p>
      </div>

      <BentoGrid>
        <!-- Stats Cards Row -->
        <BentoCard title="Total Projects" :value="stats.projects" />
        <BentoCard title="Total Reports" :value="stats.reports" />
        <BentoCard 
          title="Total Vulnerabilities" 
          :value="stats.vulnerabilities" 
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

        <!-- Status Chart (Open vs Fixed) -->
        <BentoCard title="Report Status (Open vs Fixed)" :span="2" :row="2">
          <div class="chart-container">
            <Doughnut :data="statusData" :options="chartOptions" />
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
                    {{ isLoading ? 'Loading...' : 'No critical or high risks found. Great job!' }}
                  </td>
                </tr>
                <tr v-for="risk in recentRisks" :key="risk._id || risk.title">
                  <td class="font-medium">{{ risk.title || 'Untitled Issue' }}</td>
                  <td>{{ risk.systemName || '-' }}</td>
                  <td :class="getSeverityColor(risk.severity)" class="font-bold">
                    {{ risk.severity }}
                  </td>
                  <td>
                    <span :class="['status-badge', getStatusClass(risk.status)]">
                      {{ risk.status || 'Open' }}
                    </span>
                  </td>
                  <td class="text-muted">{{ formatDate(risk.date) }}</td>
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
  height: 250px;
  position: relative;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Section Headers */
.section-header {
  margin-bottom: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  margin: 0 0 var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.section-icon {
  font-size: 1.25rem;
}

.section-subtitle {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin: 0;
}

/* KPI Section */
.kpi-section {
  margin-bottom: var(--spacing-xl);
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.kpi-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  margin: 0 0 var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.kpi-icon {
  color: #facc15;
}

.kpi-subtitle {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.kpi-summary {
  font-size: 0.875rem;
  margin: var(--spacing-xs) 0 0;
}

.kpi-summary strong {
  color: white;
}

.year-badge {
  padding: 0.25rem 0.75rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 9999px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: rgba(30, 41, 59, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  position: relative;
  overflow: hidden;
}

.kpi-card-icon {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  font-size: 3rem;
  opacity: 0.1;
}

.kpi-card:hover .kpi-card-icon {
  opacity: 0.2;
}

.kpi-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  margin: 0 0 var(--spacing-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.kpi-tag {
  padding: 0.125rem 0.5rem;
  background: rgba(71, 85, 105, 0.5);
  border: 1px solid rgba(100, 116, 139, 0.5);
  border-radius: 4px;
  font-size: 0.7rem;
  color: #cbd5e1;
  font-weight: 400;
}

.kpi-card-stats {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--spacing-sm);
}

.kpi-target {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.kpi-current {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.kpi-current.completed {
  color: #4ade80;
}

.kpi-current small {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-muted);
}

.kpi-progress-bar {
  width: 100%;
  height: 1rem;
  background: rgba(71, 85, 105, 0.5);
  border-radius: 9999px;
  overflow: hidden;
}

.kpi-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  border-radius: 9999px;
  transition: width 1s ease-out;
  position: relative;
}

.kpi-progress-fill.completed {
  background: #22c55e;
}

.kpi-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.2);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.4; }
}

.kpi-percent {
  text-align: right;
  margin-top: var(--spacing-xs);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary-color);
}

.kpi-percent.completed {
  color: #4ade80;
}

/* Table styles */
.font-medium {
  font-weight: 500;
  color: white;
}

.font-bold {
  font-weight: 700;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.text-red-400 { color: #f87171; }
.text-orange-400 { color: #fb923c; }
.text-yellow-400 { color: #facc15; }
.text-green-400 { color: #4ade80; }
.text-indigo-400 { color: #818cf8; }
.text-blue-400 { color: #60a5fa; }
.text-slate-400 { color: #94a3b8; }

.bg-red-500\/10 { background: rgba(239, 68, 68, 0.1); }
.bg-green-500\/10 { background: rgba(34, 197, 94, 0.1); }
</style>
