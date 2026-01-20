const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/';
    if (!projectId) {
        alert('No project ID specified');
        window.location.href = '/projects.html';
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    loadProjectDetails();
    loadProjectReports();
    // Preload frameworks if possible, or load on modal open

    document.getElementById('reportForm').addEventListener('submit', createReport);

    window.toggleSubmenu = (id) => {
        document.getElementById(id).classList.toggle('collapsed');
    };

    // --- Search & Pagination Listeners ---
    const searchInput = document.getElementById('reportSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase();
            currentPage = 1; // Reset to page 1
            renderReportsTable();
        });
    }

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderReportsTable();
            }
        });
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            // Need to calculate total pages dynamically or access from a reliable source?
            // filterReports() is available in scope.
            const totalPages = Math.ceil(filterReports().length / ITEMS_PER_PAGE);
            if (currentPage < totalPages) {
                currentPage++;
                renderReportsTable();
            }
        });
    }
});

async function loadProjectDetails() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load project');

        const p = await res.json();
        const header = document.getElementById('projectHeader');

        header.innerHTML = `
            <div class="project-logo">
                ${p.logoUrl
                ? `<img src="${p.logoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`
                : '<span>📁</span>'}
            </div>
            <div class="project-info">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h1 style="margin-bottom:0.5rem; font-size:1.5rem;">${p.name}</h1>
                        <p style="color:#94a3b8; margin:0;">${p.description || 'No description'}</p>
                    </div>
                    <span style="padding:0.25rem 0.75rem; border-radius:12px; font-size:0.8rem; background:rgba(255,255,255,0.1);">
                        ${p.status.toUpperCase()}
                    </span>
                </div>
                
                <div class="project-meta">
                    <div class="meta-item">
                        <label>Client</label>
                        <div>${p.clientName || '-'}</div>
                    </div>
                    <div class="meta-item">
                        <label>Prepared By</label>
                        <div>${p.preparedBy || '-'}</div>
                    </div>
                    <div class="meta-item">
                        <label>Pentester</label>
                        <div>${p.pentesterName || '-'}</div>
                    </div>
                    <div class="meta-item">
                        <label>Created</label>
                        <div>${new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
        `;

        // Update background if exists (optional visual flair)
        if (p.backgroundUrl) {
            // Maybe set as page background or header background
            const mainContent = document.querySelector('.main-content');
            // mainContent.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.95)), url('${p.backgroundUrl}')`;
            // mainContent.style.backgroundSize = 'cover';
        }

    } catch (e) {
        console.error(e);
        document.getElementById('projectHeader').innerHTML = `<div class="error-msg" style="display:block;">Error loading project</div>`;
    }
}

// Pagination & Search State
let allReports = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let currentSearchTerm = '';
let currentSort = { field: 'createdAt', direction: 'desc' };

async function loadProjectReports() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/reports?projectId=${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allReports = await res.json();

        // Render Charts with aggregated data (using ALL reports)
        renderProjectStats(allReports);

        // Initial Render of Table
        renderReportsTable();

    } catch (e) { console.error(e); }
}

function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc'; // Default new sort to asc
    }
    renderReportsTable();
    updateSortIcons();
}

