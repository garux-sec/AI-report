<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { reportsApi } from '../api/reports'
import { frameworksApi } from '../api/frameworks'
import { aiApi } from '../api/ai'
import Sidebar from '../components/layout/Sidebar.vue'
import BentoGrid from '../components/layout/BentoGrid.vue'
import BentoCard from '../components/layout/BentoCard.vue'

const route = useRoute()
const router = useRouter()
const reportId = route.params.id

// State
const report = ref(null)
const vulnerabilities = ref([])
const frameworks = ref([])
const selectedFrameworks = ref([])
const selectedTags = ref([])
const suggestedTags = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const showVulnModal = ref(false)
const editingVulnIndex = ref(-1)

// Form data
const formData = ref({
  title: '',
  systemName: '',
  startDate: '',
  endDate: '',
  scope: '',
  methodology: '',
  executiveSummary: '',
  status: 'draft'
})

// Vulnerability form
const vulnForm = reactive({
  title: '',
  severity: 'Medium',
  cvssScore: 0,
  cvssVector: '',
  cvssVersion: '3.1',
  description: '',
  impact: '',
  recommendation: '',
  evidence: '',
  affectedAssets: '',
  references: ''
})

// CVSS Metrics
const CVSS_METRICS = {
  '3.1': [
    { id: 'AV', name: 'Attack Vector', options: [
      { val: 'N', label: 'Network' }, { val: 'A', label: 'Adjacent' },
      { val: 'L', label: 'Local' }, { val: 'P', label: 'Physical' }
    ]},
    { id: 'AC', name: 'Attack Complexity', options: [
      { val: 'L', label: 'Low' }, { val: 'H', label: 'High' }
    ]},
    { id: 'PR', name: 'Privileges Required', options: [
      { val: 'N', label: 'None' }, { val: 'L', label: 'Low' }, { val: 'H', label: 'High' }
    ]},
    { id: 'UI', name: 'User Interaction', options: [
      { val: 'N', label: 'None' }, { val: 'R', label: 'Required' }
    ]},
    { id: 'S', name: 'Scope', options: [
      { val: 'U', label: 'Unchanged' }, { val: 'C', label: 'Changed' }
    ]},
    { id: 'C', name: 'Confidentiality', options: [
      { val: 'N', label: 'None' }, { val: 'L', label: 'Low' }, { val: 'H', label: 'High' }
    ]},
    { id: 'I', name: 'Integrity', options: [
      { val: 'N', label: 'None' }, { val: 'L', label: 'Low' }, { val: 'H', label: 'High' }
    ]},
    { id: 'A', name: 'Availability', options: [
      { val: 'N', label: 'None' }, { val: 'L', label: 'Low' }, { val: 'H', label: 'High' }
    ]}
  ]
}

const cvssState = ref({})

