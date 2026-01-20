const urlParams = new URLSearchParams(window.location.search);
const reportId = urlParams.get('id');
const projectId = urlParams.get('projectId');
const token = localStorage.getItem('token');

let vulnerabilities = [];
let editingIndex = -1;

// Frameworks and Tags State
let allFrameworks = [];
let selectedFrameworkIds = [];
let allAvailableTags = [];
let selectedTags = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    if (reportId) {
        await loadReport(reportId);
    } else {
        document.getElementById('reportId').value = reportId;
    }

    // Load frameworks and tags
    await loadFrameworks();
    await loadSuggestedTags();
    setupTagInput();

    // Set Default Dates if empty
    if (!document.getElementById('startDate').value) {
        document.getElementById('startDate').valueAsDate = new Date();
    }
    if (!document.getElementById('endDate').value) {
        document.getElementById('endDate').valueAsDate = new Date();
    }
});

async function loadReport(id) {
    try {
        const res = await fetch(`/api/reports/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load report');

        const report = await res.json();

        // Populate Fields
        document.getElementById('systemName').value = report.systemName || '';
        document.getElementById('url').value = report.url || '';
        document.getElementById('format').value = report.format || 'Blackbox';
        document.getElementById('environment').value = report.environment || 'Production';

        if (report.startDate) {
            document.getElementById('startDate').value = new Date(report.startDate).toISOString().split('T')[0];
        }
        if (report.endDate) {
            document.getElementById('endDate').value = new Date(report.endDate).toISOString().split('T')[0];
        }

        // Frameworks
        selectedFrameworkIds = (report.frameworks || []).map(f => typeof f === 'string' ? f : f._id);
        renderFrameworks();

        // Information Gathering
        if (report.info) {
            document.getElementById('infoIp').value = report.info.ip || '';
            document.getElementById('infoDomain').value = report.info.domain || '';
            document.getElementById('infoPort').value = report.info.port || '';
            document.getElementById('infoOs').value = report.info.os || '';
            document.getElementById('infoServer').value = report.info.server || '';
        }

        // Tags
        selectedTags = report.tags || [];
        renderSelectedTags();

        // Vulns
        vulnerabilities = report.vulnerabilities || [];
        renderVulns();

    } catch (e) {
        console.error(e);
        alert('Error loading report data');
    }
}

function renderVulns() {
    const list = document.getElementById('fileList');
    list.innerHTML = '';

    // Update dynamic count
    const countEl = document.getElementById('vulnCount');
    if (countEl) countEl.innerText = `${vulnerabilities.length} Found`;

    if (vulnerabilities.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                <i class="fas fa-clipboard-check text-2xl mb-2 opacity-50"></i>
                <p class="text-sm">No vulnerabilities added yet.</p>
            </div>
        `;
        return;
    }

    vulnerabilities.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-4 rounded-lg border border-gray-700 bg-slate-800/50 hover:border-indigo-500/50 transition-all group mb-3 shadow-md";

        // Severity coloring
        let colorClass = "bg-gray-700 text-gray-200 border-gray-600";
        let barColor = "bg-gray-500";
        if (v.severity === 'critical') { colorClass = "bg-red-900/30 text-red-200 border-red-900"; barColor = "bg-red-500"; }
        if (v.severity === 'high') { colorClass = "bg-orange-900/30 text-orange-200 border-orange-900"; barColor = "bg-orange-500"; }
        if (v.severity === 'medium') { colorClass = "bg-yellow-900/30 text-yellow-200 border-yellow-900"; barColor = "bg-yellow-500"; }
        if (v.severity === 'low') { colorClass = "bg-green-900/30 text-green-200 border-green-900"; barColor = "bg-green-500"; }

        div.innerHTML = `
            <div class="flex items-center">
                <span class="w-1.5 h-10 rounded-full mr-4 ${barColor}"></span>
                <div>
                    <h4 class="font-bold text-gray-200 text-sm mb-1">${v.title}</h4>
                    <span class="text-[10px] px-2 py-0.5 rounded border ${colorClass} uppercase tracking-wider font-semibold">${v.severity}</span>
                     <span class="ml-2 text-[10px] px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-300 uppercase tracking-wider font-semibold">${v.status || 'Open'}</span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                 <button type="button" onclick="openVulnModal(${index})" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button type="button" onclick="removeVuln(${index})" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        list.appendChild(div);
    });
}

function removeVuln(index) {
    if (confirm('Delete this vulnerability?')) {
        vulnerabilities.splice(index, 1);
        renderVulns();
    }
}

function openVulnModal(index = -1) {
    document.getElementById('vulnModal').classList.remove('hidden');
    editingIndex = index;

    const modalTitle = document.querySelector('#vulnModal h3');
    const submitBtn = document.querySelector('#vulnModal button[onclick="addVulnerability()"]');

    if (index >= 0) {
        // Edit Mode
        const v = vulnerabilities[index];
        modalTitle.innerHTML = '<i class="fas fa-edit mr-2 text-indigo-400"></i> Edit Vulnerability';
        submitBtn.innerText = 'Update Vulnerability';

        document.getElementById('vTitle').value = v.title || '';
        document.getElementById('vStatus').value = v.status || 'Open';
        document.getElementById('vOwasp').value = v.owasp || '';
        document.getElementById('vAffected').value = v.affected || '';
        document.getElementById('vDetail').value = v.detail || v.description || '';
        document.getElementById('vFix').value = v.fix || '';

        // CVSS Load
        const ver = v.cvssVersion || '3.1';
        switchCvssVersion(ver);

        if (v.cvssVector) {
            // Parse existing vector to state
            // Format "CVSS:3.1/AV:N/AC:L..."
            const parts = v.cvssVector.split('/');
            parts.forEach(p => {
                const [key, val] = p.split(':');
                if (key && val && cvssState[ver]) {
                    // Check if key exists in our defined metrics to avoid errors
                    // Some keys might match (AV, AC)
                    cvssState[ver][key] = val;
                }
            });
            renderCvssMetrics(ver);
            updateCvssCalculation();
        } else {
            // Default if no vector but editing?
            renderCvssMetrics(ver);
            updateCvssCalculation();
        }

    } else {
        // Add Mode
        modalTitle.innerHTML = '<i class="fas fa-bug mr-2 text-red-400"></i> Add Vulnerability';
        submitBtn.innerText = 'Add Vulnerability';
        clearModalInputs();

        // Reset CVSS to defaults
        cvssState = {};
        switchCvssVersion('3.1');
    }
}

function closeVulnModal() {
    document.getElementById('vulnModal').classList.add('hidden');
    clearModalInputs();
    editingIndex = -1;
}

function clearModalInputs() {
    document.getElementById('vTitle').value = '';
    document.getElementById('vStatus').value = 'Open';
    document.getElementById('vOwasp').value = '';
    document.getElementById('vAffected').value = '';
    document.getElementById('vDetail').value = '';
    document.getElementById('vFix').value = '';
    document.getElementById('vFile').value = '';
    // Severity/CVSS reset handled in openVulnModal
}

function addVulnerability() {
    const title = document.getElementById('vTitle').value;
    const severity = document.getElementById('vSeverity').value; // from calculation
    const status = document.getElementById('vStatus').value;
    const owasp = document.getElementById('vOwasp').value;
    const affected = document.getElementById('vAffected').value;
    const detail = document.getElementById('vDetail').value;
    const fix = document.getElementById('vFix').value;
    const fileInput = document.getElementById('vFile');

    // CVSS Fields
    const cvssVersion = document.getElementById('cvssVersion').value;
    const cvssVector = document.getElementById('cvssVector').value;
    // Parse score from text or recalc? Text is safe if sync
    const cvssScore = parseFloat(document.getElementById('cvssScore').innerText);

    if (!title) return alert('Title is required');

    const newVuln = {
        title, severity, status, owasp, affected, detail, fix,
        description: detail, // fallback
        cvssVersion, cvssVector, cvssScore
    };

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            newVuln.file = e.target.result;
            saveVulnToState(newVuln);
        };
        reader.readAsDataURL(file);
    } else {
        // If editing and no new file, keep old file
        if (editingIndex >= 0 && vulnerabilities[editingIndex].file) {
            newVuln.file = vulnerabilities[editingIndex].file;
        } else {
            newVuln.file = null;
        }
        saveVulnToState(newVuln);
    }
}

function saveVulnToState(vuln) {
    if (editingIndex >= 0) {
        vulnerabilities[editingIndex] = vuln;
    } else {
        vulnerabilities.push(vuln);
    }
    closeVulnModal();
    renderVulns();
}

async function saveAndGenerate() {
    const payload = {
        systemName: document.getElementById('systemName').value,
        url: document.getElementById('url').value,
        format: document.getElementById('format').value,
        environment: document.getElementById('environment').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        info: {
            ip: document.getElementById('infoIp').value,
            domain: document.getElementById('infoDomain').value,
            port: document.getElementById('infoPort').value,
            os: document.getElementById('infoOs').value,
            server: document.getElementById('infoServer').value
        },
        frameworks: selectedFrameworkIds,
        tags: selectedTags,
        vulnerabilities: vulnerabilities
    };

    console.log('[DEBUG] Save Payload - Frameworks:', selectedFrameworkIds);
    console.log('[DEBUG] Save Payload - Tags:', selectedTags);
    console.log('[DEBUG] Full Payload:', payload);

    if (!token) {
        alert('Authentication token missing. Please login again.');
        window.location.href = '/login.html';
        return;
    }

    try {
        let res;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        console.log('[DEBUG] Saving Report Payload:', payload);

        if (reportId && reportId !== 'null' && reportId !== 'undefined') {
            // UPDATE existing
            console.log('[DEBUG] Method: POST (Update Alias), URL: /api/reports/' + reportId + '/update');
            res = await fetch(`/api/reports/${reportId}/update`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
        } else {
            // CREATE new
            if (projectId) payload.project = projectId;

            console.log('[DEBUG] Method: POST, URL: /api/reports');
            res = await fetch('/api/reports', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            const data = await res.json();

            // If created new, reload to capture new ID in const reportId
            if ((!reportId || reportId === 'null') && data.reportId) {
                alert('Report Created Successfully! Reloading...');
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('id', data.reportId);
                window.location.href = newUrl.toString();
                return; // Stop execution, page will reload
            } else {
                // Success feedback
                alert('Report Saved Successfully!');
                // Auto-PDF removed per user request.
                // User can download from dashboard.
            }
        } else {
            const text = await res.text();
            console.error('Save Failed Response:', res.status, text);

            try {
                const errData = JSON.parse(text);
                alert('Failed to save report data: ' + (errData.message || 'Unknown error'));
            } catch (jsonErr) {
                // If response is not JSON (e.g. HTML 404), show snippet
                alert(`Server Error (${res.status}): ${text.substring(0, 100)}...`);
            }
        }
    } catch (e) {
        console.error(e);
        alert('Client Error: ' + e.message);
    }
}

// CVSS Definitions for UI
const CVSS_METRICS = {
    '3.1': [
        {
            id: 'AV', name: 'Attack Vector', options: [
                { val: 'N', label: 'Network', desc: 'Bound to network stack' },
                { val: 'A', label: 'Adjacent', desc: 'Bound to same shared physical/logical network' },
                { val: 'L', label: 'Local', desc: 'Local access required' },
                { val: 'P', label: 'Physical', desc: 'Physical interaction required' }
            ]
        },
        {
            id: 'AC', name: 'Attack Complexity', options: [
                { val: 'L', label: 'Low', desc: 'No special conditions' },
                { val: 'H', label: 'High', desc: 'Conditions beyond attacker control' }
            ]
        },
        {
            id: 'PR', name: 'Privileges Required', options: [
                { val: 'N', label: 'None', desc: 'No privileges' },
                { val: 'L', label: 'Low', desc: 'Basic user privileges' },
                { val: 'H', label: 'High', desc: 'Admin/System privileges' }
            ]
        },
        {
            id: 'UI', name: 'User Interaction', options: [
                { val: 'N', label: 'None', desc: 'No user interaction' },
                { val: 'R', label: 'Required', desc: 'User must take action' }
            ]
        },
        {
            id: 'S', name: 'Scope', options: [
                { val: 'U', label: 'Unchanged', desc: 'Impact only in vulnerable component' },
                { val: 'C', label: 'Changed', desc: 'Impacts other components' }
            ]
        },
        {
            id: 'C', name: 'Confidentiality', options: [
                { val: 'N', label: 'None', desc: 'No loss' },
                { val: 'L', label: 'Low', desc: 'Some restricted info accessible' },
                { val: 'H', label: 'High', desc: 'All/Serious info accessible' }
            ]
        },
        {
            id: 'I', name: 'Integrity', options: [
                { val: 'N', label: 'None', desc: 'No loss' },
                { val: 'L', label: 'Low', desc: 'Limited modification possible' },
                { val: 'H', label: 'High', desc: 'Serious modification possible' }
            ]
        },
        {
            id: 'A', name: 'Availability', options: [
                { val: 'N', label: 'None', desc: 'No impact' },
                { val: 'L', label: 'Low', desc: 'Intermittent interruption' },
                { val: 'H', label: 'High', desc: 'Serious interruption' }
            ]
        }
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
};

// Current Selection State
let cvssState = {};

function switchCvssVersion(ver) {
    document.getElementById('cvssVersion').value = ver;

    // Tabs UI
    if (ver === '3.1') {
        document.getElementById('tab-v3').className = "px-4 py-2 text-sm font-medium text-indigo-400 border-b-2 border-indigo-400 focus:outline-none transition-colors";
        document.getElementById('tab-v4').className = "px-4 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent hover:text-gray-300 focus:outline-none transition-colors";
    } else {
        document.getElementById('tab-v3').className = "px-4 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent hover:text-gray-300 focus:outline-none transition-colors";
        document.getElementById('tab-v4').className = "px-4 py-2 text-sm font-medium text-indigo-400 border-b-2 border-indigo-400 focus:outline-none transition-colors";
    }

    renderCvssMetrics(ver);
    updateCvssCalculation();
}

function renderCvssMetrics(ver) {
    const container = document.getElementById('cvss-metrics-container');
    container.innerHTML = '';

    const groups = CVSS_METRICS[ver];

    // If state is empty or mismatched, init defaults
    if (!cvssState[ver]) {
        cvssState[ver] = {};
        // Default Base: AV:N/AC:L ... need robust defaults or take first option
        groups.forEach(g => cvssState[ver][g.id] = g.options[0].val);
    }

    groups.forEach(g => {
        const div = document.createElement('div');
        div.className = "mb-2";

        const label = document.createElement('label');
        label.className = "block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider";
        label.innerText = `${g.name} (${g.id})`;
        div.appendChild(label);

        const btnGroup = document.createElement('div');
        btnGroup.className = "flex bg-gray-900 rounded-lg p-1 border border-gray-700";

        g.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = cvssState[ver][g.id] === opt.val;

            // Premium button style
            let btnClass = "flex-1 text-[10px] py-1.5 px-2 rounded-md font-medium transition-all ";
            if (isActive) {
                btnClass += "bg-indigo-600 text-white shadow-sm";
            } else {
                btnClass += "text-gray-400 hover:text-gray-200 hover:bg-gray-800";
            }
            btn.className = btnClass;
            btn.innerText = opt.val;
            btn.title = opt.label + (opt.desc ? `: ${opt.desc}` : '');

            btn.onclick = () => {
                cvssState[ver][g.id] = opt.val;
                renderCvssMetrics(ver); // Re-render to update active classes
                updateCvssCalculation();
            };

            btnGroup.appendChild(btn);
        });

        div.appendChild(btnGroup);
        container.appendChild(div);
    });
}

function updateCvssCalculation() {
    const ver = document.getElementById('cvssVersion').value;
    const values = cvssState[ver];

    // Construct Vector String
    // Fixed order matters usually, but parser handles keys. Standard says fixed order preferred.
    // For 3.1: AV/AC/PR/UI/S/C/I/A
    let vector = `CVSS:${ver}/`;
    if (ver === '3.1') {
        vector += `AV:${values.AV}/AC:${values.AC}/PR:${values.PR}/UI:${values.UI}/S:${values.S}/C:${values.C}/I:${values.I}/A:${values.A}`;
    } else {
        // v4 order: AV/AC/AT/PR/UI/VC/VI/VA/SC/SI/SA
        vector += `AV:${values.AV}/AC:${values.AC}/AT:${values.AT}/PR:${values.PR}/UI:${values.UI}/VC:${values.VC}/VI:${values.VI}/VA:${values.VA}/SC:${values.SC}/SI:${values.SI}/SA:${values.SA}`;
    }

    // Calculate
    let score = 0;
    if (ver === '3.1') score = CVSS.v31.calculate(vector);
    else score = CVSS.v40.calculate(vector);

    // Update UI
    document.getElementById('cvssScore').innerText = score.toFixed(1);
    document.getElementById('cvssVector').value = vector;

    // Severity and Badge
    const severity = (ver === '3.1' ? CVSS.v31.getSeverity(score) : CVSS.v40.getSeverity(score)).toLowerCase();
    document.getElementById('vSeverity').value = severity; // Sync hidden field for form

    const badge = document.getElementById('cvssSeverityBadge');
    badge.innerText = severity.toUpperCase();

    // Badge Colors
    badge.className = "inline-block px-3 py-1 rounded text-sm font-bold mb-1 transition-colors ";
    if (severity === 'critical') badge.classList.add('bg-red-500', 'text-white');
    else if (severity === 'high') badge.classList.add('bg-orange-500', 'text-white');
    else if (severity === 'medium') badge.classList.add('bg-yellow-500', 'text-white');
    else if (severity === 'low') badge.classList.add('bg-green-500', 'text-white');
    else badge.classList.add('bg-gray-700', 'text-gray-300');
}

// Override or Update Default Functions
// ------------------------------------

async function saveWithAI() {
    if (vulnerabilities.length === 0) {
        alert('No vulnerabilities to enhance.');
        return;
    }

    if (!confirm('This will use AI to generate Details and Recommendations for all vulnerabilities. Existing content in these fields might be improved. Continue?')) {
        return;
    }

    // Show Overlay
    const overlay = document.getElementById('aiProgressOverlay');
    const updateText = (txt) => document.getElementById('aiProgressText').innerText = txt;
    const updateBar = (pct) => document.getElementById('aiProgressBar').style.width = `${pct}%`;

    overlay.classList.remove('hidden');
    updateText('Initializing AI Provider...');
    updateBar(5);

    try {
        // 1. Get AI Config (Default)
        const token = localStorage.getItem('token');
        const configRes = await fetch('/api/ai-config', { headers: { 'Authorization': `Bearer ${token}` } });
        const configs = await configRes.json();
        const providerConfig = configs.find(c => c.isDefault) || configs[0];

        if (!providerConfig || !providerConfig.isEnabled) {
            throw new Error('No active AI connection found. Please configure one in Settings.');
        }

        // 2. Iterate and Enhance
        let processed = 0;
        const total = vulnerabilities.length;

        for (let i = 0; i < total; i++) {
            const v = vulnerabilities[i];
            updateText(`Enhancing item ${i + 1} of ${total}: ${v.title}...`);
            updateBar(10 + ((i / total) * 80)); // 10% to 90%

            // Skip if user manually wrote a lot? No, user requested AI gen.
            // Prompt Strategy
            const prompt = `
                Role: Senior Penetration Tester.
                Task: Write a technical description (Impact) and a remediation (Recommendation) for a vulnerability.
                Vulnerability: "${v.title}"
                Severity: ${v.severity}
                OWASP Category: ${v.owasp}
                Context: Web Application Penetration Test.
                
                Respond ONLY in valid JSON format:
                {
                    "detail": "Comprehensive technical description of the impact...",
                    "fix": "Step-by-step remediation guide..."
                }
            `;

            try {
                const aiRes = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        provider: providerConfig.provider,
                        model: providerConfig.modelName,
                        prompt: prompt
                    })
                });

                if (!aiRes.ok) throw new Error('AI API Failed');

                const aiData = await aiRes.json();

                // Parse AI Result (it might be wrapped in markdown code blocks)
                let cleanResult = aiData.result;
                if (cleanResult.includes('```json')) {
                    cleanResult = cleanResult.split('```json')[1].split('```')[0];
                } else if (cleanResult.includes('```')) {
                    cleanResult = cleanResult.split('```')[1].split('```')[0];
                }

                const parsed = JSON.parse(cleanResult);

                // Update Vue/State
                vulnerabilities[i].detail = parsed.detail || v.detail;
                vulnerabilities[i].fix = parsed.fix || v.fix;

            } catch (err) {
                console.error(`Failed to enhance ${v.title}`, err);
                // Continue to next item, don't break flow
            }
        }

        updateText('Finalizing Report...');
        updateBar(100);

        // 3. Save
        await saveAndGenerate();

        overlay.classList.add('hidden');

    } catch (e) {
        console.error(e);
        alert('AI Enhancement Failed: ' + e.message);
        overlay.classList.add('hidden');
    }
}

