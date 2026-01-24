<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { reportsApi } from '../api/reports'
import { frameworksApi } from '../api/frameworks'
import { aiApi } from '../api/ai'
import Sidebar from '../components/layout/Sidebar.vue'

const route = useRoute()
const router = useRouter()
const reportId = route.params.id

// State
const isLoading = ref(true)
const isSaving = ref(false)
const isGeneratingAI = ref(false)
const isGettingAI = ref(false)
const aiProgress = ref(0)
const aiLanguage = ref('en') // 'en' or 'th'

// Form Data
const formData = reactive({
  systemName: '',
  url: '',
  format: 'Blackbox',
  environment: 'Production',
  startDate: '',
  endDate: '',
  info: {
    ip: '',
    domain: '',
    port: '',
    os: '',
    server: ''
  }
})

// Frameworks & Tags
const allFrameworks = ref([])
const selectedFrameworkIds = ref([])
const allAvailableTags = ref([])
const selectedTags = ref([])
const tagInput = ref('')
const showTagSuggestions = ref(false)

// Vulnerabilities
const vulnerabilities = ref([])
const showVulnModal = ref(false)
const showLightbox = ref(false)
const editingIndex = ref(-1)

const vulnForm = reactive({
  title: '',
  severity: 'medium',
  status: 'Open',
  owasp: '',
  affected: '',
  detail: '',
  fix: '',
  cvssVersion: '3.1',
  cvssVector: '',
  cvssScore: 0,
  file: null,
  files: []
})

// CVSS
const cvssVersion = ref('3.1')
const cvssState = ref({})

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
  ],
  '4.0': [
    { id: 'AV', name: 'Attack Vector', options: [{ val: 'N', label: 'Network' }, { val: 'A', label: 'Adjacent' }, { val: 'L', label: 'Local' }, { val: 'P', label: 'Physical' }] },
    { id: 'AC', name: 'Attack Complexity', options: [{ val: 'L', label: 'Low' }, { val: 'H', label: 'High' }] },
    { id: 'AT', name: 'Attack Requirements', options: [{ val: 'N', label: 'None' }, { val: 'P', label: 'Present' }] },
    { id: 'PR', name: 'Privileges Required', options: [{ val: 'N', label: 'None' }, { val: 'L', label: 'Low' }, { val: 'H', label: 'High' }] },
    { id: 'UI', name: 'User Interaction', options: [{ val: 'N', label: 'None' }, { val: 'P', label: 'Passive' }, { val: 'A', label: 'Active' }] },
    { id: 'VC', name: 'Vuln Confidentiality', options: [{ val: 'H', label: 'High' }, { val: 'L', label: 'Low' }, { val: 'N', label: 'None' }] },
    { id: 'VI', name: 'Vuln Integrity', options: [{ val: 'H', label: 'High' }, { val: 'L', label: 'Low' }, { val: 'N', label: 'None' }] },
    { id: 'VA', name: 'Vuln Availability', options: [{ val: 'H', label: 'High' }, { val: 'L', label: 'Low' }, { val: 'N', label: 'None' }] },
    { id: 'SC', name: 'Sub Confidentiality', options: [{ val: 'H', label: 'High' }, { val: 'L', label: 'Low' }, { val: 'N', label: 'None' }] },
    { id: 'SI', name: 'Sub Integrity', options: [{ val: 'H', label: 'High' }, { val: 'L', label: 'Low' }, { val: 'N', label: 'None' }] },
    { id: 'SA', name: 'Sub Availability', options: [{ val: 'H', label: 'High' }, { val: 'L', label: 'Low' }, { val: 'N', label: 'None' }] }
  ]
}

// Load Report
async function loadReport() {
  if (!reportId) {
    isLoading.value = false
    return
  }
  try {
    const data = await reportsApi.getById(reportId)
    formData.systemName = data.systemName || ''
    formData.url = data.url || ''
    formData.format = data.format || 'Blackbox'
    formData.environment = data.environment || 'Production'
    formData.startDate = data.startDate?.split('T')[0] || ''
    formData.endDate = data.endDate?.split('T')[0] || ''
    if (data.info) {
      formData.info = { ...formData.info, ...data.info }
    }
    selectedFrameworkIds.value = (data.frameworks || []).map(f => typeof f === 'string' ? f : f._id)
    selectedTags.value = data.tags || []
    vulnerabilities.value = (data.vulnerabilities || []).map(v => {
      // Migration logic: Ensure 'files' array exists
      const files = v.files && v.files.length > 0 ? v.files : (v.file ? [v.file] : [])
      return {
        ...v,
        files: files,
        file: files.length > 0 ? files[0] : (v.file || null)
      }
    })
  } catch (e) {
    console.error('Failed to load report:', e)
  } finally {
    isLoading.value = false
  }
}