function updateSortIcons() {
    // Reset all icons
    document.querySelectorAll('th i.fa-sort, th i.fa-sort-up, th i.fa-sort-down').forEach(icon => {
        icon.className = 'fas fa-sort text-[10px] text-gray-500 group-hover:text-gray-300';
    });

    // Find the current active header and update icon
    // Mapping field to header index or class is tricky without safe IDs. 
    // Let's rely on onclick attribute matching for simplicity or just simpler UI update:
    // Actually, getting key from simple lookup might be hard if headers don't have IDs.
    // simpler: The headers have onclick="sortTable('FIELD')".
    const headers = document.querySelectorAll('th[onclick]');
    headers.forEach(th => {
        if (th.getAttribute('onclick').includes(`'${currentSort.field}'`)) {
            const icon = th.querySelector('i');
            if (icon) {
                icon.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} text-[10px] text-indigo-400`;
            }
        }
    });
}

function filterReports() {
    let filtered = allReports;

    // 1. Filter
    if (currentSearchTerm) {
        filtered = allReports.filter(r =>
            (r.systemName && r.systemName.toLowerCase().includes(currentSearchTerm)) ||
            (r.url && r.url.toLowerCase().includes(currentSearchTerm))
        );
    }

    // 2. Sort
    return filtered.sort((a, b) => {
        let valA, valB;

        switch (currentSort.field) {
            case 'systemName':
                valA = (a.systemName || '').toLowerCase();
                valB = (b.systemName || '').toLowerCase();
                break;
            case 'createdAt':
                valA = new Date(a.createdAt).getTime();
                valB = new Date(b.createdAt).getTime();
                break;
            case 'status':
                // Dynamic Status Calculation for Sorting
                const getStatus = (r) => {
                    if (r.vulnerabilities && r.vulnerabilities.some(v => (v.status || 'Open') === 'Open')) return 'Open';
                    return 'Fixed';
                };
                valA = getStatus(a);
                valB = getStatus(b);
                break;
            case 'vulnCount':
                valA = (a.vulnerabilities || []).length;
                valB = (b.vulnerabilities || []).length;
                break;
            default:
                valA = 0; valB = 0;
        }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderReportsTable() {
    const tbody = document.querySelector('#reportTable tbody');
    const filteredReports = filterReports();

    // Pagination Logic
    const totalItems = filteredReports.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // Ensure currentPage is valid
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const pageReports = filteredReports.slice(startIndex, endIndex);

    // Update Pagination UI
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.innerHTML = `Showing <span class="font-medium text-white">${totalItems === 0 ? 0 : startIndex + 1}</span> to <span class="font-medium text-white">${endIndex}</span> of <span class="font-medium text-white">${totalItems}</span> results`;
    }

    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages || totalPages === 0;

    // Render "Page X of Y" styling
    const pageNumbersDiv = document.getElementById('pageNumbers');
    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = `
            <span class="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800/50 border border-gray-700 rounded-lg">
                Page <span class="text-white">${currentPage}</span> of <span class="text-white">${totalPages || 1}</span>
            </span>
        `;
    }

    if (pageReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:3rem; color:#94a3b8;">No reports found.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    const token = localStorage.getItem('token');

    pageReports.forEach(r => {
        // Calculate Vuln Stats for Badge
        let vStats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        if (r.vulnerabilities) {
            r.vulnerabilities.forEach(v => {
                const s = (v.severity || 'low').toLowerCase();
                if (vStats[s] !== undefined) vStats[s]++;
            });
        }

        // Generate Badge HTML
        let vulnBadges = '';
        // Order: Critical -> Info
        const keys = ['critical', 'high', 'medium', 'low', 'info'];
        const colors = {
            critical: 'border-red-500 text-red-400 bg-red-500/10',
            high: 'border-orange-500 text-orange-400 bg-orange-500/10',
            medium: 'border-yellow-500 text-yellow-400 bg-yellow-500/10',
            low: 'border-green-500 text-green-400 bg-green-500/10',
            info: 'border-blue-500 text-blue-400 bg-blue-500/10'
        };

        let hasIssues = false;
        keys.forEach(k => {
            if (vStats[k] > 0) {
                hasIssues = true;
                vulnBadges += `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colors[k]} mr-1 mb-1 shadow-sm">${k.toUpperCase()}: ${vStats[k]}</span>`;
            }
        });

        if (!hasIssues) {
            vulnBadges = '<span class="text-gray-500 text-xs italic">No Issues found</span>';
        }

        // Report Status Logic
        let reportStatus = 'Fixed';
        let hasOpenVulns = false;
        if (r.vulnerabilities && r.vulnerabilities.length > 0) {
            hasOpenVulns = r.vulnerabilities.some(v => (v.status || 'Open') === 'Open');
            if (hasOpenVulns) reportStatus = 'Open';
        }

        const statusBadge = reportStatus === 'Open'
            ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Open</span>'
            : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">Fixed</span>';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/30 transition-colors border-b border-gray-700/50 last:border-0";
        tr.innerHTML = `
            <td class="px-4 py-3">
                <div style="font-weight:600;">
                    <a href="/report-edit.html?id=${r._id}&projectId=${projectId}" class="text-white hover:text-indigo-400 transition-colors no-underline">${r.systemName}</a>
                </div>
                <div style="font-size:0.8rem; opacity:0.6; color:#94a3b8;">${r.url || ''}</div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-400 font-mono">${new Date(r.createdAt).toLocaleDateString()}</td>
            <td class="px-4 py-3">${statusBadge}</td>
            <td class="px-4 py-3 text-sm">
                <div class="flex flex-wrap items-center gap-1">
                    ${vulnBadges}
                </div>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2 justify-end">
                    <a href="/views/report-view.html?id=${r._id}&projectId=${projectId}" title="View Report"
                       class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all transform hover:-translate-y-0.5 shadow-sm border border-gray-600">
                       <i class="fas fa-eye"></i>
                    </a>
                    <a href="/report-edit.html?id=${r._id}&projectId=${projectId}" title="Edit"
                       class="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all transform hover:-translate-y-0.5 shadow-sm">
                       <i class="fas fa-pen"></i>
                    </a>
                    <a href="/api/reports/${r._id}/pdf?token=${token}" target="_blank" title="Download PDF"
                       class="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white transition-all transform hover:-translate-y-0.5 shadow-sm">
                       <i class="fas fa-file-pdf"></i>
                    </a>
                    <button onclick="deleteReport('${r._id}')" title="Delete"
                       class="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-all transform hover:-translate-y-0.5 shadow-sm">
                       <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateSortIcons();
}

// Expose sortTable to global scope for HTML onclick
window.sortTable = sortTable;

function renderProjectStats(reports) {
    const section = document.getElementById('statsSection');
    if (!reports || reports.length === 0) return;
    section.classList.remove('hidden');

    // Aggregate Data
    let severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    let statusCounts = { Open: 0, Fixed: 0, Remediated: 0, Accepted: 0, 'False Positive': 0 };
    let owaspCounts = {};

    reports.forEach(r => {
        if (r.vulnerabilities) {
            r.vulnerabilities.forEach(v => {
                // Severity
                const sev = (v.severity || 'low').toLowerCase();
                if (severityCounts[sev] !== undefined) severityCounts[sev]++;

                // Status
                const stat = v.status || 'Open';
                if (statusCounts[stat] !== undefined) statusCounts[stat]++;

                // OWASP
                if (v.owasp) {
                    const cat = v.owasp.split(':')[0].trim(); // Take "A01" from "A01:2021-..."
                    owaspCounts[cat] = (owaspCounts[cat] || 0) + 1;
                }
            });
        }
    });
    // Common Options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%', // Reverted to thinner look or standard? User said "return to same". Let's use 70% or 60%? Previous code had 60% as standard in step 1795, but before that in 1782    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: '#94a3b8',
                    font: { family: "'Inter', sans-serif", size: 11 },
                    boxWidth: 12,
                    padding: 15
                }
            }
        },
        layout: { padding: 45 } // Increased padding to reduce chart size even further
    };

    // 1. Severity Chart
    const ctxSev = document.getElementById('severityChart').getContext('2d');
    new Chart(ctxSev, {
        type: 'doughnut',
        data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{
                data: [
                    severityCounts.critical,
                    severityCounts.high,
                    severityCounts.medium,
                    severityCounts.low
                ],
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
                borderColor: '#1e293b',
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: commonOptions
    });

    // 2. Report Status Chart
    // Logic: Count Reports that are 'Open' vs 'Fixed' to match the table
    let reportStatusCounts = { Open: 0, Fixed: 0 };

    reports.forEach(r => {
        let isOpen = false;
        if (r.vulnerabilities && r.vulnerabilities.length > 0) {
            isOpen = r.vulnerabilities.some(v => (v.status || 'Open') === 'Open');
        }
        if (isOpen) {
            reportStatusCounts.Open++;
        } else {
            reportStatusCounts.Fixed++;
        }
    });

    const ctxStat = document.getElementById('statusChart').getContext('2d');
    new Chart(ctxStat, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'Fixed'],
            datasets: [{
                label: 'Reports',
                data: [reportStatusCounts.Open, reportStatusCounts.Fixed],
                backgroundColor: ['#ef4444', '#22c55e'], // Red, Green
                borderColor: '#1e293b',
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            let total = context.chart._metasets[context.datasetIndex].total;
                            let value = context.raw;
                            let percentage = Math.round((value / total) * 100) + '%';
                            return label + value + ' (' + percentage + ')';
                        }
                    }
                }
            }
        }
    });

    // 3. OWASP Chart (Top 5)
    // Sort OWASP
    const sortedOwasp = Object.entries(owaspCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const ctxOwasp = document.getElementById('owaspChart').getContext('2d');
    new Chart(ctxOwasp, {
        type: 'bar', // Charts.js 3+ uses 'indexAxis: y' for horizontal
        data: {
            labels: sortedOwasp.map(x => x[0]),
            datasets: [{
                label: 'Occurrences',
                data: sortedOwasp.map(x => x[1]),
                backgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

window.createNewReport = () => {
    document.getElementById('reportModal').style.display = 'block';
    loadFrameworks();
};

async function loadFrameworks() {
    const list = document.getElementById('frameworksList');
    list.innerHTML = '<div style="color:grey; padding:0.5rem;">Loading...</div>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/frameworks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const frameworks = await res.json();

        if (!Array.isArray(frameworks) || frameworks.length === 0) {
            list.innerHTML = '<div class="text-gray-500 text-sm italic col-span-full text-center py-4 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">No frameworks available. Please add them in Settings.</div>';
            return;
        }

        list.innerHTML = '';
        frameworks.forEach(f => {
            const div = document.createElement('div');
            // Use label as container for the whole click area
            div.innerHTML = `
                <input type="checkbox" name="frameworks" value="${f._id}" id="fw_${f._id}" class="peer hidden">
                <label for="fw_${f._id}" class="flex items-center p-3 rounded-lg border border-gray-700 bg-gray-800/50 cursor-pointer transition-all hover:border-indigo-500/50 hover:bg-gray-800 peer-checked:border-indigo-500 peer-checked:bg-indigo-500/10 peer-checked:text-white text-gray-400 group">
                    <div class="flex-shrink-0 mr-3">
                        <div class="w-5 h-5 rounded border border-gray-600 flex items-center justify-center peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all group-hover:border-indigo-400/50">
                             <i class="fas fa-check text-[10px] text-white opacity-0 peer-checked:opacity-100 transition-opacity transform scale-0 peer-checked:scale-100"></i>
                             <!-- We need custom CSS for this check icon visibility based on input:checked state, 
                                  but using 'peer' utility in Tailwind is easier if structure allows. 
                                  Let's simplify: standard checkbox with custom container styling. -->
                        </div>
                    </div>
                     <!-- Re-simplifying logic to rely on peer-checked on the label -->
                </label>
            `;

            // Clean implementation using just CSS classes
            const label = document.createElement('label');
            label.htmlFor = `fw_${f._id}`;
            label.className = "relative flex items-center p-3 rounded-lg border border-gray-700 bg-gray-800/50 cursor-pointer transition-all hover:bg-gray-800 hover:border-indigo-500/50 text-gray-300 select-none";

            label.innerHTML = `
                <input type="checkbox" name="frameworks" value="${f._id}" id="fw_${f._id}" class="peer sr-only">
                <div class="w-5 h-5 mr-3 rounded border border-gray-600 bg-gray-900 flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 peer-checked:shadow-sm">
                   <svg class="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <div class="flex-1">
                    <span class="block font-medium text-sm text-gray-200">${f.name}</span>
                    <span class="block text-xs text-gray-500">${f.year}</span>
                </div>
                <div class="absolute inset-0 rounded-lg border-2 border-transparent peer-checked:border-indigo-500/50 pointer-events-none transition-all"></div>
            `;
            list.appendChild(label);
        });

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="color:red; padding:0.5rem;">Error loading frameworks.</div>';
    }
}

window.closeReportModal = () => {
    document.getElementById('reportModal').style.display = 'none';
    document.getElementById('reportForm').reset();
};

async function createReport(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');

    // Gather info object
    // Gather Info
    const frameworks = Array.from(document.querySelectorAll('input[name="frameworks"]:checked')).map(cb => cb.value);

    const payload = {
        systemName: document.getElementById('systemName').value,
        frameworks: frameworks,
        project: projectId, // Link to this project
        // Defaults for now to satisfy schema if needed (schema only requires systemName)
        format: 'Blackbox',
        environment: 'Production'
    };

    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            // Redirect to Editor
            window.location.href = `/report-edit.html?id=${data.reportId}&projectId=${projectId}`;
        } else {
            const data = await res.json();
            alert(data.message || 'Failed to create report');
        }
    } catch (err) {
        alert('Error connecting to server');
    }
}

async function deleteReport(id) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/reports/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            loadProjectReports(); // Reload list
        } else {
            const data = await res.json();
            alert(data.message || 'Failed to delete report');
        }
    } catch (e) {
        console.error(e);
        alert('Error deleting report');
    }
}
