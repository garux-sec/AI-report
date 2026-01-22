<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { reportsApi } from '../api/reports'
import { projectsApi } from '../api/projects'
import { frameworksApi } from '../api/frameworks'
import Sidebar from '../components/layout/Sidebar.vue'

const route = useRoute()
const router = useRouter()
const reportId = route.params.id

const report = ref(null)
const project = ref(null)
const frameworkMap = ref({})
const isLoading = ref(true)

const loadData = async () => {
  try {
    const [reportData, frameworks] = await Promise.all([
      reportsApi.getById(reportId),
      frameworksApi.getAll()
    ])
    
    report.value = reportData
    
    // Create framework map
    frameworks.forEach(fw => {
      frameworkMap.value[fw._id] = fw
    })
    
    // Load project if available
    if (reportData.projectId) {
      try {
        project.value = await projectsApi.getById(reportData.projectId)
      } catch (e) {
        console.error('Failed to load project:', e)
      }
    }
  } catch (error) {
    console.error('Failed to load report:', error)
    router.push('/projects')
  } finally {
    isLoading.value = false
  }
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getSeverityClass = (s) => `badge-${s?.toLowerCase() || 'info'}`

const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 }
const sortedVulnerabilities = computed(() => {
  if (!report.value?.vulnerabilities) return []
  return [...report.value.vulnerabilities].sort((a, b) => 
    (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5)
  )
})

const vulnStats = computed(() => {
  const vulns = report.value?.vulnerabilities || []
  return {
    total: vulns.length,
    critical: vulns.filter(v => v.severity === 'Critical').length,
    high: vulns.filter(v => v.severity === 'High').length,
    medium: vulns.filter(v => v.severity === 'Medium').length,
    low: vulns.filter(v => v.severity === 'Low').length,
    info: vulns.filter(v => v.severity === 'Info').length
  }
})