async function loadFrameworks() {
  try {
    allFrameworks.value = await frameworksApi.getAll()
  } catch (e) {
    console.error('Failed to load frameworks:', e)
  }
}

async function loadSuggestedTags() {
  try {
    allAvailableTags.value = await reportsApi.getAllTags()
  } catch (e) {
    console.error('Failed to load tags:', e)
  }
}

// Framework toggle
function toggleFramework(id) {
  const idx = selectedFrameworkIds.value.indexOf(id)
  if (idx === -1) {
    selectedFrameworkIds.value.push(id)
  } else {
    selectedFrameworkIds.value.splice(idx, 1)
  }
}

// Tag management
function addTag(tag) {
  const t = tag || tagInput.value.trim()
  if (t && !selectedTags.value.includes(t)) {
    selectedTags.value.push(t)
  }
  tagInput.value = ''
  showTagSuggestions.value = false
}

function removeTag(tag) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx >= 0) selectedTags.value.splice(idx, 1)
}

function handleTagInput() {
  showTagSuggestions.value = tagInput.value.length > 0
}

function filteredTags() {
  const val = tagInput.value.toLowerCase()
  return allAvailableTags.value.filter(t => 
    t.toLowerCase().includes(val) && !selectedTags.value.includes(t)
  ).slice(0, 10)
}

// CVSS Functions
function initCvssState(ver) {
  if (!cvssState.value[ver]) {
    cvssState.value[ver] = {}
    CVSS_METRICS[ver].forEach(g => cvssState.value[ver][g.id] = g.options[0].val)
  }
}

function switchCvssVersion(ver) {
  cvssVersion.value = ver
  vulnForm.cvssVersion = ver
  initCvssState(ver)
  calculateCVSS()
}

function selectCvss(metricId, value) {
  if (!cvssState.value[cvssVersion.value]) {
    initCvssState(cvssVersion.value)
  }
  cvssState.value[cvssVersion.value][metricId] = value
  calculateCVSS()
}