async function downloadPDF(id) {
    try {
        const res = await fetch(`/api/reports/${id}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            alert('Error generating PDF');
        }
    } catch (e) {
        console.error(e);
        alert('Download failed');
    }
}

// ========== FRAMEWORKS MANAGEMENT ==========

async function loadFrameworks() {
    try {
        const res = await fetch('/api/frameworks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            allFrameworks = await res.json();
            renderFrameworks();
        }
    } catch (error) {
        console.error('Error loading frameworks:', error);
    }
}

function renderFrameworks() {
    const container = document.getElementById('frameworksList');
    if (!container) return;

    if (!allFrameworks || allFrameworks.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-sm italic col-span-full text-center py-4 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">No frameworks available. Please add them in Settings.</div>';
        return;
    }

    container.innerHTML = '';
    allFrameworks.forEach(f => {
        const isChecked = selectedFrameworkIds.includes(f._id);

        const label = document.createElement('label');
        label.htmlFor = `fw_${f._id}`;
        label.className = "relative flex items-center p-3 rounded-lg border border-gray-700 bg-slate-800/50 cursor-pointer transition-all hover:bg-slate-800 hover:border-indigo-500/50 text-gray-300 select-none";

        if (isChecked) {
            label.className += " border-indigo-500 bg-indigo-500/10";
        }

        label.innerHTML = `
            <input type="checkbox" name="frameworks" value="${f._id}" id="fw_${f._id}" 
                   class="peer sr-only" ${isChecked ? 'checked' : ''}
                   onchange="toggleFramework('${f._id}')">
            <div class="w-5 h-5 mr-3 rounded border border-gray-600 bg-gray-900 flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 peer-checked:shadow-sm">
               <svg class="w-3 h-3 text-white ${isChecked ? 'opacity-100' : 'opacity-0'} transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
               </svg>
            </div>
            <div class="flex-1">
                <span class="block font-medium text-sm text-gray-200">${f.name}</span>
                <span class="block text-xs text-gray-500">${f.year}</span>
            </div>
        `;
        container.appendChild(label);
    });
}

window.toggleFramework = (frameworkId) => {
    const index = selectedFrameworkIds.indexOf(frameworkId);
    if (index > -1) {
        selectedFrameworkIds.splice(index, 1);
    } else {
        selectedFrameworkIds.push(frameworkId);
    }
    renderFrameworks();
};

// ========== TAGS MANAGEMENT ==========

async function loadSuggestedTags() {
    try {
        const res = await fetch('/api/reports/tags', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            allAvailableTags = await res.json();
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

function setupTagInput() {
    const tagInput = document.getElementById('tagInput');
    const tagSuggestions = document.getElementById('tagSuggestions');

    if (!tagInput) return;

    // Handle Enter key to add tag
    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tagValue = tagInput.value.trim();
            if (tagValue) {
                addTag(tagValue);
                tagInput.value = '';
                tagSuggestions.classList.add('hidden');
            }
        } else if (e.key === 'Escape') {
            tagSuggestions.classList.add('hidden');
        }
    });

    // Handle input for autocomplete
    tagInput.addEventListener('input', (e) => {
        const value = e.target.value.trim().toLowerCase();

        if (value.length > 0) {
            const filtered = allAvailableTags.filter(tag =>
                tag.toLowerCase().includes(value) && !selectedTags.includes(tag)
            );

            if (filtered.length > 0) {
                renderAutocomplete(filtered);
                tagSuggestions.classList.remove('hidden');
            } else {
                tagSuggestions.classList.add('hidden');
            }
        } else {
            tagSuggestions.classList.add('hidden');
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!tagInput.contains(e.target) && !tagSuggestions.contains(e.target)) {
            tagSuggestions.classList.add('hidden');
        }
    });
}

function renderAutocomplete(tags) {
    const tagSuggestions = document.getElementById('tagSuggestions');
    if (!tagSuggestions) return;

    tagSuggestions.innerHTML = tags.map(tag => `
        <div class="px-3 py-2 hover:bg-slate-700 cursor-pointer text-sm text-gray-300 transition-colors border-b border-gray-700 last:border-0"
             onclick="addTagFromSuggestion('${tag.replace(/'/g, "\\'")}')">
            <i class="fas fa-tag text-indigo-400 mr-2 text-xs"></i>${tag}
        </div>
    `).join('');
}

window.addTagFromSuggestion = (tag) => {
    addTag(tag);
    document.getElementById('tagInput').value = '';
    document.getElementById('tagSuggestions').classList.add('hidden');
};

function addTag(tagName) {
    const trimmedTag = tagName.trim();

    if (!trimmedTag) return;
    if (selectedTags.includes(trimmedTag)) {
        return;
    }

    selectedTags.push(trimmedTag);
    renderSelectedTags();
}

function removeTag(tagName) {
    selectedTags = selectedTags.filter(t => t !== tagName);
    renderSelectedTags();
}

window.removeTag = removeTag;

function renderSelectedTags() {
    const container = document.getElementById('selectedTags');
    if (!container) return;

    if (selectedTags.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-sm italic">No tags added yet</div>';
        return;
    }

    container.innerHTML = selectedTags.map(tag => {
        const escapedTag = tag.replace(/"/g, '&quot;');
        return `
        <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm group hover:bg-indigo-500/30 transition-all">
            <i class="fas fa-tag mr-2 text-xs"></i>
            ${tag}
            <button type="button" onclick='removeTag("${escapedTag}")' 
                    class="ml-2 text-indigo-400 hover:text-red-400 transition-colors focus:outline-none"
                    title="Remove tag">
                <i class="fas fa-times text-xs"></i>
            </button>
        </span>
    `;
    }).join('');
}

window.addTag = addTag;