const downloadPDF = async () => {
  try {
    const response = await fetch(`/api/reports/${reportId}/pdf`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.value?.title || 'report'}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('PDF download failed:', error)
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <div v-if="isLoading" class="flex items-center justify-center" style="height: 50vh;">
        <span class="spinner"></span>
      </div>

      <div v-else class="report-view">
        <!-- Header -->
        <header class="report-header">
          <div class="header-top">
            <button class="btn btn-sm btn-secondary" @click="router.back()">
              ← Back
            </button>
            <div class="header-actions">
              <router-link :to="`/report/${reportId}/edit`" class="btn btn-secondary">
                ✏️ Edit
              </router-link>
              <button class="btn btn-primary" @click="downloadPDF">
                📥 Download PDF
              </button>
            </div>
          </div>
          
          <div class="report-title-section">
            <h1>{{ report.title }}</h1>
            <div class="report-meta">
              <span>{{ report.systemName }}</span>
              <span>•</span>
              <span>{{ formatDate(report.startDate) }} - {{ formatDate(report.endDate) }}</span>
              <span class="badge" :class="report.status === 'completed' ? 'badge-low' : 'badge-info'">
                {{ report.status }}
              </span>
            </div>
          </div>
        </header>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card critical">
            <div class="stat-value">{{ vulnStats.critical }}</div>
            <div class="stat-label">Critical</div>
          </div>
          <div class="stat-card high">
            <div class="stat-value">{{ vulnStats.high }}</div>
            <div class="stat-label">High</div>
          </div>
          <div class="stat-card medium">
            <div class="stat-value">{{ vulnStats.medium }}</div>
            <div class="stat-label">Medium</div>
          </div>
          <div class="stat-card low">
            <div class="stat-value">{{ vulnStats.low }}</div>
            <div class="stat-label">Low</div>
          </div>
          <div class="stat-card info">
            <div class="stat-value">{{ vulnStats.info }}</div>
            <div class="stat-label">Info</div>
          </div>
        </div>

        <!-- Content Sections -->
        <section v-if="report.executiveSummary" class="content-section">
          <h2>Executive Summary</h2>
          <div class="section-content" v-html="report.executiveSummary?.replace(/\n/g, '<br>')"></div>
        </section>

        <section v-if="report.scope" class="content-section">
          <h2>Scope</h2>
          <div class="section-content" v-html="report.scope?.replace(/\n/g, '<br>')"></div>
        </section>

        <section v-if="report.methodology" class="content-section">
          <h2>Methodology</h2>
          <div class="section-content" v-html="report.methodology?.replace(/\n/g, '<br>')"></div>
        </section>

        <!-- Frameworks -->
        <section v-if="report.frameworkIds?.length" class="content-section">
          <h2>Frameworks</h2>
          <div class="frameworks-list">
            <span 
              v-for="fwId in report.frameworkIds" 
              :key="fwId"
              class="framework-badge"
            >
              {{ frameworkMap[fwId]?.name || 'Unknown' }} {{ frameworkMap[fwId]?.version || '' }}
            </span>
          </div>
        </section>

        <!-- Tags -->
        <section v-if="report.tags?.length" class="content-section">
          <h2>Tags</h2>
          <div class="tags-list">
            <span v-for="tag in report.tags" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>
        </section>

        <!-- Vulnerabilities -->
        <section class="content-section vulnerabilities-section">
          <h2>Vulnerabilities ({{ vulnStats.total }})</h2>
          
          <div v-if="sortedVulnerabilities.length === 0" class="empty-state">
            <p>No vulnerabilities found in this report.</p>
          </div>

          <div v-else class="vuln-list">
            <div 
              v-for="(vuln, idx) in sortedVulnerabilities" 
              :key="idx"
              class="vuln-card"
            >
              <div class="vuln-header">
                <div class="vuln-title">
                  <span class="vuln-number">#{{ idx + 1 }}</span>
                  <h3>{{ vuln.title }}</h3>
                </div>
                <div class="vuln-badges">
                  <span :class="['badge', getSeverityClass(vuln.severity)]">
                    {{ vuln.severity }}
                  </span>
                  <span v-if="vuln.cvssScore" class="cvss-score">
                    CVSS: {{ vuln.cvssScore }}
                  </span>
                </div>
              </div>

              <div v-if="vuln.description" class="vuln-section">
                <h4>Description</h4>
                <p v-html="vuln.description?.replace(/\n/g, '<br>')"></p>
              </div>

              <div v-if="vuln.impact" class="vuln-section">
                <h4>Impact</h4>
                <p v-html="vuln.impact?.replace(/\n/g, '<br>')"></p>
              </div>

              <div v-if="vuln.recommendation" class="vuln-section">
                <h4>Recommendation</h4>
                <p v-html="vuln.recommendation?.replace(/\n/g, '<br>')"></p>
              </div>

              <div v-if="vuln.evidence" class="vuln-section">
                <h4>Evidence</h4>
                <pre class="evidence-block">{{ vuln.evidence }}</pre>
              </div>

              <div v-if="vuln.affectedAssets" class="vuln-section">
                <h4>Affected Assets</h4>
                <p>{{ vuln.affectedAssets }}</p>
              </div>

              <div v-if="vuln.references" class="vuln-section">
                <h4>References</h4>
                <p>{{ vuln.references }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
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

.report-view {
  max-width: 1200px;
  margin: 0 auto;
}

.report-header {
  margin-bottom: var(--spacing-xl);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.report-title-section h1 {
  margin-bottom: var(--spacing-xs);
}

.report-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-muted);
  font-size: 0.9rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.stat-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
}

.stat-card.critical { border-color: rgba(220, 38, 38, 0.3); }
.stat-card.high { border-color: rgba(234, 88, 12, 0.3); }
.stat-card.medium { border-color: rgba(234, 179, 8, 0.3); }
.stat-card.low { border-color: rgba(34, 197, 94, 0.3); }
.stat-card.info { border-color: rgba(14, 165, 233, 0.3); }

.stat-value {
  font-size: 2rem;
  font-weight: 700;
}

.stat-card.critical .stat-value { color: #dc2626; }
.stat-card.high .stat-value { color: #ea580c; }
.stat-card.medium .stat-value { color: #eab308; }
.stat-card.low .stat-value { color: #22c55e; }
.stat-card.info .stat-value { color: #0ea5e9; }

.stat-label {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.content-section {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.content-section h2 {
  font-size: 1.25rem;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--glass-border);
}

.section-content {
  line-height: 1.7;
  color: var(--text-muted);
}

.frameworks-list,
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.framework-badge {
  padding: 0.5rem 1rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-sm);
  color: var(--primary-color);
  font-size: 0.9rem;
}

.vuln-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.vuln-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
}

.vuln-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.vuln-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.vuln-number {
  color: var(--text-muted);
  font-weight: 600;
}

.vuln-title h3 {
  margin: 0;
  font-size: 1.1rem;
}

.vuln-badges {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.cvss-score {
  font-weight: 600;
  color: var(--text-muted);
}

.vuln-section {
  margin-bottom: var(--spacing-md);
}

.vuln-section:last-child {
  margin-bottom: 0;
}

.vuln-section h4 {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-xs);
}

.vuln-section p {
  margin: 0;
  line-height: 1.6;
}

.evidence-block {
  background: rgba(0, 0, 0, 0.3);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .vuln-header {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
</style>