function calculateCVSS() {
  const ver = cvssVersion.value
  const state = cvssState.value[ver] || {}
  
  if (ver === '3.1') {
    const weights = {
      AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
      AC: { L: 0.77, H: 0.44 },
      PR: { N: 0.85, L: 0.62, H: 0.27 },
      UI: { N: 0.85, R: 0.62 },
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
    if (impact > 0) {
      score = scopeChanged ? Math.min(1.08 * (impact + exploitability), 10) : Math.min(impact + exploitability, 10)
    }
    score = Math.ceil(score * 10) / 10
    
    vulnForm.cvssScore = score
    vulnForm.cvssVector = `CVSS:3.1/AV:${state.AV}/AC:${state.AC}/PR:${state.PR}/UI:${state.UI}/S:${state.S}/C:${state.C}/I:${state.I}/A:${state.A}`
    
    if (score >= 9.0) vulnForm.severity = 'critical'
    else if (score >= 7.0) vulnForm.severity = 'high'
    else if (score >= 4.0) vulnForm.severity = 'medium'
    else if (score >= 0.1) vulnForm.severity = 'low'
    else vulnForm.severity = 'info'
  }
}

// Vulnerability Modal
function openVulnModal(index = -1) {
  editingIndex.value = index
  
  if (index >= 0) {
    const v = vulnerabilities.value[index]
    Object.assign(vulnForm, {
      title: v.title || '',
      severity: v.severity || 'medium',
      status: v.status || 'Open',
      owasp: v.owasp || '',
      affected: v.affected || '',
      detail: v.detail || v.description || '',
      fix: v.fix || '',
      cvssVersion: v.cvssVersion || '3.1',
      cvssVector: v.cvssVector || '',
      cvssScore: v.cvssScore || 0,
      file: v.file || null,
      files: v.files && v.files.length > 0 ? [...v.files] : (v.file ? [v.file] : [])
    })

    // Legacy support: if files empty but file exists, use file
    if (vulnForm.files.length === 0 && vulnForm.file) {
      vulnForm.files.push(vulnForm.file)
    }

    cvssVersion.value = v.cvssVersion || '3.1'
    
    if (v.cvssVector) {
      const parts = v.cvssVector.split('/')
      if (!cvssState.value[cvssVersion.value]) cvssState.value[cvssVersion.value] = {}
      parts.forEach(p => {
        const [key, val] = p.split(':')
        if (key && val) cvssState.value[cvssVersion.value][key] = val
      })
    }
  } else {
    Object.assign(vulnForm, {
      title: '', severity: 'medium', status: 'Open', owasp: '', affected: '',
      detail: '', fix: '', cvssVersion: '3.1', cvssVector: '', cvssScore: 0, 
      file: null, files: []
    })
    cvssVersion.value = '3.1'
    cvssState.value = {}
    initCvssState('3.1')
  }
  
  showVulnModal.value = true
  calculateCVSS()
}

function closeVulnModal() {
  showVulnModal.value = false
  editingIndex.value = -1
}

function saveVulnerability() {
  if (!vulnForm.title) {
    alert('Title is required')
    return
  }
  
  // Sync legacy file
  const mainFile = vulnForm.files.length > 0 ? vulnForm.files[0] : null
  
  const vuln = { 
    ...vulnForm, 
    description: vulnForm.detail,
    file: mainFile
  }
  
  if (editingIndex.value >= 0) {
    vulnerabilities.value[editingIndex.value] = vuln
  } else {
    vulnerabilities.value.push(vuln)
  }
  closeVulnModal()
}

function removeVuln(index) {
  if (confirm('Delete this vulnerability?')) {
    vulnerabilities.value.splice(index, 1)
  }
}

// Image Handlers
function handleFileUpload(event) {
  const fileList = event.target.files
  if (!fileList.length) return

  Array.from(fileList).forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      // Add new file to array
      vulnForm.files.push(e.target.result)
      // Update legacy file property if this is the first one
      if (!vulnForm.file) vulnForm.file = e.target.result
    }
    reader.readAsDataURL(file)
  })
  
  // Reset input so same files can be selected again if needed
  event.target.value = ''
}

function removeFile(index) {
  vulnForm.files.splice(index, 1)
  // Update legacy file pointer
  vulnForm.file = vulnForm.files.length > 0 ? vulnForm.files[0] : null
}

// Lightbox
const currentLightboxImage = ref('')

function openLightbox(imgSrc) {
  currentLightboxImage.value = imgSrc
  showLightbox.value = true
}

// Save Report
async function saveReport() {
  isSaving.value = true
  try {
    const payload = {
      systemName: formData.systemName,
      url: formData.url,
      format: formData.format,
      environment: formData.environment,
      startDate: formData.startDate,
      endDate: formData.endDate,
      info: formData.info,
      frameworks: selectedFrameworkIds.value,
      tags: selectedTags.value,
      vulnerabilities: vulnerabilities.value
    }
    
    if (reportId) {
      await reportsApi.update(reportId, payload)
    } else {
      const result = await reportsApi.create(payload)
      if (result.reportId) {
        router.push(`/reports/edit/${result.reportId}`)
      }
    }
    alert('Report Saved Successfully!')
  } catch (e) {
    console.error('Failed to save report:', e)
    alert('Error saving report: ' + e.message)
  } finally {
    isSaving.value = false
  }
}

// AI Configuration
const defaultAIConfig = ref(null)

async function loadDefaultAI() {
  try {
    const result = await aiApi.getConfigs()
    const configs = result.data || result
    defaultAIConfig.value = configs.find(c => c.isDefault) || configs[0] || null
  } catch (e) {
    console.error('Failed to load AI config:', e)
  }
}