// Load data
const loadReport = async () => {
  try {
    const data = await reportsApi.getById(reportId)
    report.value = data
    formData.value = {
      title: data.title || '',
      systemName: data.systemName || '',
      startDate: data.startDate?.split('T')[0] || '',
      endDate: data.endDate?.split('T')[0] || '',
      scope: data.scope || '',
      methodology: data.methodology || '',
      executiveSummary: data.executiveSummary || '',
      status: data.status || 'draft'
    }
    vulnerabilities.value = data.vulnerabilities || []
    selectedFrameworks.value = data.frameworkIds || []
    selectedTags.value = data.tags || []
  } catch (error) {
    console.error('Failed to load report:', error)
    router.push('/projects')
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

const loadSuggestedTags = async () => {
  try {
    suggestedTags.value = await reportsApi.getAllTags()
  } catch (error) {
    console.error('Failed to load tags:', error)
  }
}

// CVSS Calculation
const calculateCVSS = () => {
  const state = cvssState.value
  // Simplified CVSS 3.1 calculation
  const weights = {
    AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
    AC: { L: 0.77, H: 0.44 },
    PR: { N: 0.85, L: 0.62, H: 0.27 },
    UI: { N: 0.85, R: 0.62 },
    S: { U: 0, C: 1 },
    C: { N: 0, L: 0.22, H: 0.56 },
    I: { N: 0, L: 0.22, H: 0.56 },
    A: { N: 0, L: 0.22, H: 0.56 }
  }

  if (!state.AV || !state.AC || !state.PR || !state.UI || !state.S || !state.C || !state.I || !state.A) {
    return
  }

  const scopeChanged = state.S === 'C'
  const pr = scopeChanged && state.PR === 'L' ? 0.68 : (scopeChanged && state.PR === 'H' ? 0.5 : weights.PR[state.PR])
  
  const exploitability = 8.22 * weights.AV[state.AV] * weights.AC[state.AC] * pr * weights.UI[state.UI]
  const iscBase = 1 - ((1 - weights.C[state.C]) * (1 - weights.I[state.I]) * (1 - weights.A[state.A]))
  const impact = scopeChanged ? 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15) : 6.42 * iscBase
  
  let score = 0
  if (impact <= 0) {
    score = 0
  } else if (scopeChanged) {
    score = Math.min(1.08 * (impact + exploitability), 10)
  } else {
    score = Math.min(impact + exploitability, 10)
  }
  
  score = Math.ceil(score * 10) / 10
  vulnForm.cvssScore = score
  vulnForm.cvssVector = `CVSS:3.1/AV:${state.AV}/AC:${state.AC}/PR:${state.PR}/UI:${state.UI}/S:${state.S}/C:${state.C}/I:${state.I}/A:${state.A}`
  
  // Auto-set severity
  if (score >= 9.0) vulnForm.severity = 'Critical'
  else if (score >= 7.0) vulnForm.severity = 'High'
  else if (score >= 4.0) vulnForm.severity = 'Medium'
  else if (score >= 0.1) vulnForm.severity = 'Low'
  else vulnForm.severity = 'Info'
}

const selectCvss = (metricId, value) => {
  cvssState.value[metricId] = value
  calculateCVSS()
}

// Vulnerability management
const openVulnModal = (index = -1) => {
  editingVulnIndex.value = index
  if (index >= 0) {
    const v = vulnerabilities.value[index]
    Object.assign(vulnForm, {
      title: v.title || '',
      severity: v.severity || 'Medium',
      cvssScore: v.cvssScore || 0,
      cvssVector: v.cvssVector || '',
      cvssVersion: v.cvssVersion || '3.1',
      description: v.description || '',
      impact: v.impact || '',
      recommendation: v.recommendation || '',
      evidence: v.evidence || '',
      affectedAssets: v.affectedAssets || '',
      references: v.references || ''
    })
    // Parse CVSS vector to state
    if (v.cvssVector) {
      const parts = v.cvssVector.split('/')
      parts.forEach(p => {
        const [key, val] = p.split(':')
        if (key && val) cvssState.value[key] = val
      })
    }
  } else {
    Object.assign(vulnForm, {
      title: '', severity: 'Medium', cvssScore: 0, cvssVector: '',
      cvssVersion: '3.1', description: '', impact: '', recommendation: '',
      evidence: '', affectedAssets: '', references: ''
    })
    cvssState.value = {}
  }
  showVulnModal.value = true
}

const closeVulnModal = () => {
  showVulnModal.value = false
  editingVulnIndex.value = -1
}

const saveVulnerability = () => {
  const vuln = { ...vulnForm }
  if (editingVulnIndex.value >= 0) {
    vulnerabilities.value[editingVulnIndex.value] = vuln
  } else {
    vulnerabilities.value.push(vuln)
  }
  closeVulnModal()
}

const removeVulnerability = (index) => {
  if (confirm('Remove this vulnerability?')) {
    vulnerabilities.value.splice(index, 1)
  }
}

// Framework toggle
const toggleFramework = (id) => {
  const idx = selectedFrameworks.value.indexOf(id)
  if (idx === -1) {
    selectedFrameworks.value.push(id)
  } else {
    selectedFrameworks.value.splice(idx, 1)
  }
}

// Tag management
const tagInput = ref('')
const addTag = (tag) => {
  const t = tag || tagInput.value.trim()
  if (t && !selectedTags.value.includes(t)) {
    selectedTags.value.push(t)
  }
  tagInput.value = ''
}
const removeTag = (tag) => {
  const idx = selectedTags.value.indexOf(tag)
  if (idx >= 0) selectedTags.value.splice(idx, 1)
}

// Save report
const saveReport = async () => {
  isSaving.value = true
  try {
    const data = {
      ...formData.value,
      vulnerabilities: vulnerabilities.value,
      frameworkIds: selectedFrameworks.value,
      tags: selectedTags.value
    }
    await reportsApi.update(reportId, data)
    alert('Report saved successfully!')
  } catch (error) {
    console.error('Failed to save report:', error)
    alert('Error saving report')
  } finally {
    isSaving.value = false
  }
}

// AI Generation
const isGeneratingAI = ref(false)
const aiProgress = ref(0)

const generateWithAI = async () => {
  isGeneratingAI.value = true
  aiProgress.value = 10
  try {
    aiProgress.value = 30
    // Save first
    await saveReport()
    aiProgress.value = 50
    
    // Generate AI content
    const result = await aiApi.generateText({
      reportId,
      type: 'full'
    })
    
    aiProgress.value = 80
    
    // Reload report with AI-generated content
    await loadReport()
    aiProgress.value = 100
    
    setTimeout(() => {
      isGeneratingAI.value = false
    }, 500)
  } catch (error) {
    console.error('AI generation failed:', error)
    alert('AI generation failed: ' + (error.response?.data?.message || error.message))
    isGeneratingAI.value = false
  }
}

// Download PDF
const downloadPDF = async () => {
  try {
    await saveReport()
    const response = await fetch(`/api/reports/${reportId}/pdf`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.value.title || 'report'}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('PDF download failed:', error)
  }
}

const getSeverityClass = (s) => `badge-${s?.toLowerCase() || 'info'}`

onMounted(() => {
  loadReport()
  loadFrameworks()
  loadSuggestedTags()
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <header class="page-header">
        <div>
          <button class="btn btn-sm btn-secondary" @click="router.back()">
            ← Back
          </button>
          <h1>{{ formData.title || 'Edit Report' }}</h1>
        </div>
        <div class="header-actions">
          <button 
            class="btn btn-secondary" 
            @click="generateWithAI"
            :disabled="isGeneratingAI"
          >
            <span v-if="isGeneratingAI">AI Generating... {{ aiProgress }}%</span>
            <span v-else>🤖 Generate with AI</span>
          </button>
          <button 
            class="btn btn-primary" 
            @click="saveReport"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save Report' }}
          </button>
          <button class="btn btn-secondary" @click="downloadPDF">
            📥 Download PDF
          </button>
        </div>
      </header>

      <BentoGrid v-if="!isLoading">
        <!-- Basic Info -->
        <BentoCard title="Report Details" :span="2">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input v-model="formData.title" type="text" class="input" />
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
            <label class="form-label">Status</label>
            <select v-model="formData.status" class="select">
              <option value="draft">Draft</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </BentoCard>

        <!-- Frameworks -->
        <BentoCard title="Frameworks" :span="2">
          <div class="framework-grid">
            <label 
              v-for="fw in frameworks" 
              :key="fw._id"
              class="framework-option"
              :class="{ selected: selectedFrameworks.includes(fw._id) }"
            >
              <input 
                type="checkbox"
                :checked="selectedFrameworks.includes(fw._id)"
                @change="toggleFramework(fw._id)"
                style="display: none;"
              />
              <span>{{ fw.name }} {{ fw.version }}</span>
            </label>
          </div>
        </BentoCard>

        <!-- Tags -->
        <BentoCard title="Tags" :span="2">
          <div class="tags-container">
            <span 
              v-for="tag in selectedTags" 
              :key="tag" 
              class="tag"
            >
              {{ tag }}
              <button class="tag-remove" @click="removeTag(tag)">&times;</button>
            </span>
          </div>
          <div class="tag-input-row">
            <input 
              v-model="tagInput"
              type="text"
              class="input"
              placeholder="Add tag..."
              @keyup.enter="addTag()"
            />
            <button class="btn btn-sm btn-secondary" @click="addTag()">Add</button>
          </div>
          <div v-if="suggestedTags.length" class="suggested-tags">
            <span class="form-label">Suggested:</span>
            <button 
              v-for="tag in suggestedTags.slice(0, 10)" 
              :key="tag"
              class="tag suggested"
              @click="addTag(tag)"
            >
              + {{ tag }}
            </button>
          </div>
        </BentoCard>

        <!-- Content -->
        <BentoCard title="Scope" :span="2">
          <textarea 
            v-model="formData.scope" 
            class="textarea" 
            rows="4"
            placeholder="Define the scope of the assessment..."
          ></textarea>
        </BentoCard>

        <BentoCard title="Methodology" :span="2">
          <textarea 
            v-model="formData.methodology" 
            class="textarea" 
            rows="4"
            placeholder="Describe the methodology used..."
          ></textarea>
        </BentoCard>

        <BentoCard title="Executive Summary" :span="4">
          <textarea 
            v-model="formData.executiveSummary" 
            class="textarea" 
            rows="6"
            placeholder="Provide an executive summary..."
          ></textarea>
        </BentoCard>

        <!-- Vulnerabilities -->
        <BentoCard :span="4">
          <template #header-actions>
            <button class="btn btn-sm btn-primary" @click="openVulnModal()">
              + Add Vulnerability
            </button>
          </template>
          
          <div class="vuln-header">
            <h3 class="bento-card-title">Vulnerabilities ({{ vulnerabilities.length }})</h3>
          </div>

          <div v-if="vulnerabilities.length === 0" class="empty-state">
            <p>No vulnerabilities added yet.</p>
          </div>

          <div v-else class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>CVSS</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(vuln, idx) in vulnerabilities" :key="idx">
                  <td>{{ vuln.title }}</td>
                  <td>
                    <span :class="['badge', getSeverityClass(vuln.severity)]">
                      {{ vuln.severity }}
                    </span>
                  </td>
                  <td>{{ vuln.cvssScore || '-' }}</td>
                  <td>
                    <div class="flex gap-sm">
                      <button class="btn btn-sm btn-secondary" @click="openVulnModal(idx)">
                        Edit
                      </button>
                      <button class="btn btn-sm btn-danger" @click="removeVulnerability(idx)">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BentoCard>
      </BentoGrid>

      <!-- Loading state -->
      <div v-else class="flex items-center justify-center" style="height: 50vh;">
        <span class="spinner"></span>
      </div>
    </main>

    <!-- Vulnerability Modal -->
    <div v-if="showVulnModal" class="modal-backdrop" @click.self="closeVulnModal">
      <div class="modal vuln-modal">
        <div class="modal-header">
          <h2 class="modal-title">
            {{ editingVulnIndex >= 0 ? 'Edit Vulnerability' : 'Add Vulnerability' }}
          </h2>
          <button class="modal-close" @click="closeVulnModal">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input v-model="vulnForm.title" type="text" class="input" required />
          </div>

          <!-- CVSS Calculator -->
          <div class="cvss-section">
            <h4>CVSS 3.1 Calculator</h4>
            <div class="cvss-metrics">
              <div v-for="metric in CVSS_METRICS['3.1']" :key="metric.id" class="cvss-metric">
                <label class="form-label">{{ metric.name }}</label>
                <div class="cvss-options">
                  <button 
                    v-for="opt in metric.options" 
                    :key="opt.val"
                    class="cvss-opt"
                    :class="{ active: cvssState[metric.id] === opt.val }"
                    @click="selectCvss(metric.id, opt.val)"
                    type="button"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="cvss-result">
              <span>Score: <strong>{{ vulnForm.cvssScore }}</strong></span>
              <span :class="['badge', getSeverityClass(vulnForm.severity)]">
                {{ vulnForm.severity }}
              </span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Severity</label>
              <select v-model="vulnForm.severity" class="select">
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
                <option>Info</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">CVSS Score</label>
              <input v-model.number="vulnForm.cvssScore" type="number" step="0.1" min="0" max="10" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="vulnForm.description" class="textarea" rows="3"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Impact</label>
            <textarea v-model="vulnForm.impact" class="textarea" rows="2"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Recommendation</label>
            <textarea v-model="vulnForm.recommendation" class="textarea" rows="2"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Evidence</label>
            <textarea v-model="vulnForm.evidence" class="textarea" rows="2"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Affected Assets</label>
            <input v-model="vulnForm.affectedAssets" type="text" class="input" />
          </div>

          <div class="form-group">
            <label class="form-label">References</label>
            <input v-model="vulnForm.references" type="text" class="input" />
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeVulnModal">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="saveVulnerability">
              {{ editingVulnIndex >= 0 ? 'Update' : 'Add' }}
            </button>
          </div>
        </div>
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
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.page-header h1 {
  margin: var(--spacing-sm) 0 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
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
  font-size: 0.9rem;
}

.framework-option:hover {
  border-color: var(--primary-color);
}

.framework-option.selected {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.tag-input-row {
  display: flex;
  gap: var(--spacing-sm);
}

.tag-input-row .input {
  flex: 1;
  margin-bottom: 0;
}

.suggested-tags {
  margin-top: var(--spacing-md);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  align-items: center;
}

.tag.suggested {
  cursor: pointer;
  opacity: 0.7;
}

.tag.suggested:hover {
  opacity: 1;
}

.vuln-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.vuln-modal {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.cvss-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.cvss-section h4 {
  margin: 0 0 var(--spacing-md);
  color: var(--text-muted);
}

.cvss-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.cvss-metric {
  margin-bottom: var(--spacing-sm);
}

.cvss-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cvss-opt {
  padding: 4px 8px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cvss-opt:hover {
  border-color: var(--primary-color);
}

.cvss-opt.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.cvss-result {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--glass-border);
}

.cvss-result strong {
  font-size: 1.25rem;
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