// AI Generate
async function saveWithAI() {
  if (vulnerabilities.value.length === 0) {
    alert('No vulnerabilities to enhance.')
    return
  }
  
  if (!defaultAIConfig.value) {
    await loadDefaultAI()
    if (!defaultAIConfig.value) {
      alert('No AI configuration found. Please configure AI settings first.')
      return
    }
  }

  if (!confirm(`This will use ${defaultAIConfig.value.name || 'AI'} to enhance Details and Recommendations. Continue?`)) {
    return
  }
  
  isGeneratingAI.value = true
  aiProgress.value = 0
  
  try {
    const total = vulnerabilities.value.length
    let current = 0
    
    // Process vulnerabilities sequentially to avoid rate limits
    for (let i = 0; i < vulnerabilities.value.length; i++) {
        const v = vulnerabilities.value[i]

        let sysInstruction = "You are a Senior Penetration Tester."
        let langInstruction = ""
        
        if (aiLanguage.value === 'th') {
            langInstruction = `
IMPORTANT: Please output the 'detail' and 'fix' content strictly in ALL **Thai Language** (ภาษาไทย).
Use professional technical Thai terminology where appropriate.`
        } else {
            langInstruction = "Please output the content in English."
        }

        const prompt = `${sysInstruction} I will provide you with a vulnerability finding.
Your task is to write a professional 'Details / Impact' section and a 'Recommendation (Fix)' section.

${langInstruction}

Vulnerability Info:
Title: ${v.title}
OWASP Category: ${v.owasp || 'N/A'}
Affected Component: ${v.affected || 'N/A'}
Current Details: ${v.detail || v.description || 'N/A'}

Requirements:
1. Details / Impact: Explain the vulnerability technically, how it can be exploited, and the business impact.
2. Recommendation: Provide clear, actionable steps to fix the issue. Use a bulleted list format (e.g. - Step 1\n- Step 2) if there are multiple steps. Ensure each item is separated by a newline character.

Output strictly in JSON format with keys "detail" and "fix". Example:
{
  "detail": "...",
  "fix": "..."
}`

      try {
        const response = await aiApi.generateText({
          provider: defaultAIConfig.value.provider,
          model: defaultAIConfig.value.modelName,
          prompt: prompt
        })
        
        const resultText = response.data?.result || response.result || ''
        
        // Parse JSON
        let enhanced = null
        try {
            // Try to find JSON in the response (in case of extra text)
            const jsonMatch = resultText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                enhanced = JSON.parse(jsonMatch[0])
            } else {
                enhanced = JSON.parse(resultText)
            }
        } catch (jsonErr) {
            console.warn('AI response not valid JSON:', resultText)
            // Fallback: use text as detail if not json
            enhanced = { detail: resultText, fix: '' }
        }

        if (enhanced) {
            if (enhanced.detail) v.detail = enhanced.detail
            if (enhanced.fix) v.fix = enhanced.fix
        }
        
      } catch (err) {
        console.error(`Failed to enhance vulnerability ${i+1}:`, err)
      }
      
      current++
      aiProgress.value = Math.round((current / total) * 100)
    }

    await saveReport()
    
    setTimeout(() => {
      isGeneratingAI.value = false
      alert('AI Enhancement Completed!')
    }, 500)
    
  } catch (e) {
    console.error('AI Enhancement Failed:', e)
    alert('AI Enhancement Failed: ' + e.message)
    isGeneratingAI.value = false
  }
}

function getSeverityClass(s) {
  const severity = (s || 'info').toLowerCase()
  const classes = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
    info: 'badge-info'
  }
  return classes[severity] || 'badge-info'
}

function getSeverityBarColor(s) {
  const severity = (s || 'info').toLowerCase()
  const colors = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
    info: 'bg-gray-500'
  }
  return colors[severity] || 'bg-gray-500'
}

onMounted(() => {
  loadReport()
  loadFrameworks()
  loadSuggestedTags()
  initCvssState('3.1')
})
</script>

<template>
  <div class="dashboard-layout">
    <Sidebar />
    
    <main class="main-content">
      <div class="card">
        <!-- Header -->
        <div class="page-header">
          <div>
            <h1><i class="icon-file"></i> Generate Report</h1>
            <p class="text-muted">Create a comprehensive penetration testing report.</p>
          </div>
          <span class="badge badge-info">Editor Mode</span>
        </div>

        <div v-if="!isLoading">
          <!-- Section: Target Information -->
          <section class="form-section">
            <h3 class="section-title"><i class="icon-target"></i> Target Information</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">System Name</label>
                <input v-model="formData.systemName" type="text" class="input" placeholder="e.g. ERP System" />
              </div>
              <div class="form-group">
                <label class="form-label">URL</label>
                <input v-model="formData.url" type="text" class="input" placeholder="https://example.com" />
              </div>
            </div>
          </section>

          <!-- Section: Scope & Context -->
          <section class="form-section">
            <h3 class="section-title"><i class="icon-layers"></i> Scope & Context</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Format</label>
                <select v-model="formData.format" class="select">
                  <option value="Blackbox">Black Box</option>
                  <option value="Greybox">Grey Box</option>
                  <option value="Whitebox">White Box</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Environment</label>
                <select v-model="formData.environment" class="select">
                  <option value="Production">Production</option>
                  <option value="UAT">UAT</option>
                  <option value="SIT">SIT</option>
                  <option value="DEV">Development</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input v-model="formData.startDate" type="date" class="input" />
              </div>
              <div class="form-group">
                <label class="form-label">End Date</label>
                <input v-model="formData.endDate" type="date" class="input" />
              </div>
            </div>
          </section>

          <!-- Section: Information Gathering -->
          <section class="form-section">
            <h3 class="section-title"><i class="icon-search"></i> Information Gathering</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Host IP Address</label>
                <input v-model="formData.info.ip" type="text" class="input" placeholder="e.g. 192.168.1.100" />
              </div>
              <div class="form-group">
                <label class="form-label">Domain Name</label>
                <input v-model="formData.info.domain" type="text" class="input" placeholder="e.g. example.com" />
              </div>
              <div class="form-group">
                <label class="form-label">Ports Open</label>
                <input v-model="formData.info.port" type="text" class="input" placeholder="e.g. 80, 443, 8080" />
              </div>
              <div class="form-group">
                <label class="form-label">Operating System</label>
                <input v-model="formData.info.os" type="text" class="input" placeholder="e.g. Ubuntu 20.04" />
              </div>
              <div class="form-group full-width">
                <label class="form-label">Services & Applications</label>
                <input v-model="formData.info.server" type="text" class="input" placeholder="e.g. Apache 2.4.41, MySQL 8.0" />
              </div>
            </div>
          </section>

          <!-- Section: Security Frameworks -->
          <section class="form-section">
            <h3 class="section-title"><i class="icon-shield"></i> Security Frameworks</h3>
            <div class="framework-grid">
              <label 
                v-for="fw in allFrameworks" 
                :key="fw._id"
                class="framework-option"
                :class="{ selected: selectedFrameworkIds.includes(fw._id) }"
              >
                <input 
                  type="checkbox"
                  :checked="selectedFrameworkIds.includes(fw._id)"
                  @change="toggleFramework(fw._id)"
                  class="sr-only"
                />
                <div class="checkbox-box">
                  <span v-if="selectedFrameworkIds.includes(fw._id)" class="checkmark">✓</span>
                </div>
                <div>
                  <span class="fw-name">{{ fw.name }}</span>
                  <span class="fw-year">{{ fw.year }}</span>
                </div>
              </label>
              <div v-if="allFrameworks.length === 0" class="empty-text">No frameworks available</div>
            </div>
          </section>

          <!-- Section: Tags -->
          <section class="form-section">
            <h3 class="section-title"><i class="icon-tag"></i> Tags</h3>
            <div class="tag-input-wrapper">
              <input 
                v-model="tagInput"
                type="text"
                class="input"
                placeholder="Type a tag and press Enter..."
                @input="handleTagInput"
                @keydown.enter.prevent="addTag()"
              />
              <div v-if="showTagSuggestions && filteredTags().length > 0" class="tag-suggestions">
                <button 
                  v-for="tag in filteredTags()" 
                  :key="tag"
                  type="button"
                  class="tag-suggestion"
                  @click="addTag(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
            <div class="selected-tags">
              <span v-for="tag in selectedTags" :key="tag" class="tag">
                {{ tag }}
                <button type="button" class="tag-remove" @click="removeTag(tag)">×</button>
              </span>
              <span v-if="selectedTags.length === 0" class="empty-text">No tags added yet</span>
            </div>
          </section>

          <!-- Section: Vulnerabilities -->
          <section class="form-section vuln-section">
            <div class="section-header">
              <h3 class="section-title"><i class="icon-bug"></i> Vulnerabilities</h3>
              <span class="badge badge-info">{{ vulnerabilities.length }} Found</span>
            </div>
            
            <div class="vuln-list">
              <div 
                v-for="(v, idx) in vulnerabilities" 
                :key="idx"
                class="vuln-item"
              >
                <div class="vuln-info">
                  <span class="vuln-bar" :class="getSeverityBarColor(v.severity)"></span>
                  <div>
                    <h4 class="vuln-title">{{ v.title }}</h4>
                    <span :class="['badge', getSeverityClass(v.severity)]">{{ v.severity }}</span>
                    <span class="badge badge-secondary">{{ v.status || 'Open' }}</span>
                  </div>
                </div>
                <div class="vuln-actions">
                  <button type="button" class="btn-icon" @click="openVulnModal(idx)" title="Edit">
                    ✏️
                  </button>
                  <button type="button" class="btn-icon btn-danger" @click="removeVuln(idx)" title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
              
              <div v-if="vulnerabilities.length === 0" class="empty-vuln">
                <p>No vulnerabilities added yet.</p>
              </div>
            </div>

            <button type="button" class="btn-add-vuln" @click="openVulnModal()">
              <span class="plus-icon">+</span>
              <span>Add Vulnerability Finding</span>
            </button>
          </section>

          <!-- Action Buttons -->
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="router.back()">
              Cancel
            </button>
            <div class="action-group">
              <button type="button" class="btn btn-outline" @click="saveReport" :disabled="isSaving">
                <span v-if="isSaving">Saving...</span>
                <span v-else>💾 Manual Save</span>
              </button>
              
              <select v-model="aiLanguage" class="select select-sm select-lang" :disabled="isGeneratingAI">
                <option value="en">🇬🇧 EN</option>
                <option value="th">🇹🇭 TH</option>
              </select>

              <button type="button" class="btn btn-primary btn-ai" @click="saveWithAI" :disabled="isGeneratingAI">
                <span v-if="isGeneratingAI">🔄 Generating... {{ aiProgress }}%</span>
                <span v-else>✨ AI Auto-Generate & Save</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-else class="loading-state">
          <div class="spinner"></div>
          <p>Loading report...</p>
        </div>
      </div>
    </main>

    <!-- Vulnerability Modal -->
    <div v-if="showVulnModal" class="modal-backdrop" @click.self="closeVulnModal">
      <div class="modal vuln-modal">
        <div class="modal-header">
          <h3>
            <span v-if="editingIndex >= 0">✏️ Edit Vulnerability</span>
            <span v-else>🐛 Add Vulnerability</span>
          </h3>
          <button type="button" class="modal-close" @click="closeVulnModal">×</button>
        </div>
        
        <div class="modal-body">
          <!-- Title -->
          <div class="form-group full-width">
            <label class="form-label">Title (ชื่อช่องโหว่) *</label>
            <input v-model="vulnForm.title" type="text" class="input" placeholder="Vulnerability Title" />
          </div>

          <!-- CVSS Calculator -->
          <div class="cvss-section">
            <label class="form-label">CVSS Severity & Score</label>
            
            <div class="cvss-display">
              <div class="cvss-score">
                <div class="score-value">{{ vulnForm.cvssScore.toFixed(1) }}</div>
                <div class="score-label">Score</div>
              </div>
              <div class="cvss-info">
                <span :class="['badge', getSeverityClass(vulnForm.severity)]">{{ vulnForm.severity.toUpperCase() }}</span>
                <input type="text" :value="vulnForm.cvssVector" readonly class="cvss-vector" />
              </div>
            </div>

            <!-- Version Tabs -->
            <div class="cvss-tabs">
              <button 
                type="button" 
                :class="['cvss-tab', { active: cvssVersion === '3.1' }]"
                @click="switchCvssVersion('3.1')"
              >CVSS v3.1</button>
              <button 
                type="button" 
                :class="['cvss-tab', { active: cvssVersion === '4.0' }]"
                @click="switchCvssVersion('4.0')"
              >CVSS v4.0</button>
            </div>

            <!-- Metrics -->
            <div class="cvss-metrics">
              <div v-for="metric in CVSS_METRICS[cvssVersion]" :key="metric.id" class="cvss-metric">
                <label class="metric-label">{{ metric.name }} ({{ metric.id }})</label>
                <div class="metric-options">
                  <button 
                    v-for="opt in metric.options" 
                    :key="opt.val"
                    type="button"
                    :class="['metric-btn', { active: cvssState[cvssVersion]?.[metric.id] === opt.val }]"
                    @click="selectCvss(metric.id, opt.val)"
                    :title="opt.label"
                  >{{ opt.val }}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-grid">
            <!-- OWASP -->
            <div class="form-group">
              <label class="form-label">OWASP Category</label>
              <input v-model="vulnForm.owasp" type="text" class="input" placeholder="e.g. A01:2021" />
            </div>

            <!-- Status -->
            <div class="form-group">
              <label class="form-label">Status</label>
              <select v-model="vulnForm.status" class="select">
                <option value="Open">Open</option>
                <option value="Fixed">Fixed</option>
                <option value="Remediated">Remediated</option>
                <option value="Accepted">Accepted</option>
                <option value="False Positive">False Positive</option>
              </select>
            </div>
          </div>

          <!-- Affected -->
          <div class="form-group full-width">
            <label class="form-label">Affected URL/Component</label>
            <input v-model="vulnForm.affected" type="text" class="input" placeholder="URL or Component" />
          </div>

          <!-- Details -->
          <div class="form-group full-width">
            <label class="form-label">Details / Impact</label>
            <textarea v-model="vulnForm.detail" class="textarea" rows="3" placeholder="Describe the vulnerability..."></textarea>
          </div>

          <!-- Fix -->
          <div class="form-group full-width">
            <label class="form-label">Recommendation (Fix)</label>
            <textarea v-model="vulnForm.fix" class="textarea" rows="3" placeholder="How to fix it..."></textarea>
          </div>

          <!-- Evidence Image -->
          <div class="form-group full-width">
            <label class="form-label">Evidence Images (Multiple)</label>
            <input type="file" @change="handleFileUpload" class="file-input" accept="image/*" multiple />
            
            <div v-if="vulnForm.files && vulnForm.files.length > 0" class="image-gallery mt-5">
              <div v-for="(img, idx) in vulnForm.files" :key="idx" class="gallery-item">
                <img 
                  :src="img" 
                  alt="Evidence Preview" 
                  class="gallery-preview" 
                  @click="openLightbox(img)"
                />
                <button type="button" class="remove-img-btn" @click="removeFile(idx)" title="Remove Image">×</button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeVulnModal">Cancel</button>
          <button type="button" class="btn btn-primary" @click="saveVulnerability">
            {{ editingIndex >= 0 ? 'Update Vulnerability' : 'Add Vulnerability' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div v-if="showLightbox" class="lightbox" @click="showLightbox = false">
      <img :src="currentLightboxImage" class="lightbox-img" />
    </div>

    <!-- AI Progress Overlay -->
    <div v-if="isGeneratingAI" class="ai-overlay">
      <div class="ai-content">
        <div class="ai-spinner"></div>
        <h3>Enhancing Report with AI</h3>
        <p>Processing vulnerabilities...</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: aiProgress + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
}

.main-content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--glass-border);
}

.page-header h1 {
  font-size: 1.5rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.text-muted {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Sections */
.form-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: span 2;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.input, .select, .textarea {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.input:focus, .select:focus, .textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.textarea {
  resize: vertical;
  min-height: 80px;
}

/* Framework Grid */
.framework-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.framework-option {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.framework-option:hover {
  border-color: var(--primary-color);
}

.framework-option.selected {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--primary-color);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.checkbox-box {
  width: 1.25rem;
  height: 1.25rem;
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  margin-right: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.8);
  transition: all 0.2s;
}

.framework-option.selected .checkbox-box {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.checkmark {
  color: white;
  font-size: 0.75rem;
}

.fw-name {
  display: block;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.fw-year {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Tags */
.tag-input-wrapper {
  position: relative;
  margin-bottom: 0.75rem;
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  margin-top: 0.25rem;
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.tag-suggestion {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
}

.tag-suggestion:hover {
  background: rgba(99, 102, 241, 0.1);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 2rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 9999px;
  font-size: 0.875rem;
  color: var(--primary-color);
}

.tag-remove {
  background: none;
  border: none;
  color: var(--primary-color);
  margin-left: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.tag-remove:hover {
  opacity: 1;
}

.empty-text {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.875rem;
}

/* Vulnerabilities */
.vuln-section {
  background: rgba(30, 41, 59, 0.3);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.vuln-list {
  margin-bottom: 1rem;
}

.vuln-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
  transition: all 0.2s;
}

.vuln-item:hover {
  border-color: var(--primary-color);
}

.vuln-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.vuln-bar {
  width: 4px;
  height: 40px;
  border-radius: 2px;
}

.vuln-title {
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
  font-size: 0.875rem;
}

.vuln-info .badge {
  margin-right: 0.5rem;
}

.vuln-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: rgba(99, 102, 241, 0.1);
}

.btn-icon.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.empty-vuln {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-md);
}

.btn-add-vuln {
  width: 100%;
  padding: 0.75rem;
  background: none;
  border: 2px dashed var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-add-vuln:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(99, 102, 241, 0.05);
}

.plus-icon {
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Actions */
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1.5rem;
  border-top: 1px solid var(--glass-border);
  margin-top: 2rem;
}

.action-group {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 0.875rem;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.05);
}

.btn-ai {
  flex: 2;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-critical { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.badge-high { background: rgba(249, 115, 22, 0.2); color: #fdba74; }
.badge-medium { background: rgba(234, 179, 8, 0.2); color: #fde047; }
.badge-low { background: rgba(34, 197, 94, 0.2); color: #86efac; }
.badge-info { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
.badge-secondary { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }

.bg-red-500 { background: #ef4444; }
.bg-orange-500 { background: #f97316; }
.bg-yellow-500 { background: #eab308; }
.bg-green-500 { background: #22c55e; }
.bg-gray-500 { background: #6b7280; }

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
}

.file-input {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  font-size: 0.875rem;
  color: var(--text-muted);
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.5rem;
  cursor: pointer;
}

.file-input::file-selector-button {
  margin-right: 1rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-color);
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.file-input::file-selector-button:hover {
  background: rgba(99, 102, 241, 0.2);
}

.evidence-preview {
  width: 100%;
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  margin-top: 0.5rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  cursor: zoom-in;
  transition: transform 0.2s;
}

.evidence-preview:hover {
  transform: scale(1.02);
}

.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
}

.gallery-item {
  position: relative;
}

.gallery-preview {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  cursor: zoom-in;
  transition: transform 0.2s;
}

.gallery-preview:hover {
  transform: scale(1.05);
}

.remove-img-btn {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  background: red;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  z-index: 10;
}

.remove-img-btn:hover {
  background: darkred;
}

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

.text-info {
  color: var(--primary-color);
  font-size: 0.75rem;
  display: block;
  margin-bottom: 0.25rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--glass-border);
  background: rgba(30, 41, 59, 0.5);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  transition: color 0.15s;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--glass-border);
  background: rgba(30, 41, 59, 0.3);
}

/* CVSS Section */
.cvss-section {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-bottom: 1rem;
}

.cvss-display {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.5);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.cvss-score {
  text-align: center;
  padding-right: 1rem;
  border-right: 1px solid var(--glass-border);
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.score-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cvss-info {
  flex: 1;
}

.cvss-vector {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: monospace;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.cvss-tabs {
  display: flex;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 1rem;
}

.cvss-tab {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.cvss-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.cvss-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.cvss-metric {
  margin-bottom: 0.5rem;
}

.metric-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.metric-options {
  display: flex;
  gap: 4px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: var(--radius-md);
  padding: 4px;
  border: 1px solid var(--glass-border);
}

.metric-btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.metric-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.metric-btn.active {
  background: var(--primary-color);
  color: white;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--glass-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* AI Overlay */
.ai-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.ai-content {
  text-align: center;
  max-width: 400px;
}

.ai-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(99, 102, 241, 0.3);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.ai-content h3 {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.ai-content p {
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 4px;
  transition: width 0.3s;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-group.full-width {
    grid-column: span 1;
  }
  
  .cvss-metrics {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
    gap: 1rem;
  }
  
  .action-group {
    width: 100%;
    flex-direction: column;
  }
}
</style>
